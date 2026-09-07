// server/_core/vercel.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { createClient } from "@libsql/client";
import { and, asc, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

// drizzle/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
var now = () => /* @__PURE__ */ new Date();
var POST_STATUSES = ["draft", "pending_review", "scheduled", "published"];
var ADMIN_ROLES = ["admin", "editor"];
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("open_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("login_method"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  lastSignedIn: integer("last_signed_in", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});
var posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageUrl: text("image_url"),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: POST_STATUSES }).notNull().default("draft"),
  scheduledTime: integer("scheduled_time", { mode: "timestamp_ms" }),
  publishedTime: integer("published_time", { mode: "timestamp_ms" }),
  rejectionNote: text("rejection_note"),
  createdBy: integer("created_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});
var adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ADMIN_ROLES }).notNull().default("editor"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  rememberDeviceToken: text("remember_device_token"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});
var readers = sqliteTable("readers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpires: integer("reset_token_expires", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});
var postViews = sqliteTable("post_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull(),
  readerId: integer("reader_id"),
  viewedAt: integer("viewed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});
var searchQueries = sqliteTable("search_queries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  searchedAt: integer("searched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};
function appBaseUrl() {
  return (process.env.APP_BASE_URL || (ENV.isProduction ? "" : "http://localhost:3000")).replace(/\/$/, "");
}
function validateProductionEnvironment() {
  if (!ENV.isProduction) return [];
  const issues = [];
  const secret2 = process.env.JWT_SECRET || "";
  if (secret2.length < 32 || /local|dev|placeholder|change[-_ ]?me|secret/i.test(secret2)) {
    issues.push("JWT_SECRET must be a strong, production-only secret of at least 32 characters");
  }
  if (!appBaseUrl().startsWith("https://")) issues.push("APP_BASE_URL must be an HTTPS production URL");
  return issues;
}

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.TURSO_DATABASE_URL) {
    try {
      _db = drizzle(createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date(), lastSignedIn: /* @__PURE__ */ new Date() };
  const updateSet = { updatedAt: /* @__PURE__ */ new Date(), lastSignedIn: /* @__PURE__ */ new Date() };
  for (const field of ["name", "email", "loginMethod", "role"]) if (user[field] !== void 0) {
    values[field] = user[field];
    updateSet[field] = user[field];
  }
  if (user.openId === ENV.ownerOpenId && user.role === void 0) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getAdminByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase())).limit(1);
  return result[0];
}
async function getAdminById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return result[0];
}
async function getAdminByRememberToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.rememberDeviceToken, token)).limit(1);
  return result[0];
}
async function listAdmins() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role, isActive: adminUsers.isActive, createdAt: adminUsers.createdAt }).from(adminUsers).orderBy(adminUsers.createdAt);
}
async function getReaderByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.email, email.toLowerCase())).limit(1);
  return result[0];
}
async function getReaderByVerificationToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.verificationToken, token)).limit(1);
  return result[0];
}
async function getReaderByResetToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(and(eq(readers.resetToken, token), gt(readers.resetTokenExpires, /* @__PURE__ */ new Date()))).limit(1);
  return result[0];
}
async function listPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(posts.updatedAt);
}
async function getPostById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0];
}
async function publishDuePosts() {
  const db = await getDb();
  if (!db) return 0;
  const due = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.status, "scheduled"), lt(posts.scheduledTime, /* @__PURE__ */ new Date())));
  for (const post of due) await db.update(posts).set({ status: "published", publishedTime: /* @__PURE__ */ new Date(), scheduledTime: null, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(posts.id, post.id), eq(posts.status, "scheduled")));
  return due.length;
}
async function listPublishedPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: posts.id, headline: posts.headline, imageUrl: posts.imageUrl, publishedTime: posts.publishedTime, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedTime), desc(posts.id));
}
function localCalendarDay(value, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
async function listTodaysPublishedPosts(timeZone = process.env.APP_TIMEZONE || "UTC") {
  const db = await getDb();
  if (!db) return [];
  const today = localCalendarDay(/* @__PURE__ */ new Date(), timeZone);
  const published = await db.select().from(posts).where(eq(posts.status, "published")).orderBy(asc(posts.publishedTime));
  return published.filter((post) => post.publishedTime && localCalendarDay(post.publishedTime, timeZone) === today);
}
async function getPublishedPostById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.status, "published"))).limit(1);
  return result[0];
}
async function searchPublishedPosts(query, page, pageSize) {
  const db = await getDb();
  if (!db) return { posts: [], nextPage: null };
  const normalizedQuery = query.trim().toLowerCase();
  const search = normalizedQuery ? or(like(posts.headline, `%${normalizedQuery}%`), like(posts.body, `%${normalizedQuery}%`)) : void 0;
  const where = search ? and(eq(posts.status, "published"), search) : eq(posts.status, "published");
  const rows = await db.select().from(posts).where(where).orderBy(desc(posts.publishedTime), desc(posts.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { posts: rows.slice(0, pageSize), nextPage: rows.length > pageSize ? page + 1 : null };
}
async function recordPostView(postId, readerId) {
  const db = await getDb();
  if (db) await db.insert(postViews).values({ postId, readerId: readerId ?? null, viewedAt: /* @__PURE__ */ new Date() });
}
async function recordSearchQuery(query) {
  const normalized = query.trim().toLowerCase();
  const db = await getDb();
  if (db && normalized) await db.insert(searchQueries).values({ query: normalized, searchedAt: /* @__PURE__ */ new Date() });
}
async function getAnalytics() {
  const db = await getDb();
  if (!db) return { totalReaders: 0, totalViews: 0, mostRead: [], topSearches: [], viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 })) };
  const [published, views, searches, readerRows] = await Promise.all([db.select({ id: posts.id, headline: posts.headline, status: posts.status }).from(posts).where(eq(posts.status, "published")), db.select().from(postViews), db.select().from(searchQueries), db.select({ id: readers.id }).from(readers)]);
  const titles = new Map(published.map((post) => [post.id, post.headline]));
  const viewCounts = /* @__PURE__ */ new Map();
  const hourCounts = /* @__PURE__ */ new Map();
  for (const view of views) {
    if (!titles.has(view.postId)) continue;
    viewCounts.set(view.postId, (viewCounts.get(view.postId) || 0) + 1);
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }).format(new Date(view.viewedAt))) % 24;
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }
  const searchCounts = /* @__PURE__ */ new Map();
  for (const entry of searches) searchCounts.set(entry.query, (searchCounts.get(entry.query) || 0) + 1);
  return { totalReaders: readerRows.length, totalViews: views.length, mostRead: Array.from(viewCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, viewCount]) => ({ id, headline: titles.get(id), viewCount })), topSearches: Array.from(searchCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })), viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: hourCounts.get(hour) || 0 })) };
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret2 = ENV.cookieSecret;
    return new TextEncoder().encode(secret2);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies2 = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies2.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error instanceof Error ? error.message : "Unknown error");
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now2 = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now2,
    updatedAt: now2,
    lastSignedIn: now2,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/google-auth.ts
