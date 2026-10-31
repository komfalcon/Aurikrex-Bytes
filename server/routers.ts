import { TRPCError } from "@trpc/server";
import axios from "axios";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { adminUsers, oneSignalSubscriptions, posts, readers, pushSubscriptions } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import {
  createToken,
  hashPassword,
  hashToken,
  isValidPassword,
  normalizeEmail,
  randomToken,
  readToken,
  verifyPassword,
} from "./auth.js";
import {
  checkPasswordAttemptLockout,
  isSafeAvatarUrl,
  isSafePublicHttpsUrl,
  recordFailedPasswordAttempt,
  resetPasswordAttempts,
  safeStringEqual,
} from "./_core/security.js";
import {
  getAdminByEmail,
  getAdminById,
  getAdminByRememberToken,
  getAnalytics,
  getDb,
  getPostById,
  getPublishedPostById,
  getReaderByEmail,
  getReaderById,
  updateReaderAvatar,
  updateReaderProfile,
  getReaderDashboard,
  getReaderPostEngagement,
  getReaderByResetToken,
  getReaderByUsedVerificationToken,
  getReaderByVerificationToken,
  listAdmins,
  listPosts,
  listPublishedPostsForCarousel,
  listSavedPosts,
  listTodaysPublishedPosts,
  publishDuePosts,
  recordPostView,
  recordSearchQuery,
  searchPublishedPosts,
  togglePostBookmark,
  togglePostReaction,
  updateReaderFeedPreference,
  isMaintenanceMode,
  setMaintenanceMode,
} from "./db.js";
import {
  cloudinaryConfigured,
  getCloudinaryUploadSignature,
  sendAuthEmail,
  verificationEmailHtml,
  resetPasswordEmailHtml,
} from "./services.js";
import { COOKIE_NAME } from "@shared/const";
import {
  getFirstPartyCookieOptions,
  getSessionCookieOptions,
} from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import { getMistralApiKey, getNvidiaApiKey, getCloudflareAiConfig, getCloudflareAiConfigs } from "./_core/aiKeys.js";
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
    ...getFirstPartyCookieOptions(ctx.req),
    maxAge: remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12,
  });
}

