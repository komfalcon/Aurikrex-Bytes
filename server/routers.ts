import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminUsers, posts, readers } from "../drizzle/schema.js";
import {
  createToken,
  hashPassword,
  isValidPassword,
  normalizeEmail,
  randomToken,
  readToken,
  verifyPassword,
} from "./auth.js";
import {
  getAdminByEmail,
  getAdminById,
  getAdminByRememberToken,
  getAnalytics,
  getDb,
  getPostById,
  getPublishedPostById,
  getReaderByEmail,
  getReaderByResetToken,
  getReaderByUsedVerificationToken,
  getReaderByVerificationToken,
  listAdmins,
  listPosts,
  listTodaysPublishedPosts,
  recordPostView,
  recordSearchQuery,
  searchPublishedPosts,
} from "./db.js";
import {
  cloudinaryConfigured,
  getCloudinaryUploadSignature,
  sendAuthEmail,
  verificationEmailHtml,
} from "./services.js";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import {
  assertActiveAdmin,
  assertPermission,
  assertPostTransition,
} from "./permissions.js";
import { appBaseUrl } from "./_core/env.js";

const ADMIN_COOKIE = "aurikrex_admin_session";
const ADMIN_DEVICE_COOKIE = "aurikrex_admin_device";
const READER_COOKIE = "aurikrex_reader_session";
const GOOGLE_STATE_COOKIE = "aurikrex_google_state";
const GOOGLE_NONCE_COOKIE = "aurikrex_google_nonce";
const genericNotFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Not found" });
function cookies(req: { headers: { cookie?: string } }) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map(part => {
        const [key, ...value] = part.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}
function setSession(
  ctx: { res: { cookie: Function }; req: any },
  name: string,
  token: string,
  remember: boolean
) {
  ctx.res.cookie(name, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12,
  });
}

