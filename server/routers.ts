import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminUsers, posts, readers } from "../drizzle/schema";
import { createToken, hashPassword, isValidPassword, normalizeEmail, randomToken, readToken, verifyPassword } from "./auth";
import { getAdminByEmail, getAdminByRememberToken, getDb, getReaderByEmail, getReaderByResetToken, getReaderByVerificationToken, listPosts } from "./db";
import { cloudinaryConfigured, getCloudinaryUploadSignature, sendAuthEmail } from "./services";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const ADMIN_COOKIE = "aurikrex_admin_session";
const ADMIN_DEVICE_COOKIE = "aurikrex_admin_device";
const READER_COOKIE = "aurikrex_reader_session";
const GOOGLE_STATE_COOKIE = "aurikrex_google_state";
const GOOGLE_NONCE_COOKIE = "aurikrex_google_nonce";
const genericNotFound = () => new TRPCError({ code: "NOT_FOUND", message: "Not found" });
function cookies(req: { headers: { cookie?: string } }) { return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => { const [key, ...value] = part.trim().split("="); return [key, decodeURIComponent(value.join("="))]; })); }
function setSession(ctx: { res: { cookie: Function }; req: any }, name: string, token: string, remember: boolean) { ctx.res.cookie(name, token, { ...getSessionCookieOptions(ctx.req), maxAge: remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12 }); }

async function requireAdmin(ctx: { req: any }) {
  const parsed = cookies(ctx.req);
  const token = parsed[ADMIN_COOKIE];
  const payload = token ? readToken(token) : null;
  if (payload && payload.kind === "admin") return payload;
  const remembered = parsed[ADMIN_DEVICE_COOKIE] ? await getAdminByRememberToken(parsed[ADMIN_DEVICE_COOKIE]) : undefined;
  if (remembered) return { kind: "admin" as const, id: remembered.id, email: remembered.email, role: remembered.role };
  throw genericNotFound();
}
async function requireReader(ctx: { req: any }) {
  const token = cookies(ctx.req)[READER_COOKIE];
  const payload = token ? readToken(token) : null;
  if (!payload || payload.kind !== "reader") throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  return payload;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  admin: router({
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string(), remember: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const admin = await getAdminByEmail(normalizeEmail(input.email));
      if (!admin || !(await verifyPassword(input.password, admin.passwordHash))) throw genericNotFound();
      const token = createToken({ kind: "admin", id: admin.id, email: admin.email, role: admin.role }, input.remember);
      const deviceToken = input.remember ? randomToken() : null;
      const db = await getDb();
      if (db && deviceToken) await db.update(adminUsers).set({ rememberDeviceToken: deviceToken }).where(eq(adminUsers.id, admin.id));
      setSession(ctx, ADMIN_COOKIE, token, input.remember);
      if (deviceToken) setSession(ctx, ADMIN_DEVICE_COOKIE, deviceToken, true);
      return { success: true, role: admin.role };
    }),
    session: publicProcedure.query(async ({ ctx }) => requireAdmin(ctx)),
    posts: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx); return listPosts(); }),
    createPost: publicProcedure.input(z.object({ headline: z.string().min(1), body: z.string().min(1), imageUrl: z.string().url().optional(), status: z.enum(["draft", "pending_review", "scheduled", "published"]).default("draft"), scheduledTime: z.coerce.date().optional() })).mutation(async ({ input, ctx }) => { const admin = await requireAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured" }); const publishedTime = input.status === "published" ? new Date() : null; await db.insert(posts).values({ headline: input.headline, body: input.body, imageUrl: input.imageUrl, status: input.status, scheduledTime: input.scheduledTime, publishedTime, createdBy: admin.id, updatedAt: new Date() }); return { success: true }; }),
    cloudinarySignature: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx); if (!cloudinaryConfigured()) return { configured: false }; return { configured: true, ...getCloudinaryUploadSignature() }; }),
  }),
  reader: router({
    signup: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => {
      if (!isValidPassword(input.password)) throw new TRPCError({ code: "BAD_REQUEST", message: "Password must be at least 8 characters" });
      const email = normalizeEmail(input.email); if (await getReaderByEmail(email)) throw new TRPCError({ code: "CONFLICT", message: "An account already exists" });
      const verificationToken = randomToken(); const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      await db.insert(readers).values({ email, passwordHash: await hashPassword(input.password), verificationToken, emailVerified: false });
      const url = `${process.env.APP_BASE_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`;
      await sendAuthEmail(email, "Verify your Aurikrex Bytes account", `<p>Verify your account: <a href="${url}">${url}</a></p>`);
      return { success: true, verificationRequired: true };
    }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string(), remember: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email)); if (!reader || !reader.passwordHash || !(await verifyPassword(input.password, reader.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      const token = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: Boolean(reader.emailVerified) }, input.remember); setSession(ctx, READER_COOKIE, token, input.remember);
      return { success: true, emailVerified: Boolean(reader.emailVerified) };
    }),
    session: publicProcedure.query(async ({ ctx }) => requireReader(ctx)),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(10) })).mutation(async ({ input }) => { const reader = await getReaderByVerificationToken(input.token); if (!reader) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired verification token" }); const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured" }); await db.update(readers).set({ emailVerified: true, verificationToken: null }).where(eq(readers.id, reader.id)); return { success: true }; }),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ input }) => { const reader = await getReaderByEmail(normalizeEmail(input.email)); if (!reader) return { success: true }; const token = randomToken(); const db = await getDb(); if (db) { await db.update(readers).set({ resetToken: token, resetTokenExpires: new Date(Date.now() + 1000 * 60 * 30) }).where(eq(readers.id, reader.id)); const url = `${process.env.APP_BASE_URL || "http://localhost:3000"}/reset-password?token=${token}`; await sendAuthEmail(reader.email, "Reset your Aurikrex Bytes password", `<p>Reset your password: <a href="${url}">${url}</a></p>`); } return { success: true }; }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(10), password: z.string().min(8) })).mutation(async ({ input }) => { const reader = await getReaderByResetToken(input.token); if (!reader) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" }); const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured" }); await db.update(readers).set({ passwordHash: await hashPassword(input.password), resetToken: null, resetTokenExpires: null }).where(eq(readers.id, reader.id)); return { success: true }; }),
    googleStart: publicProcedure.query(({ ctx }) => { const state = randomToken(); const nonce = randomToken(); ctx.res.cookie(GOOGLE_STATE_COOKIE, state, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 10 }); ctx.res.cookie(GOOGLE_NONCE_COOKIE, nonce, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 10 }); const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state, nonce }); return { configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }; }),
  }),
  publicPosts: router({ list: publicProcedure.query(() => listPosts()) }),
});

export type AppRouter = typeof appRouter;