async function requireAdmin(ctx: { req: any }) {
  const parsed = cookies(ctx.req);
  const token = parsed[ADMIN_COOKIE];
  const payload = token ? readToken(token) : null;
  if (payload && payload.kind === "admin") {
    const admin = await getAdminById(payload.id);
    if (admin) {
      const currentVersion = admin.tokenVersion ?? 1;
      if (payload.tokenVersion !== undefined && payload.tokenVersion !== currentVersion) {
        throw genericNotFound();
      } else if (payload.tokenVersion === undefined && currentVersion > 1) {
        throw genericNotFound();
      }
      return assertActiveAdmin(admin);
    }
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
  const reader = await getReaderById(payload.id);
  if (!reader)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  const currentVersion = reader.tokenVersion ?? 1;
  if (payload.tokenVersion !== undefined && payload.tokenVersion !== currentVersion) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired or revoked. Please sign in again." });
  } else if (payload.tokenVersion === undefined && currentVersion > 1) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired or revoked. Please sign in again." });
  }
  return payload;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    coinsBalance: publicProcedure.query(async ({ ctx }) => {
      try {
        const token = cookies(ctx.req)[READER_COOKIE];
        const payload = token ? readToken(token) : null;
        if (payload && payload.kind === "reader") {
          let email: string | undefined = payload.email;
          if (!email) {
            const r = await getReaderById(payload.id);
            email = r?.email;
          }
          if (email) {
            const { getCoinBalance } = await import("./_core/central.js");
            const centralData = await getCoinBalance(email);
            if (centralData && typeof centralData.balance === "number") {
              return {
                ...centralData,
                balance: Math.min(centralData.balance, 2500),
                allowance: 2500,
              };
            }
            if (centralData) return centralData;
          }
        }
      } catch (err) {
        console.warn("[Coins] Failed to query coins balance from Central:", err);
      }
      return {
        balance: 2500,
        allowance: 2500,
        costPerRequest: 5,
        lastResetDate: new Date().toISOString(),
        nextResetDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    }),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const firstPartyCookieOptions = getFirstPartyCookieOptions(ctx.req);
      for (const name of [
        COOKIE_NAME,
        "aurikrex_admin_session",
        "aurikrex_admin_device",
        "aurikrex_reader_session",
      ])
        ctx.res.clearCookie(name, {
          ...firstPartyCookieOptions,
          maxAge: -1,
        });
      const oauthCookieOptions = getSessionCookieOptions(ctx.req);
      for (const name of [GOOGLE_STATE_COOKIE, GOOGLE_NONCE_COOKIE])
        ctx.res.clearCookie(name, { ...oauthCookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    ssoExchange: publicProcedure
      .input(
        z.object({
          code: z.string(),
          code_verifier: z.string().optional(),
          redirect_uri: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const cbtEndpoints = [
          process.env.CBT_API_URL,
          'https://cbt.pxxl.click',
          'https://cbt.aurikrex.com',
          'https://cbt-vl4x.onrender.com',
        ].filter(Boolean);

        let response: Response | null = null;

        for (const base of cbtEndpoints) {
          try {
            const cleanBase = base!.replace(/\/+$/, '');
            const targetUrl = cleanBase.endsWith('/api/v1') ? `${cleanBase}/auth/sso/token` : `${cleanBase}/api/v1/auth/sso/token`;
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client_id: 'aurikrex_bytes',
                code: input.code,
                code_verifier: input.code_verifier,
                redirect_uri: input.redirect_uri || 'https://bytes.aurikrex.com/sso/callback',
              }),
            });

            if (res.status !== 404 && res.status !== 405) {
              response = res;
              break;
            }
          } catch (_) {}
        }

        if (!response || !response.ok) {
          const errorData = response ? await response.json().catch(() => ({})) : {};
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: errorData.message || 'SSO Token Exchange failed',
          });
        }

        const tokenData = await response.json();
        const { aurikrex_id, user: ssoUser } = tokenData;

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database error' });

        let [reader] = await db
          .select()
          .from(readers)
          .where(eq(readers.email, ssoUser.email.toLowerCase()))
          .limit(1);

        if (!reader) {
          const [newReader] = await db
            .insert(readers)
            .values({
              email: ssoUser.email.toLowerCase(),
              name: ssoUser.fullName || ssoUser.email.split('@')[0],
            })
            .returning();
          reader = newReader;
        }

        const token = createToken({ id: reader.id, kind: 'reader', email: reader.email, tokenVersion: reader.tokenVersion ?? 1 });
        const cookieOpts = getFirstPartyCookieOptions(ctx.req);
        ctx.res.cookie(READER_COOKIE, token, cookieOpts);

        return {
          success: true,
          reader: { id: reader.id, email: reader.email, name: reader.name, aurikrexId: aurikrex_id },
        };
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
        const email = normalizeEmail(input.email);
        const lockout = checkPasswordAttemptLockout(email);
        if (lockout.locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: lockout.message,
          });
        }

        const admin = await getAdminByEmail(email);
        if (
          !admin ||
          !admin.isActive ||
          !(await verifyPassword(input.password, admin.passwordHash))
        ) {
          recordFailedPasswordAttempt(email);
          throw genericNotFound();
        }

        resetPasswordAttempts(email);
        const token = createToken(
          { kind: "admin", id: admin.id, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion ?? 1 },
          input.remember
        );
        const deviceToken = input.remember ? randomToken() : null;
        const db = await getDb();
        if (db && deviceToken)
          await db
            .update(adminUsers)
            .set({ rememberDeviceToken: hashToken(deviceToken) })
            .where(eq(adminUsers.id, admin.id));
        setSession(ctx, ADMIN_COOKIE, token, input.remember);
        if (deviceToken)
          setSession(ctx, ADMIN_DEVICE_COOKIE, deviceToken, true);
        return { success: true, role: admin.role };
      }),
    session: publicProcedure.query(async ({ ctx }) => requireAdmin(ctx)),
    posts: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      await publishDuePosts();
      return listPosts();
    }),
    post: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        await publishDuePosts();
        const post = await getPostById(input.id);
        if (!post) throw genericNotFound();
        return post;
      }),
    createPost: publicProcedure
      .input(
        z.object({
          headline: z.string().min(1).max(120),
          body: z.string().min(1).max(800),
          category: z.string().optional(),
          imageUrl: z.string().url().refine(isSafePublicHttpsUrl, "Must be a valid public HTTPS URL").optional(),
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
          category: input.category || "Tech",
          status: "draft",
          createdBy: admin.id,
          updatedAt: new Date(),
        });
        return { success: true, id: Number(result.lastInsertRowid) };
      }),
    aiHealth: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const { checkAiHealth } = await import("./_core/aiHealth.js");
      return checkAiHealth();
    }),
    checkAiHealth: publicProcedure.mutation(async ({ ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:create");
      const { checkAiHealth } = await import("./_core/aiHealth.js");
      return checkAiHealth({ forceLiveCheck: true });
    }),
    curateNow: publicProcedure
      .input(
        z
          .object({
            count: z.number().int().min(5).max(30).default(25).optional(),
          })
          .optional()
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:create");
        const { runNightlyCuration } = await import("./_core/aiCurator.js");
        const targetCount = input?.count || 25;
        const count = await runNightlyCuration("draft", admin.email, targetCount);
        return { success: true, count };
      }),
    ingestPdf: publicProcedure
      .input(z.object({ pdfContent: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:create");
        const { parsePdfToBytes } = await import("./_core/pdfParser.js");
        const bytes = await parsePdfToBytes(input.pdfContent);
        const db = await getDb();
        if (!db) throw genericNotFound();
        const now = new Date();
        let count = 0;
        for (const byte of bytes) {
          await db.insert(posts).values({
            headline: byte.headline,
            body: byte.body,
            category: byte.category || "Tech",
            imageUrl: byte.imageUrl,
            status: "draft",
            createdBy: admin.id,
            updatedAt: now,
          });
          count++;
        }
        return { success: true, count, bytes };
      }),
    editPost: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          headline: z.string().min(1).optional(),
          body: z.string().min(1).optional(),
          category: z.string().optional(),
          imageUrl: z.string().url().refine(isSafePublicHttpsUrl, "Must be a valid public HTTPS URL").nullable().optional(),
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
    batchDeletePosts: publicProcedure
      .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:delete");
        const db = await getDb();
        if (!db) throw genericNotFound();
        await db.delete(posts).where(inArray(posts.id, input.ids));
        return { success: true, count: input.ids.length };
      }),
    batchPublishPosts: publicProcedure
      .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:publish");
        const db = await getDb();
        if (!db) throw genericNotFound();
        const now = new Date();
        await db
          .update(posts)
          .set({ status: "published", publishedTime: now, updatedAt: now })
          .where(inArray(posts.id, input.ids));
        return { success: true, count: input.ids.length };
      }),
    batchSchedulePosts: publicProcedure
      .input(
        z.object({
          ids: z.array(z.number().int().positive()).min(1),
          scheduledTime: z.coerce.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "post:schedule");
        const db = await getDb();
        if (!db) throw genericNotFound();
        const now = new Date();
        await db
          .update(posts)
          .set({
            status: "scheduled",
            scheduledTime: input.scheduledTime,
            updatedAt: now,
          })
          .where(inArray(posts.id, input.ids));
        return { success: true, count: input.ids.length };
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
    maintenanceStatus: publicProcedure.query(async () => {
      return { maintenance: await isMaintenanceMode() };
    }),
    setMaintenanceMode: publicProcedure
      .input(
        z.object({
          enabled: z.boolean(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        if (admin.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only administrators can toggle maintenance mode.",
          });
        }
        const expected = process.env.MAINTENANCE_PASSWORD;
        if (!expected) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "MAINTENANCE_PASSWORD is not configured in environment variables.",
          });
        }
        if (!safeStringEqual(input.password, expected)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Incorrect verification password. Action denied.",
          });
        }
        await setMaintenanceMode(input.enabled);
        return { success: true, maintenance: input.enabled };
      }),
    listPushSends: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        const { listRecentPushSends } = await import("./pushLedger.js");
        return await listRecentPushSends(input?.limit ?? 50);
      }),
    resendPushSend: publicProcedure
      .input(
        z.object({
          slot: z.enum(["morning", "evening"]),
          editionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        const { processPushTrigger } = await import("./push.js");
        return await processPushTrigger({
          requestedSlot: input.slot,
          triggerSource: "admin_manual_resend",
          force: true,
          resend: true,
        });
      }),
    testAlertEmail: publicProcedure.mutation(async ({ ctx }) => {
      await requireAdmin(ctx);
      const { sendAdminAlertEmail } = await import("./push.js");
      await sendAdminAlertEmail(
        "[Test Alert] Admin Triggered Verification",
        `<p>This is a test alert confirming your <code>ADMIN_ALERT_EMAIL</code> is configured and receiving system alerts.</p>
         <p>Triggered from: Admin Management Dashboard</p>
         <p>Time: ${new Date().toISOString()}</p>`
      );
      return {
        success: true,
        adminAlertEmailConfigured: Boolean(process.env.ADMIN_ALERT_EMAIL),
      };
    }),
    previewPushNotification: publicProcedure
      .input(z.object({ slot: z.enum(["morning", "evening"]).default("morning") }))
      .query(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        const { formatPushNotificationContent } = await import("./push.js");
        const { listPublishedPosts } = await import("./db.js");
        const posts = await listPublishedPosts();
        const leadStory = posts[0] || null;
        const formatted = formatPushNotificationContent(leadStory, {
          postsCount: Math.max(1, posts.length),
          slot: input.slot,
        });
        return {
          formatted,
          leadStory: leadStory
            ? { id: leadStory.id, headline: leadStory.headline }
            : null,
          totalPublished: posts.length,
        };
      }),
  }),
  reader: router({
    oneSignalAppId: publicProcedure.query(() => ENV.oneSignalAppId),
    registerOneSignalSubscription: publicProcedure
      .input(z.object({ subscriptionId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const session = await requireReader(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(oneSignalSubscriptions).where(and(eq(oneSignalSubscriptions.subscriptionId, input.subscriptionId), eq(oneSignalSubscriptions.readerId, session.id)));
        await db.insert(oneSignalSubscriptions).values({ readerId: session.id, subscriptionId: input.subscriptionId });
        return { success: true };
      }),
    unregisterOneSignalSubscription: publicProcedure
      .input(z.object({ subscriptionId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .delete(oneSignalSubscriptions)
          .where(eq(oneSignalSubscriptions.subscriptionId, input.subscriptionId));
        return { success: true };
      }),
    sendTestPush: publicProcedure
      .input(z.object({ subscriptionId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await requireAdmin(ctx);
        const { sendTestPushNotification } = await import("./push.js");
        return await sendTestPushNotification(input.subscriptionId);
      }),
    setFeedPreference: publicProcedure
      .input(
        z.object({
          feedViewMode: z.enum(["editorial", "compact"]),
          onboardingCompleted: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) =>
        updateReaderFeedPreference(
          (await requireReader(ctx)).id,
          input.feedViewMode,
          input.onboardingCompleted
        )
      ),
    dashboard: publicProcedure
      .input(z.object({ timeZone: z.string().min(1).max(80).default("UTC") }))
      .query(async ({ input, ctx }) => {
        const session = await requireReader(ctx);
        const dashboard = await getReaderDashboard(session.id, input.timeZone);
        if (!dashboard) throw genericNotFound();
        return dashboard;
      }),
    saved: publicProcedure.query(async ({ ctx }) => listSavedPosts((await requireReader(ctx)).id)),
    engagement: publicProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => getReaderPostEngagement(input.postId, (await requireReader(ctx)).id)),
    toggleReaction: publicProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => togglePostReaction(input.postId, (await requireReader(ctx)).id)),
    toggleBookmark: publicProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => togglePostBookmark(input.postId, (await requireReader(ctx)).id)),
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
          email: z.string().email(),
          password: z.string().min(8),
          avatarUrl: z.string().refine(isSafeAvatarUrl, "Invalid avatar URL").optional().nullable(),
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
          avatarUrl: input.avatarUrl || null,
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
        const email = normalizeEmail(input.email);
        const lockout = checkPasswordAttemptLockout(email);
        if (lockout.locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: lockout.message,
          });
        }

        const reader = await getReaderByEmail(email);
        if (
          !reader ||
          !reader.passwordHash ||
          !(await verifyPassword(input.password, reader.passwordHash))
        ) {
          const attempt = recordFailedPasswordAttempt(email);
          if (attempt.autoResetNeeded && reader) {
            try {
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
                  "Security Alert: Reset your Aurikrex Bytes password",
                  resetPasswordEmailHtml(url)
                );
              }
            } catch (err) {
              console.error("[Auth] Failed sending auto password reset email:", err);
            }
          }
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: attempt.message,
          });
        }

        if (!reader.emailVerified)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Please verify your email before signing in",
          });

        resetPasswordAttempts(email);
        const token = createToken(
          {
            kind: "reader",
            id: reader.id,
            email: reader.email,
            verified: Boolean(reader.emailVerified),
            tokenVersion: reader.tokenVersion ?? 1,
          },
          input.remember
        );
        setSession(ctx, READER_COOKIE, token, input.remember);
        return { success: true, emailVerified: Boolean(reader.emailVerified) };
      }),
    session: publicProcedure.query(async ({ ctx }) => {
      const payload = await requireReader(ctx);
      const reader = await getReaderById(payload.id);
      return {
        ...payload,
        name: reader?.name || "",
        nickname: reader?.nickname || null,
        avatarUrl: reader?.avatarUrl || null,
        emailVerified: Boolean(reader?.emailVerified),
      };
    }),
    updateProfile: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Name cannot be empty").max(100),
          nickname: z.string().trim().max(50).optional().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const reader = await requireReader(ctx);
        const updated = await updateReaderProfile(reader.id, {
          name: input.name,
          nickname: input.nickname,
        });
        return {
          success: true,
          reader: updated
            ? {
                id: updated.id,
                name: updated.name,
                nickname: updated.nickname || null,
                email: updated.email,
              }
            : null,
        };
      }),
    avatarUploadSignature: publicProcedure.query(async () => {
      if (!cloudinaryConfigured()) return { configured: false as const };
      return { configured: true as const, ...getCloudinaryUploadSignature("aurikrex/avatars") };
    }),
    updateAvatar: publicProcedure
      .input(z.object({ avatarUrl: z.string().refine(isSafeAvatarUrl, "Invalid avatar URL") }))
      .mutation(async ({ input, ctx }) => {
        const reader = await requireReader(ctx);
        return updateReaderAvatar(reader.id, input.avatarUrl);
      }),
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
            resetPasswordEmailHtml(url)
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
            tokenVersion: (reader.tokenVersion ?? 1) + 1,
          })
          .where(eq(readers.id, reader.id));
        resetPasswordAttempts(reader.email);
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
    list: publicProcedure.query(async () => {
      await publishDuePosts();
      return listPosts();
    }),
    carousel: publicProcedure.query(async () => {
      await publishDuePosts();
      return { posts: await listPublishedPostsForCarousel() };
    }),
    today: publicProcedure.query(async () => {
      await publishDuePosts();
      return listTodaysPublishedPosts();
    }),
    archive: publicProcedure
      .input(
        z.object({
          query: z.string().max(120).default(""),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(24).default(12),
        })
      )
      .query(async ({ input }) => {
        await publishDuePosts();
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
        await publishDuePosts();
        const post = await getPublishedPostById(input.id);
        if (!post) throw genericNotFound();
        await recordPostView(post.id);
        return post;
      }),
    askFollowUp: publicProcedure
      .input(
        z.object({
          postId: z.number().int().positive(),
          question: z.string().min(3).max(300).trim(),
          bypassCache: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await publishDuePosts();
        const post = await getPublishedPostById(input.postId);
        if (!post) throw genericNotFound();

        const {
          computeFollowUpContentHash,
          getCachedFollowUp,
          setCachedFollowUp,
          singleFlightFollowUp,
        } = await import("./aiCache.js");

        const contentHash = computeFollowUpContentHash({
          postId: post.id,
          headline: post.headline,
          body: post.body,
          question: input.question,
        });

        let remainingCoins: number | undefined;
        let nextResetDate: string | undefined;

        const resolveReaderEmail = async () => {
          const readerPayload = await requireReader(ctx).catch(() => null);
          if (!readerPayload) return undefined;
          if (readerPayload.email) return readerPayload.email;
          const r = await getReaderById(readerPayload.id);
          return r?.email;
        };

        // Only authenticated admins can force a cache bypass
        const isAdminCaller = input.bypassCache === true
          ? Boolean(await requireAdmin(ctx).catch(() => null))
          : false;

        // 1. CBT-style Cache Lookup (before coin deduction and upstream Tavily/LLM calls!)
        if (!isAdminCaller) {
          const cached = await getCachedFollowUp(contentHash);
          if (cached && cached.answer) {
            try {
              const readerEmail = await resolveReaderEmail();
              if (readerEmail) {
                const { getCoinBalance } = await import("./_core/central.js");
                const bal = await getCoinBalance(readerEmail);
                if (bal && typeof bal.balance === "number") {
                  remainingCoins = Math.min(bal.balance, 2500);
                  nextResetDate = bal.nextResetDate;
                }
              }
            } catch (_) {}

            return {
              answer: cached.answer,
              searchQueries: cached.searchQueries,
              remainingCoins,
              nextResetDate,
              cached: true,
              contentHash,
            };
          }
        }

        // 2. Cache MISS: Deduct Auri Coins for live AI generation (and block if out of coins)
        try {
          const readerEmail = await resolveReaderEmail();
          if (readerEmail) {
            const { deductCoins } = await import("./_core/central.js");
            const res = await deductCoins(readerEmail, "aurikrex_bytes", "ai_summary");
            if (res?.error && res?.status === 402) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You have run out of Auri Coins for this month.",
              });
            }
            if (res && typeof res.remainingCoins === "number") {
              remainingCoins = Math.min(res.remainingCoins, 2500);
              nextResetDate = res.nextResetDate;
            }
          }
        } catch (coinErr) {
          if (coinErr instanceof TRPCError) throw coinErr;
        }

        // 3. Single-flight coalescing + upstream Tavily & LLM cascade + quality validation + cache write
        const generated = await singleFlightFollowUp(contentHash, async () => {
          const searchQuery = `${post.headline} — ${input.question}`;
          let webContext = "";
          let tavilyDirectAnswer = "";
          let searchQueries: string[] = [];

          const tavilyApiKey = (process.env.TAVILY_API_KEY || "").trim();
          if (tavilyApiKey) {
            try {
              const tavilyRes = await axios.post(
                "https://api.tavily.com/search",
                {
                  api_key: tavilyApiKey,
                  query: searchQuery,
                  max_results: 5,
                  search_depth: "basic",
                  include_answer: true,
                },
                { timeout: 10_000 }
              );
              tavilyDirectAnswer = tavilyRes.data?.answer || "";
              const results: any[] = tavilyRes.data?.results ?? [];
              searchQueries = results.map((r: any) => r.title || r.query).filter(Boolean).slice(0, 3);
              webContext = results
                .map(
                  (r: any, i: number) =>
                    `[${i + 1}] ${r.title}\n${r.content?.slice(0, 400) ?? ""}`
                )
                .join("\n\n");
            } catch (err) {
              console.warn("[FollowUp] Tavily search failed, using story context:", err);
            }
          }

          if (searchQueries.length === 0) {
            searchQueries = [
              `${post.headline.slice(0, 50)}…`,
              `${input.question} overview`,
              `Aurikrex Bytes technical context`,
            ];
          }

          const systemPrompt = `You are an intelligent tech news assistant for Aurikrex Bytes.
The reader is asking a follow-up question regarding the following story:

HEADLINE: ${post.headline}
STORY CONTENT: ${post.body}

${webContext ? `RELEVANT LIVE WEB SEARCH CONTEXT:\n${webContext}` : "No external web search results available."}

Instructions:
1. Provide a direct, insightful, and concise answer to the reader's question in 2-3 clear paragraphs.
2. Synthesize the provided story details and web context into a natural explanation.
3. Keep the tone calm, authoritative, and focused on tech signal rather than hype.
4. Do NOT repeat or copy the original story text verbatim.
5. Do NOT invent false facts.`;

          let answer = "";
          let modelUsed = "";
          const mistralApiKey = getMistralApiKey();
          const nvidiaApiKey = getNvidiaApiKey();

          // 1. Primary: Try Mistral AI models
          if (mistralApiKey) {
            for (const model of ["mistral-small-latest", "open-mistral-7b"]) {
              try {
                const mistralRes = await axios.post(
                  "https://api.mistral.ai/v1/chat/completions",
                  {
                    model,
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: input.question },
                    ],
                    max_tokens: 600,
                    temperature: 0.4,
                  },
                  {
                    headers: { Authorization: `Bearer ${mistralApiKey}` },
                    timeout: 15_000,
                  }
                );
                const text = mistralRes.data?.choices?.[0]?.message?.content ?? "";
                if (text && text.trim()) {
                  answer = text.trim();
                  modelUsed = model;
                  break;
                }
              } catch (mistralErr: any) {
                console.warn(
                  `[FollowUp] Mistral AI model ${model} failed:`,
                  mistralErr instanceof Error ? mistralErr.message : String(mistralErr)
                );
                const is429 = mistralErr?.response?.status === 429 || /429|rate limit/i.test(mistralErr?.message || "");
                const { notifyAiDegradation } = await import("./_core/aiHealth.js");
                void notifyAiDegradation(
                  "Mistral AI",
                  is429 ? "Rate limit reached (HTTP 429)" : `Model ${model} failed (${mistralErr?.message || "error"})`,
                  "Falling back to NVIDIA NIM / Cloudflare Workers AI"
                );
              }
            }
          }

          // 2. Secondary: Fall back to NVIDIA NIM if Mistral failed
          if (!answer && nvidiaApiKey) {
            for (const model of ["meta/llama-3.1-405b-instruct", "mistralai/mistral-large-2407"]) {
              try {
                const nvidiaRes = await axios.post(
                  "https://integrate.api.nvidia.com/v1/chat/completions",
                  {
                    model,
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: input.question },
                    ],
                    max_tokens: 600,
                    temperature: 0.4,
                  },
                  {
                    headers: { Authorization: `Bearer ${nvidiaApiKey}` },
                    timeout: 15_000,
                  }
                );
                const text = nvidiaRes.data?.choices?.[0]?.message?.content ?? "";
                if (text && text.trim()) {
                  answer = text.trim();
                  modelUsed = model;
                  break;
                }
              } catch (nvidiaErr: any) {
                console.warn(
                  `[FollowUp] NVIDIA NIM model ${model} failed:`,
                  nvidiaErr instanceof Error ? nvidiaErr.message : String(nvidiaErr)
                );
                const { notifyAiDegradation } = await import("./_core/aiHealth.js");
                void notifyAiDegradation(
                  "NVIDIA NIM",
                  `Model ${model} unavailable (${nvidiaErr?.message || "error"})`,
                  "Falling back to Cloudflare Workers AI"
                );
              }
            }
          }

          // 3. Tertiary: Fall back to Cloudflare Workers AI if Mistral and NVIDIA failed (multi-account cascade)
          if (!answer) {
            const cfConfigs = getCloudflareAiConfigs();
            for (const cf of cfConfigs) {
              for (const model of ["@cf/meta/llama-3.1-70b-instruct", "@cf/meta/llama-3.1-8b-instruct"]) {
                try {
                  const url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/${model}`;
                  const cfRes = await axios.post(
                    url,
                    {
                      messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: input.question },
                      ],
                      max_tokens: 600,
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${cf.apiToken}`,
                        "Content-Type": "application/json",
                      },
                      timeout: 15_000,
                    }
                  );
                  const text = cfRes.data?.result?.response || cfRes.data?.result?.text || "";
                  if (text && text.trim()) {
                    answer = text.trim();
                    modelUsed = model;
                    break;
                  }
                } catch (cfErr) {
                  console.warn(
                    `[FollowUp] Cloudflare Workers AI model ${model} failed:`,
                    cfErr instanceof Error ? cfErr.message : String(cfErr)
                  );
                }
              }
              if (answer) break;
            }
          }

          // 4. Fallback to Tavily direct web answer if AI endpoints failed
          if (!answer && tavilyDirectAnswer) {
            answer = tavilyDirectAnswer;
            modelUsed = "tavily-direct";
          }

          if (answer) {
            await setCachedFollowUp({
              contentHash,
              postId: post.id,
              question: input.question,
              answer,
              searchQueries,
              modelUsed: modelUsed || "mistral-small-latest",
            });
          } else {
            answer = `Live search and AI analysis are currently updating. Please ensure TAVILY_API_KEY, MISTRAL_API_KEY, NVIDIA_API_KEY, or CLOUDFLARE_API_TOKEN is configured in your environment variables on Vercel to enable live AI web search.`;
          }

          return { answer, searchQueries, modelUsed };
        });

        return {
          answer: generated.answer,
          searchQueries: generated.searchQueries,
          remainingCoins,
          nextResetDate,
          cached: false,
          contentHash,
        };
      }),
    reportFollowUp: publicProcedure
      .input(
        z.object({
          contentHash: z.string().regex(/^[a-f0-9]{64}$/i, "Valid SHA-256 contentHash required"),
          reason: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const isAdminCaller = Boolean(await requireAdmin(ctx).catch(() => null));
        const { invalidateCachedFollowUp } = await import("./aiCache.js");
        const invalidated = await invalidateCachedFollowUp(
          input.contentHash,
          input.reason || "reported",
          { force: isAdminCaller }
        );
        return { success: true, invalidated };
      }),
  }),
});

export type AppRouter = typeof appRouter;