import { OAuth2Client } from "google-auth-library";
import { eq as eq2 } from "drizzle-orm";

// server/auth.ts
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
var secret = () => {
  if (process.env.NODE_ENV === "production" && !ENV.cookieSecret) {
    throw new Error("Missing strong cookieSecret in production. Startup failed closed for security.");
  }
  return ENV.cookieSecret || "development-only-secret";
};
function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function createToken(payload, remember = false) {
  return jwt.sign(payload, secret(), { expiresIn: remember ? "30d" : "12h" });
}
function readToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}
function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function isValidPassword(password) {
  return password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

// server/google-auth.ts
function registerGoogleAuthRoutes(app) {
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookieValue = (name) => (req.headers.cookie || "").split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.split("=")[1] || "";
    const storedState = cookieValue("aurikrex_google_state");
    const storedNonce = cookieValue("aurikrex_google_nonce");
    if (!code || !state || !storedState || state !== decodeURIComponent(storedState) || !storedNonce || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.redirect("/login?error=oauth");
    res.clearCookie("aurikrex_google_state", { ...getSessionCookieOptions(req), maxAge: -1 });
    res.clearCookie("aurikrex_google_nonce", { ...getSessionCookieOptions(req), maxAge: -1 });
    try {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${appBaseUrl()}/api/auth/google/callback`);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token || "", audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.email || payload.nonce !== decodeURIComponent(storedNonce)) return res.redirect("/login?error=oauth");
      const db = await getDb();
      if (!db) return res.redirect("/login?error=database");
      let reader = await getReaderByEmail(payload.email);
      if (!reader) {
        await db.insert(readers).values({ name: payload.name || "", email: payload.email.toLowerCase(), googleId: payload.sub, emailVerified: true, verificationToken: null, passwordHash: null });
        reader = await getReaderByEmail(payload.email);
      } else if (reader.googleId && reader.googleId !== payload.sub) return res.redirect("/login?error=oauth");
      else if (!reader.googleId) {
        await db.update(readers).set({ googleId: payload.sub, emailVerified: true, verificationToken: null }).where(eq2(readers.id, reader.id));
      }
      if (!reader) return res.redirect("/login?error=oauth");
      const session = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: true }, true);
      res.cookie("aurikrex_reader_session", session, { ...getSessionCookieOptions(req), maxAge: 1e3 * 60 * 60 * 24 * 30 });
      return res.redirect("/");
    } catch (error) {
      console.error("[Google OAuth] callback failed", error instanceof Error ? error.message : "Unknown error");
      return res.redirect("/login?error=oauth");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { eq as eq3 } from "drizzle-orm";
import { z as z2 } from "zod";

// server/services.ts
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
function mailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    dkim: process.env.SMTP_DKIM_PRIVATE_KEY && process.env.SMTP_DKIM_DOMAIN && process.env.SMTP_DKIM_SELECTOR ? { domainName: process.env.SMTP_DKIM_DOMAIN, keySelector: process.env.SMTP_DKIM_SELECTOR, privateKey: process.env.SMTP_DKIM_PRIVATE_KEY } : void 0
  });
}
async function sendEmail(to, subject, html, fromAddress) {
  const transport = mailTransport();
  if (!transport) {
    console.info(`[Email placeholder] ${subject} for ${to}`);
    return;
  }
  const from = fromAddress || process.env.SMTP_FROM || "info@aurikrex.tech";
  await transport.sendMail({ from, to, subject, html });
}
async function sendAuthEmail(to, subject, html) {
  await sendEmail(to, subject, html, process.env.SMTP_FROM || "info@aurikrex.tech");
}
function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}
function getCloudinaryUploadSignature(folder = "aurikrex/posts") {
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const timestamp = Math.floor(Date.now() / 1e3);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET || "");
  return { timestamp, folder, signature, apiKey: process.env.CLOUDINARY_API_KEY || "", cloudName: process.env.CLOUDINARY_CLOUD_NAME || "" };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/permissions.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var permissions = {
  admin: /* @__PURE__ */ new Set([
    "post:create",
    "post:edit",
    "post:delete",
    "post:publish",
    "post:schedule",
    "post:unschedule",
    "post:submit",
    "post:review",
    "users:manage",
    "analytics:view"
  ]),
  editor: /* @__PURE__ */ new Set(["post:create", "post:edit", "post:submit"])
};
function hasPermission(role, permission) {
  return permissions[role]?.has(permission) ?? false;
}
function assertPermission(role, permission) {
  if (!hasPermission(role, permission)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: `Role ${role} cannot perform ${permission}` });
  }
}
function assertActiveAdmin(admin) {
  if (!admin.isActive) throw new TRPCError3({ code: "FORBIDDEN", message: "This account is inactive" });
  return admin;
}
function canTransitionPost(role, from, to) {
  if (from === "draft" && to === "pending_review") return role === "editor" || role === "admin";
  if (from === "draft" && (to === "scheduled" || to === "published")) return role === "admin";
  if (from === "pending_review" && (to === "scheduled" || to === "published")) return role === "admin";
  if (from === "scheduled" && to === "draft") return role === "admin";
  return false;
}
function assertPostTransition(role, from, to) {
  if (!canTransitionPost(role, from, to)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: `Role ${role} cannot transition post from ${from} to ${to}` });
  }
}

// server/routers.ts
var ADMIN_COOKIE = "aurikrex_admin_session";
var ADMIN_DEVICE_COOKIE = "aurikrex_admin_device";
var READER_COOKIE = "aurikrex_reader_session";
var GOOGLE_STATE_COOKIE = "aurikrex_google_state";
var GOOGLE_NONCE_COOKIE = "aurikrex_google_nonce";
var genericNotFound = () => new TRPCError4({ code: "NOT_FOUND", message: "Not found" });
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}
function setSession(ctx, name, token, remember) {
  ctx.res.cookie(name, token, { ...getSessionCookieOptions(ctx.req), maxAge: remember ? 1e3 * 60 * 60 * 24 * 30 : 1e3 * 60 * 60 * 12 });
}
async function requireAdmin(ctx) {
  const parsed = cookies(ctx.req);
  const token = parsed[ADMIN_COOKIE];
  const payload = token ? readToken(token) : null;
  if (payload && payload.kind === "admin") {
    const admin = await getAdminById(payload.id);
    if (admin) return assertActiveAdmin(admin);
  }
  const remembered = parsed[ADMIN_DEVICE_COOKIE] ? await getAdminByRememberToken(parsed[ADMIN_DEVICE_COOKIE]) : void 0;
  if (remembered) return assertActiveAdmin(remembered);
  throw genericNotFound();
}
async function requireReader(ctx) {
  const token = cookies(ctx.req)[READER_COOKIE];
  const payload = token ? readToken(token) : null;
  if (!payload || payload.kind !== "reader") throw new TRPCError4({ code: "UNAUTHORIZED", message: "Sign in required" });
  return payload;
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      for (const name of [COOKIE_NAME, "aurikrex_admin_session", "aurikrex_admin_device", "aurikrex_reader_session", GOOGLE_STATE_COOKIE, GOOGLE_NONCE_COOKIE]) ctx.res.clearCookie(name, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  admin: router({
    login: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string(), remember: z2.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const admin = await getAdminByEmail(normalizeEmail(input.email));
      if (!admin || !admin.isActive || !await verifyPassword(input.password, admin.passwordHash)) throw genericNotFound();
      const token = createToken({ kind: "admin", id: admin.id, email: admin.email, role: admin.role }, input.remember);
      const deviceToken = input.remember ? randomToken() : null;
      const db = await getDb();
      if (db && deviceToken) await db.update(adminUsers).set({ rememberDeviceToken: deviceToken }).where(eq3(adminUsers.id, admin.id));
      setSession(ctx, ADMIN_COOKIE, token, input.remember);
      if (deviceToken) setSession(ctx, ADMIN_DEVICE_COOKIE, deviceToken, true);
      return { success: true, role: admin.role };
    }),
    session: publicProcedure.query(async ({ ctx }) => requireAdmin(ctx)),
    posts: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      return listPosts();
    }),
    post: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const post = await getPostById(input.id);
      if (!post) throw genericNotFound();
      return post;
    }),
    createPost: publicProcedure.input(z2.object({ headline: z2.string().min(1).max(120), body: z2.string().min(1).max(800), imageUrl: z2.string().url().optional() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:create");
      const db = await getDb();
      if (!db) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      const result = await db.insert(posts).values({ ...input, status: "draft", createdBy: admin.id, updatedAt: /* @__PURE__ */ new Date() });
      return { success: true, id: Number(result.lastInsertRowid) };
    }),
    editPost: publicProcedure.input(z2.object({ id: z2.number().int().positive(), headline: z2.string().min(1).optional(), body: z2.string().min(1).optional(), imageUrl: z2.string().url().nullable().optional() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:edit");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      const { id, ...changes } = input;
      await db.update(posts).set({ ...changes, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, id));
      return { success: true };
    }),
    deletePost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:delete");
      const db = await getDb();
      if (!db || !await getPostById(input.id)) throw genericNotFound();
      await db.delete(posts).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    submitPost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:submit");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "pending_review");
      await db.update(posts).set({ status: "pending_review", rejectionNote: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    publishPost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:publish");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "published");
      await db.update(posts).set({ status: "published", publishedTime: /* @__PURE__ */ new Date(), scheduledTime: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    schedulePost: publicProcedure.input(z2.object({ id: z2.number().int().positive(), scheduledTime: z2.coerce.date() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:schedule");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "scheduled");
      if (input.scheduledTime <= /* @__PURE__ */ new Date()) throw new TRPCError4({ code: "BAD_REQUEST", message: "scheduledTime must be in the future" });
      await db.update(posts).set({ status: "scheduled", scheduledTime: input.scheduledTime, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    unschedulePost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:unschedule");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "draft");
      if (!post.scheduledTime || post.scheduledTime <= /* @__PURE__ */ new Date()) throw new TRPCError4({ code: "BAD_REQUEST", message: "Only future scheduled posts can be cancelled" });
      await db.update(posts).set({ status: "draft", scheduledTime: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    approvePost: publicProcedure.input(z2.object({ id: z2.number().int().positive(), scheduledTime: z2.coerce.date().optional() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:review");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      if (input.scheduledTime && input.scheduledTime <= /* @__PURE__ */ new Date()) throw new TRPCError4({ code: "BAD_REQUEST", message: "scheduledTime must be in the future" });
      const next = input.scheduledTime ? "scheduled" : "published";
      assertPostTransition(admin.role, post.status, next);
      await db.update(posts).set({ status: next, scheduledTime: input.scheduledTime ?? null, publishedTime: input.scheduledTime ? null : /* @__PURE__ */ new Date(), rejectionNote: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true, status: next };
    }),
    rejectPost: publicProcedure.input(z2.object({ id: z2.number().int().positive(), rejectionNote: z2.string().max(2e3).optional() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:review");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "draft");
      await db.update(posts).set({ status: "draft", rejectionNote: input.rejectionNote ?? null, scheduledTime: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posts.id, input.id));
      return { success: true };
    }),
    users: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        return listAdmins();
      }),
      create: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string().min(8), role: z2.enum(["admin", "editor"]).default("editor") })).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        const db = await getDb();
        if (!db) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
        const email = normalizeEmail(input.email);
        if (await getAdminByEmail(email)) throw new TRPCError4({ code: "CONFLICT", message: "An account already exists" });
        await db.insert(adminUsers).values({ email, passwordHash: await hashPassword(input.password), role: input.role, isActive: true });
        return { success: true };
      }),
      changeRole: publicProcedure.input(z2.object({ id: z2.number().int().positive(), role: z2.enum(["admin", "editor"]) })).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        const db = await getDb();
        if (!db || !await getAdminById(input.id)) throw genericNotFound();
        await db.update(adminUsers).set({ role: input.role }).where(eq3(adminUsers.id, input.id));
        return { success: true };
      }),
      revoke: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        if (input.id === admin.id) throw new TRPCError4({ code: "BAD_REQUEST", message: "You cannot revoke your own account" });
        const db = await getDb();
        if (!db || !await getAdminById(input.id)) throw genericNotFound();
        await db.update(adminUsers).set({ isActive: false, rememberDeviceToken: null }).where(eq3(adminUsers.id, input.id));
        return { success: true };
      })
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
    })
  }),
  reader: router({
    signup: publicProcedure.input(z2.object({ name: z2.string().trim().min(1).max(120), email: z2.string().email(), password: z2.string().min(8) })).mutation(async ({ input }) => {
      if (!isValidPassword(input.password)) throw new TRPCError4({ code: "BAD_REQUEST", message: "Password must be at least 8 characters and include a number and symbol" });
      const email = normalizeEmail(input.email);
      if (await getReaderByEmail(email)) throw new TRPCError4({ code: "CONFLICT", message: "An account already exists" });
      const verificationToken = randomToken();
      const db = await getDb();
      if (!db) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      await db.insert(readers).values({ name: input.name.trim(), email, passwordHash: await hashPassword(input.password), verificationToken, emailVerified: false });
      const url = `${appBaseUrl()}/verify-email?token=${verificationToken}`;
      await sendAuthEmail(email, "Verify your Aurikrex Bytes account", `<p>Verify your account: <a href="${url}">${url}</a></p>`);
      return { success: true, verificationRequired: true };
    }),
    login: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string(), remember: z2.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email));
      if (!reader || !reader.passwordHash || !await verifyPassword(input.password, reader.passwordHash)) throw new TRPCError4({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      if (!reader.emailVerified) throw new TRPCError4({ code: "FORBIDDEN", message: "Please verify your email before signing in" });
      const token = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: Boolean(reader.emailVerified) }, input.remember);
      setSession(ctx, READER_COOKIE, token, input.remember);
      return { success: true, emailVerified: Boolean(reader.emailVerified) };
    }),
    session: publicProcedure.query(async ({ ctx }) => requireReader(ctx)),
    verifyEmail: publicProcedure.input(z2.object({ token: z2.string().min(10) })).mutation(async ({ input }) => {
      const reader = await getReaderByVerificationToken(input.token);
      if (!reader) throw new TRPCError4({ code: "BAD_REQUEST", message: "Invalid or expired verification token" });
      const db = await getDb();
      if (!db) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      await db.update(readers).set({ emailVerified: true, verificationToken: null }).where(eq3(readers.id, reader.id));
      return { success: true };
    }),
    requestPasswordReset: publicProcedure.input(z2.object({ email: z2.string().email() })).mutation(async ({ input }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email));
      if (!reader) return { success: true };
      const token = randomToken();
      const db = await getDb();
      if (db) {
        await db.update(readers).set({ resetToken: token, resetTokenExpires: new Date(Date.now() + 1e3 * 60 * 30) }).where(eq3(readers.id, reader.id));
        const url = `${appBaseUrl()}/reset-password?token=${token}`;
        await sendAuthEmail(reader.email, "Reset your Aurikrex Bytes password", `<p>Reset your password: <a href="${url}">${url}</a></p>`);
      }
      return { success: true };
    }),
    resetPassword: publicProcedure.input(z2.object({ token: z2.string().min(10), password: z2.string().min(8) })).mutation(async ({ input }) => {
      if (!isValidPassword(input.password)) throw new TRPCError4({ code: "BAD_REQUEST", message: "Password must be at least 8 characters and include a number and symbol" });
      const reader = await getReaderByResetToken(input.token);
      if (!reader) throw new TRPCError4({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
      const db = await getDb();
      if (!db) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      await db.update(readers).set({ passwordHash: await hashPassword(input.password), resetToken: null, resetTokenExpires: null }).where(eq3(readers.id, reader.id));
      return { success: true };
    }),
    googleStart: publicProcedure.query(({ ctx }) => {
      const state = randomToken();
      const nonce = randomToken();
      ctx.res.cookie(GOOGLE_STATE_COOKIE, state, { ...getSessionCookieOptions(ctx.req), maxAge: 1e3 * 60 * 10 });
      ctx.res.cookie(GOOGLE_NONCE_COOKIE, nonce, { ...getSessionCookieOptions(ctx.req), maxAge: 1e3 * 60 * 10 });
      const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: `${appBaseUrl()}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state, nonce });
      return { configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
    })
  }),
  publicPosts: router({
    list: publicProcedure.query(() => listPosts()),
    today: publicProcedure.query(() => listTodaysPublishedPosts()),
    archive: publicProcedure.input(z2.object({ query: z2.string().max(120).default(""), page: z2.number().int().min(1).default(1), pageSize: z2.number().int().min(1).max(24).default(12) })).query(async ({ input }) => {
      const result = await searchPublishedPosts(input.query, input.page, input.pageSize);
      if (input.query.trim() && input.page === 1) await recordSearchQuery(input.query);
      return result;
    }),
    byId: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      const post = await getPublishedPostById(input.id);
      if (!post) throw genericNotFound();
      await recordPostView(post.id);
      return post;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/seoRoutes.ts
var siteUrl = () => (process.env.APP_BASE_URL || "https://aurikrex.tech").replace(/\/$/, "");
var xmlEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function registerSeoRoutes(app) {
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /falcon-system-auth", "Disallow: /api", `Sitemap: ${siteUrl()}/sitemap.xml`, ""].join("\n"));
  });
  app.get("/sitemap.xml", async (_req, res) => {
    const staticPaths = ["/", "/archive", "/how-it-works", "/help", "/contact", "/privacy", "/terms"];
    const urls = staticPaths.map((path) => `<url><loc>${xmlEscape(`${siteUrl()}${path}`)}</loc></url>`);
    try {
      const posts2 = await listPublishedPosts();
      for (const post of posts2) {
        const lastmod = post.publishedTime || post.updatedAt;
        urls.push(`<url><loc>${xmlEscape(`${siteUrl()}/post/${post.id}`)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`);
      }
    } catch (error) {
      console.warn("[SEO] Sitemap could not load published posts:", error instanceof Error ? error.message : String(error));
    }
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  });
}