async function requireAdmin(ctx: { req: any }) {
  const parsed = cookies(ctx.req);
  const token = parsed[ADMIN_COOKIE];
  const payload = token ? readToken(token) : null;
  if (payload && payload.kind === "admin") {
    const admin = await getAdminById(payload.id);
    if (admin) return assertActiveAdmin(admin);
  }
  const remembered = parsed[ADMIN_DEVICE_COOKIE]
    ? await getAdminByRememberToken(parsed[ADMIN_DEVICE_COOKIE])
    : undefined;
  if (remembered) return assertActiveAdmin(remembered);
  throw genericNotFound();
}
async function requireReader(ctx: { req: any }) {
  const token = cookies(ctx.req)[READER_COOKIE];
  const payload = token ? readToken(token) : null;
  if (!payload || payload.kind !== "reader")
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  return payload;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      for (const name of [
        COOKIE_NAME,
        "aurikrex_admin_session",
        "aurikrex_admin_device",
        "aurikrex_reader_session",
        GOOGLE_STATE_COOKIE,
        GOOGLE_NONCE_COOKIE,
      ])
        ctx.res.clearCookie(name, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  admin: router({
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
          remember: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await getAdminByEmail(normalizeEmail(input.email));
        if (
          !admin ||
          !admin.isActive ||
          !(await verifyPassword(input.password, admin.passwordHash))
        )
          throw genericNotFound();
        const token = createToken(
          { kind: "admin", id: admin.id, email: admin.email, role: admin.role },
          input.remember
        );
        const deviceToken = input.remember ? randomToken() : null;
        const db = await getDb();
        if (db && deviceToken)
          await db
            .update(adminUsers)
            .set({ rememberDeviceToken: deviceToken })
            .where(eq(adminUsers.id, admin.id));
        setSession(ctx, ADMIN_COOKIE, token, input.remember);
        if (deviceToken)
          setSession(ctx, ADMIN_DEVICE_COOKIE, deviceToken, true);
        return { success: true, role: admin.role };
      }),
    session: publicProcedure.query(async ({ ctx }) => requireAdmin(ctx)),
    posts: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      return listPosts();
    }),
    post: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        const post = await getPostById(input.id);
        if (!post) throw genericNotFound();
        return post;
      }),
    createPost: publicProcedure
      .input(
        z.object({
          headline: z.string().min(1).max(120),
          body: z.string().min(1).max(800),
          imageUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:create");
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Database is not configured",
          });
        const result = await db.insert(posts).values({
          ...input,
          status: "draft",
          createdBy: admin.id,
          updatedAt: new Date(),
        });
        return { success: true, id: Number(result.lastInsertRowid) };
      }),
    editPost: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          headline: z.string().min(1).optional(),
          body: z.string().min(1).optional(),
          imageUrl: z.string().url().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:edit");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        const { id, ...changes } = input;
        await db
          .update(posts)
          .set({ ...changes, updatedAt: new Date() })
          .where(eq(posts.id, id));
        return { success: true };
      }),
    deletePost: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:delete");
        const db = await getDb();
        if (!db || !(await getPostById(input.id))) throw genericNotFound();
        await db.delete(posts).where(eq(posts.id, input.id));
        return { success: true };
      }),
    submitPost: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:submit");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        assertPostTransition(admin.role, post.status, "pending_review");
        await db
          .update(posts)
          .set({
            status: "pending_review",
            rejectionNote: null,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));
        return { success: true };
      }),
    publishPost: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:publish");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        assertPostTransition(admin.role, post.status, "published");
        await db
          .update(posts)
          .set({
            status: "published",
            publishedTime: new Date(),
            scheduledTime: null,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));
        return { success: true };
      }),
    schedulePost: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          scheduledTime: z.coerce.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:schedule");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        assertPostTransition(admin.role, post.status, "scheduled");
        if (input.scheduledTime <= new Date())
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "scheduledTime must be in the future",
          });
        await db
          .update(posts)
          .set({
            status: "scheduled",
            scheduledTime: input.scheduledTime,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));
        return { success: true };
      }),
    unschedulePost: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:unschedule");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        assertPostTransition(admin.role, post.status, "draft");
        if (!post.scheduledTime || post.scheduledTime <= new Date())
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only future scheduled posts can be cancelled",
          });
        await db
          .update(posts)
          .set({ status: "draft", scheduledTime: null, updatedAt: new Date() })
          .where(eq(posts.id, input.id));
        return { success: true };
      }),
    approvePost: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          scheduledTime: z.coerce.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:review");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        if (input.scheduledTime && input.scheduledTime <= new Date())
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "scheduledTime must be in the future",
          });
        const next = input.scheduledTime ? "scheduled" : "published";
        assertPostTransition(admin.role, post.status, next);
        await db
          .update(posts)
          .set({
            status: next,
            scheduledTime: input.scheduledTime ?? null,
            publishedTime: input.scheduledTime ? null : new Date(),
            rejectionNote: null,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));
        return { success: true, status: next };
      }),
    rejectPost: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          rejectionNote: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:review");
        const db = await getDb();
        const post = await getPostById(input.id);
        if (!db || !post) throw genericNotFound();
        assertPostTransition(admin.role, post.status, "draft");
        await db
          .update(posts)
          .set({
            status: "draft",
            rejectionNote: input.rejectionNote ?? null,
            scheduledTime: null,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));
        return { success: true };
      }),
    users: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        return listAdmins();
      }),
      create: publicProcedure
        .input(
          z.object({
            email: z.string().email(),
            password: z.string().min(8),
            role: z.enum(["admin", "editor"]).default("editor"),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const admin = await requireAdmin(ctx);
          assertPermission(admin.role, "users:manage");
          const db = await getDb();
          if (!db)
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Database is not configured",
            });
          const email = normalizeEmail(input.email);
          if (await getAdminByEmail(email))
            throw new TRPCError({
              code: "CONFLICT",
              message: "An account already exists",
            });
          await db.insert(adminUsers).values({
            email,
            passwordHash: await hashPassword(input.password),
            role: input.role,
            isActive: true,
          });
          return { success: true };
        }),
      changeRole: publicProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            role: z.enum(["admin", "editor"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const admin = await requireAdmin(ctx);
          assertPermission(admin.role, "users:manage");
          const db = await getDb();
          if (!db || !(await getAdminById(input.id))) throw genericNotFound();
          await db
            .update(adminUsers)
            .set({ role: input.role })
            .where(eq(adminUsers.id, input.id));
          return { success: true };
        }),
      revoke: publicProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const admin = await requireAdmin(ctx);
          assertPermission(admin.role, "users:manage");
          if (input.id === admin.id)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You cannot revoke your own account",
            });
          const db = await getDb();
          if (!db || !(await getAdminById(input.id))) throw genericNotFound();
          await db
            .update(adminUsers)
            .set({ isActive: false, rememberDeviceToken: null })
            .where(eq(adminUsers.id, input.id));
          return { success: true };
        }),
    }),
    analytics: publicProcedure.query(async ({ ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "analytics:view");
      return getAnalytics();
    }),
    cloudinarySignature: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      if (!cloudinaryConfigured()) return { configured: false };
      return { configured: true, ...getCloudinaryUploadSignature() };
    }),
  }),
  reader: router({
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        if (!isValidPassword(input.password))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Password must be at least 8 characters and include a number and symbol",
          });
        const email = normalizeEmail(input.email);
        if (await getReaderByEmail(email))
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account already exists",
          });
        const verificationToken = randomToken();
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Database is not configured",
          });
        await db.insert(readers).values({
          name: input.name.trim(),
          email,
          passwordHash: await hashPassword(input.password),
          verificationToken,
          verificationTokenUsed: null,
          emailVerified: false,
        });
        const url = `${appBaseUrl()}/verify-email?token=${verificationToken}`;
        await sendAuthEmail(
          email,
          "You're almost ready for Aurikrex Bytes",
          verificationEmailHtml(url)
        );
        return { success: true, verificationRequired: true, email };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
          remember: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const reader = await getReaderByEmail(normalizeEmail(input.email));
        if (
          !reader ||
          !reader.passwordHash ||
          !(await verifyPassword(input.password, reader.passwordHash))
        )
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        if (!reader.emailVerified)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Please verify your email before signing in",
          });
        const token = createToken(
          {
            kind: "reader",
            id: reader.id,
            email: reader.email,
            verified: Boolean(reader.emailVerified),
          },
          input.remember
        );
        setSession(ctx, READER_COOKIE, token, input.remember);
        return { success: true, emailVerified: Boolean(reader.emailVerified) };
      }),
    session: publicProcedure.query(async ({ ctx }) => requireReader(ctx)),
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string().min(10) }))
      .mutation(async ({ input }) => {
        const reader = await getReaderByVerificationToken(input.token);
        if (!reader) {
          const usedReader = await getReaderByUsedVerificationToken(
            input.token
          );
          if (usedReader?.emailVerified)
            return { status: "already_verified" as const };
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This verification link is invalid or has expired. Request a new email to try again.",
          });
        }
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Database is not configured",
          });
        await db
          .update(readers)
          .set({
            emailVerified: true,
            verificationToken: null,
            verificationTokenUsed: input.token,
          })
          .where(eq(readers.id, reader.id));
        return { status: "verified" as const };
      }),
    resendVerificationEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const reader = await getReaderByEmail(normalizeEmail(input.email));
        if (!reader || reader.emailVerified) return { success: true };
        const verificationToken = randomToken();
        const db = await getDb();
        if (db) {
          await db
            .update(readers)
            .set({ verificationToken, verificationTokenUsed: null })
            .where(eq(readers.id, reader.id));
          const url = `${appBaseUrl()}/verify-email?token=${verificationToken}`;
          await sendAuthEmail(
            reader.email,
            "You're almost ready for Aurikrex Bytes",
            verificationEmailHtml(url)
          );
        }
        return { success: true };
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const reader = await getReaderByEmail(normalizeEmail(input.email));
        if (!reader) return { success: true };
        const token = randomToken();
        const db = await getDb();
        if (db) {
          await db
            .update(readers)
            .set({
              resetToken: token,
              resetTokenExpires: new Date(Date.now() + 1000 * 60 * 30),
            })
            .where(eq(readers.id, reader.id));
          const url = `${appBaseUrl()}/reset-password?token=${token}`;
          await sendAuthEmail(
            reader.email,
            "Reset your Aurikrex Bytes password",
            `<p>Reset your password: <a href="${url}">${url}</a></p>`
          );
        }
        return { success: true };
      }),
    resetPassword: publicProcedure
      .input(
        z.object({ token: z.string().min(10), password: z.string().min(8) })
      )
      .mutation(async ({ input }) => {
        if (!isValidPassword(input.password))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Password must be at least 8 characters and include a number and symbol",
          });
        const reader = await getReaderByResetToken(input.token);
        if (!reader)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or expired reset token",
          });
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Database is not configured",
          });
        await db
          .update(readers)
          .set({
            passwordHash: await hashPassword(input.password),
            resetToken: null,
            resetTokenExpires: null,
          })
          .where(eq(readers.id, reader.id));
        return { success: true };
      }),
    googleStart: publicProcedure.query(({ ctx }) => {
      const state = randomToken();
      const nonce = randomToken();
      ctx.res.cookie(GOOGLE_STATE_COOKIE, state, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 1000 * 60 * 10,
      });
      ctx.res.cookie(GOOGLE_NONCE_COOKIE, nonce, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 1000 * 60 * 10,
      });
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        redirect_uri: `${appBaseUrl()}/api/auth/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        state,
        nonce,
      });
      return {
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      };
    }),
  }),
  publicPosts: router({
    list: publicProcedure.query(() => listPosts()),
    today: publicProcedure.query(() => listTodaysPublishedPosts()),
    archive: publicProcedure
      .input(
        z.object({
          query: z.string().max(120).default(""),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(24).default(12),
        })
      )
      .query(async ({ input }) => {
        const result = await searchPublishedPosts(
          input.query,
          input.page,
          input.pageSize
        );
        if (input.query.trim() && input.page === 1)
          await recordSearchQuery(input.query);
        return result;
      }),
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const post = await getPublishedPostById(input.id);
        if (!post) throw genericNotFound();
        await recordPostView(post.id);
        return post;
      }),
  }),
});

export type AppRouter = typeof appRouter;