// server/_core/security.ts
var authAttempts = /* @__PURE__ */ new Map();
var AUTH_WINDOW_MS = 6e4;
var AUTH_MAX_REQUESTS = 30;
function securityHeaders(_req, res, next) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://accounts.google.com https://maps.googleapis.com; connect-src 'self' https: wss:; frame-src https://accounts.google.com; form-action 'self' https://accounts.google.com");
  if (process.env.NODE_ENV === "production" && process.env.APP_BASE_URL?.startsWith("https://")) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
function authRateLimit(req, res, next) {
  if (!req.originalUrl.startsWith("/api/trpc/")) return next();
  const route = req.originalUrl.split("?")[0];
  if (!/\/(reader\.(signup|login|requestPasswordReset|resetPassword|verifyEmail)|admin\.login)$/.test(route)) return next();
  const key = `${req.ip || req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "unknown"}:${route}`;
  const now2 = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now2) authAttempts.set(key, { count: 1, resetAt: now2 + AUTH_WINDOW_MS });
  else current.count += 1;
  const attempt = authAttempts.get(key);
  res.setHeader("RateLimit-Limit", AUTH_MAX_REQUESTS);
  res.setHeader("RateLimit-Remaining", Math.max(0, AUTH_MAX_REQUESTS - attempt.count));
  if (attempt.count > AUTH_MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((attempt.resetAt - now2) / 1e3)));
    return res.status(429).json({ error: "Too many authentication requests. Please try again shortly." });
  }
  next();
}

// server/_core/vercel.ts
async function setupApp() {
  const environmentIssues = validateProductionEnvironment();
  if (environmentIssues.length) {
    console.error(`[Environment] Production configuration incomplete: ${environmentIssues.join("; ")}`);
  }
  const app = express();
  app.use(securityHeaders);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerSeoRoutes(app);
  app.get("/api/cron/publish", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
    try {
      return res.json({ published: await publishDuePosts() });
    } catch (error) {
      console.error("[Cron] publish failed", error);
      return res.status(500).json({ error: "Publish job failed" });
    }
  });
  app.use(authRateLimit);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
var cachedApp = null;
async function handler(req, res) {
  try {
    if (!cachedApp) cachedApp = await setupApp();
    return cachedApp(req, res);
  } catch (error) {
    console.error("Vercel Handler Error:", error);
    res.status(500).json({
      error: "Fatal Vercel Handler Error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
export {
  handler as default
};
