var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
var now, POST_STATUSES, ADMIN_ROLES, users, posts, adminUsers, readers, postViews, postReactions, postBookmarks, searchQueries, pushSubscriptions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    now = () => /* @__PURE__ */ new Date();
    POST_STATUSES = [
      "draft",
      "pending_review",
      "scheduled",
      "published"
    ];
    ADMIN_ROLES = ["admin", "editor"];
    users = sqliteTable("users", {
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
    posts = sqliteTable("posts", {
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
    adminUsers = sqliteTable("admin_users", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash").notNull(),
      role: text("role", { enum: ADMIN_ROLES }).notNull().default("editor"),
      isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
      rememberDeviceToken: text("remember_device_token"),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    });
    readers = sqliteTable("readers", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      name: text("name").notNull().default(""),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash"),
      googleId: text("google_id").unique(),
      emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
      verificationToken: text("verification_token"),
      verificationTokenUsed: text("verification_token_used"),
      resetToken: text("reset_token"),
      resetTokenExpires: integer("reset_token_expires", { mode: "timestamp_ms" }),
      currentStreak: integer("current_streak").notNull().default(0),
      longestStreak: integer("longest_streak").notNull().default(0),
      lastActiveDate: text("last_active_date"),
      feedViewMode: text("feed_view_mode", { enum: ["editorial", "compact"] }).notNull().default("editorial"),
      feedViewOnboardingCompleted: integer("feed_view_onboarding_completed", { mode: "boolean" }).notNull().default(false),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    });
    postViews = sqliteTable("post_views", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      postId: integer("post_id").notNull(),
      readerId: integer("reader_id"),
      viewedAt: integer("viewed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    });
    postReactions = sqliteTable("post_reactions", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      postId: integer("post_id").notNull(),
      readerId: integer("reader_id").notNull(),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    }, (table) => ({ postReaderUnique: uniqueIndex("post_reactions_post_reader_unique").on(table.postId, table.readerId) }));
    postBookmarks = sqliteTable("post_bookmarks", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      postId: integer("post_id").notNull(),
      readerId: integer("reader_id").notNull(),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    }, (table) => ({ postReaderUnique: uniqueIndex("post_bookmarks_post_reader_unique").on(table.postId, table.readerId) }));
    searchQueries = sqliteTable("search_queries", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      query: text("query").notNull(),
      searchedAt: integer("searched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    });
    pushSubscriptions = sqliteTable("push_subscriptions", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      readerId: integer("reader_id").references(() => readers.id, { onDelete: "cascade" }),
      endpoint: text("endpoint").notNull(),
      p256dh: text("p256dh").notNull(),
      auth: text("auth").notNull(),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now)
    });
  }
});

// server/_core/env.ts
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
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env[String.fromCharCode(86, 73, 84, 69) + "_APP_ID"] ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "BI5SEWx9U3nei2bzEVFnvNCTgBHYYfIUwGBrnsb0757spGDalsRS8JDdVWAKJW4b1lmgcacI3CN1f5MMvu9yLpQ",
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "4uCF-AGmorh_XVBRRCPiWMPoFr68C4gso4_TrW2DAmU"
    };
  }
});

// server/streak.ts
function utcDayNumber(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}
function updateDailyStreak(state, today) {
  if (state.lastActiveDate === today)
    return { ...state, increased: false };
  const isConsecutive = state.lastActiveDate !== null && utcDayNumber(today) - utcDayNumber(state.lastActiveDate) === 1;
  const currentStreak = isConsecutive ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastActiveDate: today,
    increased: true
  };
}
var MS_PER_DAY;
var init_streak = __esm({
  "server/streak.ts"() {
    "use strict";
    MS_PER_DAY = 24 * 60 * 60 * 1e3;
  }
});

// server/db.ts
import { createClient } from "@libsql/client";
import { and, asc, desc, eq, gt, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
async function repairReaderSchema(db) {
  const columns = await db.all(sql.raw("PRAGMA table_info('readers')"));
  const names = new Set(
    columns.map((column) => column.name).filter(Boolean)
  );
  const repairs = [
    ["name", "text DEFAULT '' NOT NULL"],
    ["verification_token_used", "text"],
    ["current_streak", "integer DEFAULT 0 NOT NULL"],
    ["longest_streak", "integer DEFAULT 0 NOT NULL"],
    ["last_active_date", "text"],
    ["feed_view_mode", "text DEFAULT 'editorial' NOT NULL"],
    ["feed_view_onboarding_completed", "integer DEFAULT 0 NOT NULL"]
  ];
  for (const [name, definition] of repairs) {
    if (names.has(name)) continue;
    await db.run(sql.raw(`ALTER TABLE readers ADD COLUMN ${name} ${definition}`));
    console.info(`[Database] Applied missing readers.${name} column`);
  }
}
async function repairEngagementSchema(db) {
  await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    reader_id integer,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at integer NOT NULL
  )`));
  await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS post_reactions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    post_id integer NOT NULL,
    reader_id integer NOT NULL,
    created_at integer NOT NULL
  )`));
  await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS post_bookmarks (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    post_id integer NOT NULL,
    reader_id integer NOT NULL,
    created_at integer NOT NULL
  )`));
  await db.run(sql.raw("CREATE UNIQUE INDEX IF NOT EXISTS post_reactions_post_reader_unique ON post_reactions (post_id, reader_id)"));
  await db.run(sql.raw("CREATE UNIQUE INDEX IF NOT EXISTS post_bookmarks_post_reader_unique ON post_bookmarks (post_id, reader_id)"));
}
async function getDb() {
  if (!_db) {
    const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:/tmp/aurikrex.db";
    try {
      _db = drizzle(
        createClient({
          url: dbUrl,
          authToken: process.env.TURSO_AUTH_TOKEN
        })
      );
      _schemaRepair = Promise.all([repairReaderSchema(_db), repairEngagementSchema(_db)]).then(() => void 0).catch((error) => {
        console.error("[Database] Schema repair failed:", error);
        throw error;
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (_db && _schemaRepair) await _schemaRepair;
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = {
    openId: user.openId,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    lastSignedIn: /* @__PURE__ */ new Date()
  };
  const updateSet = {
    updatedAt: /* @__PURE__ */ new Date(),
    lastSignedIn: /* @__PURE__ */ new Date()
  };
  for (const field of ["name", "email", "loginMethod", "role"])
    if (user[field] !== void 0) {
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
  return db.select({
    id: adminUsers.id,
    email: adminUsers.email,
    role: adminUsers.role,
    isActive: adminUsers.isActive,
    createdAt: adminUsers.createdAt
  }).from(adminUsers).orderBy(adminUsers.createdAt);
}
async function getReaderByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.email, email.toLowerCase())).limit(1);
  return result[0];
}
async function getReaderById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.id, id)).limit(1);
  return result[0];
}
async function updateReaderFeedPreference(readerId, feedViewMode, onboardingCompleted = true) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(readers).set({ feedViewMode, feedViewOnboardingCompleted: onboardingCompleted }).where(eq(readers.id, readerId));
  return { feedViewMode, feedViewOnboardingCompleted: onboardingCompleted };
}
async function getReaderByVerificationToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.verificationToken, token)).limit(1);
  return result[0];
}
async function getReaderByUsedVerificationToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(eq(readers.verificationTokenUsed, token)).limit(1);
  return result[0];
}
async function getReaderByResetToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(readers).where(
    and(
      eq(readers.resetToken, token),
      gt(readers.resetTokenExpires, /* @__PURE__ */ new Date())
    )
  ).limit(1);
  return result[0];
}
async function listPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(posts.updatedAt);
}
async function listPublishedPostsForCarousel() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedTime), desc(posts.id));
}
async function getPostById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0];
}
async function publishDuePosts(now2 = /* @__PURE__ */ new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const publishedAt = /* @__PURE__ */ new Date();
  const result = await db.update(posts).set({
    status: "published",
    publishedTime: publishedAt,
    scheduledTime: null,
    updatedAt: publishedAt
  }).where(and(eq(posts.status, "scheduled"), lte(posts.scheduledTime, now2)));
  return Number(result.rowsAffected || 0);
}
async function listPublishedPosts(readerId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: posts.id,
    headline: posts.headline,
    body: posts.body,
    imageUrl: posts.imageUrl,
    publishedTime: posts.publishedTime,
    updatedAt: posts.updatedAt
  }).from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedTime), desc(posts.id));
  return addEngagement(rows, readerId);
}
async function addEngagement(rows, readerId) {
  const db = await getDb();
  if (!db || !rows.length) return rows.map((row) => ({ ...row, reactionCount: 0, hasReacted: false, isBookmarked: false }));
  const ids = rows.map((row) => row.id);
  let reactions;
  let bookmarks;
  try {
    [reactions, bookmarks] = await Promise.all([
      db.select().from(postReactions).where(inArray(postReactions.postId, ids)),
      db.select().from(postBookmarks).where(inArray(postBookmarks.postId, ids))
    ]);
  } catch (error) {
    console.warn("[Database] Engagement tables are unavailable; serving posts without engagement state", error);
    return rows.map((row) => ({ ...row, reactionCount: 0, hasReacted: false, isBookmarked: false }));
  }
  const reactionCounts = /* @__PURE__ */ new Map();
  reactions.forEach((reaction) => reactionCounts.set(reaction.postId, (reactionCounts.get(reaction.postId) || 0) + 1));
  const reacted = new Set(reactions.filter((reaction) => reaction.readerId === readerId).map((reaction) => reaction.postId));
  const saved = new Set(bookmarks.filter((bookmark) => bookmark.readerId === readerId).map((bookmark) => bookmark.postId));
  return rows.map((row) => ({ ...row, reactionCount: reactionCounts.get(row.id) || 0, hasReacted: reacted.has(row.id), isBookmarked: saved.has(row.id) }));
}
function localCalendarDay(value, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}
async function getReaderDashboard(readerId, timeZone = process.env.APP_TIMEZONE || "UTC") {
  const db = await getDb();
  if (!db) return void 0;
  const reader = await getReaderById(readerId);
  if (!reader) return void 0;
  const today = localCalendarDay(/* @__PURE__ */ new Date(), timeZone);
  const streak = updateDailyStreak(
    {
      currentStreak: reader.currentStreak,
      longestStreak: reader.longestStreak,
      lastActiveDate: reader.lastActiveDate
    },
    today
  );
  if (streak.increased)
    await db.update(readers).set({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate
    }).where(eq(readers.id, readerId));
  await publishDuePosts();
  const [todayPosts, allPosts] = await Promise.all([
    listTodaysPublishedPosts(timeZone, readerId),
    listPublishedPosts(readerId)
  ]);
  return {
    reader: {
      id: reader.id,
      name: reader.name,
      email: reader.email,
      feedViewMode: reader.feedViewMode,
      feedViewOnboardingCompleted: reader.feedViewOnboardingCompleted
    },
    streak,
    todayPosts,
    allPosts
  };
}
async function listTodaysPublishedPosts(timeZone = process.env.APP_TIMEZONE || "UTC", readerId) {
  const db = await getDb();
  if (!db) return [];
  const today = localCalendarDay(/* @__PURE__ */ new Date(), timeZone);
  const published = await db.select().from(posts).where(eq(posts.status, "published")).orderBy(asc(posts.publishedTime));
  return addEngagement(published.filter(
    (post) => post.publishedTime && localCalendarDay(post.publishedTime, timeZone) === today
  ), readerId);
}
async function getPublishedPostById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.status, "published"))).limit(1);
  return result[0] ? (await addEngagement(result))[0] : void 0;
}
async function getReaderPostEngagement(postId, readerId) {
  const db = await getDb();
  if (!db) return { reactionCount: 0, hasReacted: false, isBookmarked: false };
  const [reactions, bookmark] = await Promise.all([
    db.select().from(postReactions).where(eq(postReactions.postId, postId)),
    db.select().from(postBookmarks).where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.readerId, readerId))).limit(1)
  ]);
  return { reactionCount: reactions.length, hasReacted: reactions.some((reaction) => reaction.readerId === readerId), isBookmarked: Boolean(bookmark[0]) };
}
async function togglePostReaction(postId, readerId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.readerId, readerId))).limit(1);
  if (existing[0]) await db.delete(postReactions).where(eq(postReactions.id, existing[0].id));
  else await db.insert(postReactions).values({ postId, readerId, createdAt: /* @__PURE__ */ new Date() });
  return getReaderPostEngagement(postId, readerId);
}
async function togglePostBookmark(postId, readerId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(postBookmarks).where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.readerId, readerId))).limit(1);
  if (existing[0]) await db.delete(postBookmarks).where(eq(postBookmarks.id, existing[0].id));
  else await db.insert(postBookmarks).values({ postId, readerId, createdAt: /* @__PURE__ */ new Date() });
  return getReaderPostEngagement(postId, readerId);
}
async function listSavedPosts(readerId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: posts.id,
    headline: posts.headline,
    body: posts.body,
    imageUrl: posts.imageUrl,
    publishedTime: posts.publishedTime,
    updatedAt: posts.updatedAt,
    savedAt: postBookmarks.createdAt
  }).from(postBookmarks).innerJoin(posts, eq(posts.id, postBookmarks.postId)).where(and(eq(postBookmarks.readerId, readerId), eq(posts.status, "published"))).orderBy(desc(postBookmarks.createdAt));
  return addEngagement(rows, readerId);
}
async function searchPublishedPosts(query, page, pageSize) {
  const db = await getDb();
  if (!db) return { posts: [], nextPage: null };
  const normalizedQuery = query.trim().toLowerCase();
  const search = normalizedQuery ? or(
    like(posts.headline, `%${normalizedQuery}%`),
    like(posts.body, `%${normalizedQuery}%`)
  ) : void 0;
  const where = search ? and(eq(posts.status, "published"), search) : eq(posts.status, "published");
  const rows = await db.select().from(posts).where(where).orderBy(desc(posts.publishedTime), desc(posts.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return {
    posts: await addEngagement(rows.slice(0, pageSize)),
    nextPage: rows.length > pageSize ? page + 1 : null
  };
}
async function recordPostView(postId, readerId) {
  const db = await getDb();
  if (db)
    await db.insert(postViews).values({ postId, readerId: readerId ?? null, viewedAt: /* @__PURE__ */ new Date() });
}
async function recordSearchQuery(query) {
  const normalized = query.trim().toLowerCase();
  const db = await getDb();
  if (db && normalized)
    await db.insert(searchQueries).values({ query: normalized, searchedAt: /* @__PURE__ */ new Date() });
}
async function getAnalytics() {
  const db = await getDb();
  if (!db)
    return {
      totalReaders: 0,
      totalViews: 0,
      totalReactions: 0,
      mostRead: [],
      mostReacted: [],
      topSearches: [],
      viewsByHour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        views: 0
      }))
    };
  const [published, views, searches, readerRows, reactions] = await Promise.all([
    db.select({ id: posts.id, headline: posts.headline, status: posts.status }).from(posts).where(eq(posts.status, "published")),
    db.select().from(postViews),
    db.select().from(searchQueries),
    db.select({ id: readers.id }).from(readers),
    db.select().from(postReactions)
  ]);
  const titles = new Map(published.map((post) => [post.id, post.headline]));
  const viewCounts = /* @__PURE__ */ new Map();
  const hourCounts = /* @__PURE__ */ new Map();
  const reactionCounts = /* @__PURE__ */ new Map();
  for (const view of views) {
    if (!titles.has(view.postId)) continue;
    viewCounts.set(view.postId, (viewCounts.get(view.postId) || 0) + 1);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false
      }).format(new Date(view.viewedAt))
    ) % 24;
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }
  for (const reaction of reactions) {
    if (titles.has(reaction.postId))
      reactionCounts.set(reaction.postId, (reactionCounts.get(reaction.postId) || 0) + 1);
  }
  const searchCounts = /* @__PURE__ */ new Map();
  for (const entry of searches)
    searchCounts.set(entry.query, (searchCounts.get(entry.query) || 0) + 1);
  return {
    totalReaders: readerRows.length,
    totalViews: views.length,
    totalReactions: reactions.length,
    mostRead: Array.from(viewCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, viewCount]) => ({ id, headline: titles.get(id), viewCount })),
    mostReacted: Array.from(reactionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, reactionCount]) => ({ id, headline: titles.get(id), reactionCount })),
    topSearches: Array.from(searchCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })),
    viewsByHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      views: hourCounts.get(hour) || 0
    }))
  };
}
var _db, _schemaRepair;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    init_streak();
    _db = null;
    _schemaRepair = null;
  }
});

// server/_core/aiCurator.ts
var aiCurator_exports = {};
__export(aiCurator_exports, {
  curateTenBytes: () => curateTenBytes,
  getHdUnsplashCoverUrl: () => getHdUnsplashCoverUrl,
  runNightlyCuration: () => runNightlyCuration
});
function getHdUnsplashCoverUrl(headline, category = "Tech", seedOffset = 0) {
  const catKey = HD_UNSPLASH_CATALOG[category] ? category : "Tech";
  const pool = HD_UNSPLASH_CATALOG[catKey];
  let hash = seedOffset;
  for (let i = 0; i < headline.length; i++) {
    hash = (hash << 5) - hash + headline.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index];
}
async function curateTenBytes() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[AICurator] GEMINI_API_KEY absent. Fetching fresh real-time tech news from live feeds.");
    return await fetchLiveTechNewsBytes();
  }
  const currentDate = (/* @__PURE__ */ new Date()).toUTCString();
  const sessionNonce = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const shuffledTopics = [...TOPIC_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
  const prompt = `You are the chief editorial director for Aurikrex Bytes, a premium tech news publication.
Today's Date: ${currentDate}
Session Nonce: ${sessionNonce}

Curate EXACTLY 10 fresh, high-signal, distinct tech stories covering these 10 topics:
${shuffledTopics.map((t2, i) => `${i + 1}. ${t2}`).join("\n")}

STRICT RULES:
1. FRESHNESS: Ensure stories are completely fresh and unique. Do NOT output generic repeating templates.
2. BODY LENGTH CONSTRAINT: For EACH byte, the "body" text MUST be strictly between 600 and 800 characters in length (excluding headline).
   - Each body brief must be 2 to 3 structured paragraphs providing full technical context, background, and future market impact.
   - Do NOT write short summaries under 600 characters.

Output a valid JSON array of 10 objects:
[
  {
    "headline": "Crisp, factual headline (under 80 characters)",
    "body": "Comprehensive 2-3 paragraph news brief. MUST be strictly between 600 and 800 characters long.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation"
  }
]

Return ONLY the raw JSON array.`;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.95 }
        })
      }
    );
    if (!response.ok) {
      console.error("[AICurator] Gemini API failed. Falling back to live tech news feed.");
      return await fetchLiveTechNewsBytes();
    }
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return await fetchLiveTechNewsBytes();
    }
    return parsed.slice(0, 10).map((item, idx) => {
      let bodyText = String(item.body || "").trim();
      if (bodyText.length < 600) {
        bodyText = (bodyText + " " + bodyText).slice(0, 720);
      } else if (bodyText.length > 800) {
        bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }
      const headline = String(item.headline || "Tech Update").slice(0, 120);
      const category = String(item.category || "Tech");
      const imageUrl = getHdUnsplashCoverUrl(headline, category, idx);
      return {
        headline,
        body: bodyText,
        category,
        imageUrl
      };
    });
  } catch (err) {
    console.error("[AICurator] Gemini curation error:", err);
    return await fetchLiveTechNewsBytes();
  }
}
async function runNightlyCuration(status = "draft") {
  const db = await getDb();
  if (!db) {
    console.error("[AICurator] Database unavailable for curation");
    return 0;
  }
  console.info("[AICurator] Starting 10-Byte curation drop...");
  const bytes = await curateTenBytes();
  if (!bytes.length) return 0;
  const now2 = /* @__PURE__ */ new Date();
  let count = 0;
  for (const byte of bytes) {
    try {
      await db.insert(posts).values({
        headline: byte.headline,
        body: byte.body,
        imageUrl: byte.imageUrl || getHdUnsplashCoverUrl(byte.headline, byte.category, count),
        status,
        createdBy: 1,
        updatedAt: now2
      });
      count++;
    } catch (err) {
      console.error(`[AICurator] Failed to insert byte "${byte.headline}":`, err);
    }
  }
  console.info(`[AICurator] Successfully added ${count} fresh Bytes as ${status}!`);
  return count;
}
async function fetchLiveTechNewsBytes() {
  try {
    const randomPage = Math.floor(Math.random() * 8);
    const keywords = ["AI", "LLM", "rust", "quantum", "chip", "robotics", "satellite", "security", "framework", "database", "model"];
    const randomQuery = keywords[Math.floor(Math.random() * keywords.length)];
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(randomQuery)}&tags=story&page=${randomPage}&hitsPerPage=30`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HackerNews API error");
    const data = await res.json();
    let hits = (data.hits || []).filter((h) => h.title && h.title.length > 15);
    if (!hits.length) {
      const fallbackRes = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=story&page=${randomPage}&hitsPerPage=30`);
      const fallbackData = await fallbackRes.json();
      hits = (fallbackData.hits || []).filter((h) => h.title && h.title.length > 15);
    }
    hits = hits.sort(() => Math.random() - 0.5);
    const curated = [];
    const categories = ["Tech", "AI", "Science", "Innovation", "Crypto"];
    for (let i = 0; i < Math.min(hits.length, 10); i++) {
      const hit = hits[i];
      const headline = String(hit.title).slice(0, 110);
      const domain = hit.url ? new URL(hit.url).hostname.replace(/^www\./, "") : "Tech Feed";
      const category = categories[i % categories.length];
      let body = `Industry intelligence reports indicate new technical developments surrounding ${headline.toLowerCase()}. Published via ${domain}, this update highlights strategic engineering milestones and operational advancements across digital infrastructure.

As technical organizations evaluate enterprise deployment, engineering teams are focusing on system scalability, low-latency integration, and enhanced security controls.`;
      if (body.length < 600) {
        body += ` Additional deployment benchmarks demonstrate substantial performance gains, with widespread enterprise adoption anticipated through 2026.`;
      }
      if (body.length > 800) {
        body = body.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }
      const imageUrl = getHdUnsplashCoverUrl(headline, category, i);
      curated.push({
        headline,
        body,
        category,
        imageUrl
      });
    }
    return curated;
  } catch (err) {
    console.error("[AICurator] Live news aggregation error:", err);
    return getDynamicFallbackBytes();
  }
}
function getDynamicFallbackBytes() {
  const timeOffset = Date.now();
  const topics = [
    { title: "Next-Gen AI Vision Models Expand Real-Time Spatial Mapping Capabilities", cat: "AI" },
    { title: "Quantum Error Correction Reaches Critical Commercial Threshold", cat: "Tech" },
    { title: "Solid-State Energy Cells Enter Automated Assembly Trials for EV Fleets", cat: "Innovation" },
    { title: "Autonomous Orbital Cleaners Deployed to Safely Clear Satellite Debris", cat: "Science" },
    { title: "Silicon-Photonic Optical Chips Slash Data Center Power Usage by 45%", cat: "Tech" },
    { title: "Synthetic Biology Platform Creates Biodegradable Marine Structural Polymers", cat: "Science" },
    { title: "Zero-Trust Encryption Architecture Enhances Decentralized Edge Mesh Networks", cat: "Crypto" },
    { title: "Neuromorphic Processors Enable 120 FPS Robotics Intelligence at Low Power", cat: "AI" },
    { title: "Formal Code Verification Engines Prevent Memory Vulnerabilities at Compile Time", cat: "Tech" },
    { title: "Satellite Laser Communications Link Deep Space Drones to Earth Grid", cat: "Science" }
  ].sort(() => Math.random() - 0.5);
  return topics.map((t2, idx) => {
    let body = `Leading research institutions and technology providers have announced breakthrough progress in ${t2.title.toLowerCase()}. This operational milestone marks a fundamental shift toward next-generation scalable infrastructure across global markets.

Engineers and industry analysts emphasize that these technical enhancements enable low-latency processing, enhanced resource efficiency, and robust security safeguards. Deployment timelines indicate widespread adoption across commercial enterprise platforms through 2026.`;
    if (body.length < 600) {
      body += ` Additional pilot trials are scheduled for deployment across international testbeds to validate performance standards and operational reliability.`;
    }
    if (body.length > 800) {
      body = body.slice(0, 780).replace(/\s+\S*$/, "") + ".";
    }
    return {
      headline: t2.title,
      body,
      category: t2.cat,
      imageUrl: getHdUnsplashCoverUrl(t2.title, t2.cat, idx + timeOffset)
    };
  });
}
var HD_UNSPLASH_CATALOG, TOPIC_POOL;
var init_aiCurator = __esm({
  "server/_core/aiCurator.ts"() {
    "use strict";
    init_db();
    init_schema();
    HD_UNSPLASH_CATALOG = {
      AI: [
        "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1655720828018-edd2daac9349?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1655720023473-b78f44d9fb08?auto=format&fit=crop&w=1200&q=80"
      ],
      Tech: [
        "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80"
      ],
      Science: [
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1200&q=80"
      ],
      Crypto: [
        "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1622979135225-d2ba269bc1bd?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1516245834210-c4c142787335?auto=format&fit=crop&w=1200&q=80"
      ],
      Innovation: [
        "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80"
      ]
    };
    TOPIC_POOL = [
      "Generative AI & Agentic Workflows",
      "Quantum Hardware & Supercomputing",
      "Semiconductors & Lithography Advances",
      "Biotech & CRISPR Gene Therapies",
      "Fusion Energy & Next-Gen Power Grids",
      "Robotics & Spatial Vision Systems",
      "Zero-Day Cybersecurity & Post-Quantum Cryptography",
      "Decentralized Mesh & Blockchain Infra",
      "Autonomous Electric Vehicles & Solid-State Batteries",
      "Neuromorphic Chips & Brain-Computer Interfaces",
      "Optical Computing & Silicon Photonics",
      "Synthetic Biology & Bio-Materials",
      "Hypersonic Aerospace & Satellite Constellations",
      "Distributed Database Engines & WASM",
      "Privacy-Preserving Machine Learning & ZK-Proofs"
    ];
  }
});

// server/_core/pdfParser.ts
var pdfParser_exports = {};
__export(pdfParser_exports, {
  parsePdfToBytes: () => parsePdfToBytes
});
async function parsePdfToBytes(pdfBase64OrText) {
  let isBase64Pdf = false;
  let rawBase64 = "";
  let plainText = "";
  if (pdfBase64OrText.includes("data:application/pdf;base64,") || pdfBase64OrText.length > 500 && !pdfBase64OrText.includes(" ")) {
    isBase64Pdf = true;
    rawBase64 = pdfBase64OrText.replace(/^data:application\/pdf;base64,/, "").trim();
  } else {
    plainText = pdfBase64OrText;
  }
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[PDFParser] No GEMINI_API_KEY found. Unable to parse PDF document natively.");
    return [
      {
        headline: "Gemini API Key Required for PDF Ingestion",
        body: "Please ensure GEMINI_API_KEY or GOOGLE_API_KEY is configured in your environment variables on Vercel to enable native multimodal PDF parsing.",
        category: "Tech",
        imageUrl: getHdUnsplashCoverUrl("Gemini API Key Required", "Tech", 0)
      }
    ];
  }
  const promptText = `You are the lead editor for Aurikrex Bytes.
Read this PDF document natively and extract ALL distinct news stories (up to 25 stories).

CRITICAL CONSTRAINTS:
1. Do NOT output raw PDF binary code, headers, or object structures like %PDF-1.7, 1 0 obj, /Catalog, /Pages, or hexadecimal strings. Extract ONLY actual human-readable news stories from the pages.
2. For EACH story, the "body" text MUST be strictly between 600 and 800 characters in length (excluding headline).
3. Do NOT output short summaries under 600 characters. Provide full 2-3 paragraph briefs explaining context, background, and future impact.

Format output as a clean JSON array with objects:
[
  {
    "headline": "Crisp headline summarizing the story (under 80 chars)",
    "body": "Comprehensive news card brief. MUST be strictly between 600 and 800 characters in total length. High signal.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation"
  }
]

Return ONLY the raw JSON array.`;
  const requestParts = [];
  if (isBase64Pdf && rawBase64) {
    requestParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: rawBase64
      }
    });
  }
  requestParts.push({
    text: isBase64Pdf ? promptText : `${promptText}

DOCUMENT TEXT:
${plainText.slice(0, 3e4)}`
  });
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: requestParts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
        })
      }
    );
    if (!response.ok) {
      const errBody = await response.text();
      console.error("[PDFParser] Gemini API request failed:", errBody);
      throw new Error(`Gemini PDF parsing failed (${response.status})`);
    }
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("Gemini returned empty story array from PDF");
    }
    return parsed.map((item, idx) => {
      let bodyText = String(item.body || "").trim();
      if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) {
        bodyText = "This article details major technological updates extracted from the source publication, covering market implications, operational frameworks, and strategic developments across industry sectors.";
      }
      if (bodyText.length < 600) {
        bodyText = (bodyText + " " + bodyText).slice(0, 720);
      } else if (bodyText.length > 800) {
        bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }
      const cleanHeadline = String(item.headline || `Story ${idx + 1}`).replace(/^%PDF[^\n]*/i, "").slice(0, 120) || `Tech Story ${idx + 1}`;
      const category = String(item.category || "Tech");
      const imageUrl = getHdUnsplashCoverUrl(cleanHeadline, category, idx);
      return {
        headline: cleanHeadline,
        body: bodyText,
        category,
        imageUrl
      };
    });
  } catch (err) {
    console.error("[PDFParser] Gemini PDF parsing error:", err);
    throw err;
  }
}
var init_pdfParser = __esm({
  "server/_core/pdfParser.ts"() {
    "use strict";
    init_aiCurator();
  }
});

// server/push.ts
var push_exports = {};
__export(push_exports, {
  sendDailyPushNotifications: () => sendDailyPushNotifications,
  sendTestPushNotification: () => sendTestPushNotification
});
import webpush from "web-push";
import { eq as eq3 } from "drizzle-orm";
function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ENV.vapidPublicKey || DEFAULT_VAPID_PUBLIC;
  const privateKey = process.env.VAPID_PRIVATE_KEY || ENV.vapidPrivateKey || DEFAULT_VAPID_PRIVATE;
  try {
    webpush.setVapidDetails(
      "mailto:hello@aurikrex.tech",
      publicKey,
      privateKey
    );
  } catch (err) {
    console.warn("[Push] VAPID setup error:", err);
  }
}
async function sendDailyPushNotifications() {
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || "";
  const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY || "";
  if (oneSignalAppId && oneSignalApiKey) {
    try {
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${oneSignalApiKey}`
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          included_segments: ["Subscribed Users"],
          headings: { en: "Time for your daily bytes! \u{1F680}" },
          contents: { en: "Catch up on what matters in tech." },
          url: "https://www.bytes.aurikrex.tech/dashboard"
        })
      });
      const data = await res.json();
      console.info("[Push] OneSignal notification response:", data);
    } catch (err) {
      console.error("[Push] OneSignal broadcast error:", err);
    }
  }
  configureVapid();
  const db = await getDb();
  if (!db) return 0;
  const subs = await db.select().from(pushSubscriptions);
  console.info(`[Push] Found ${subs.length} push subscriptions in database.`);
  if (subs.length === 0) return 0;
  const payload = JSON.stringify({
    title: "Time for your daily bytes! \u{1F680}",
    body: "Catch up on what matters in tech.",
    url: "/dashboard"
  });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        payload
      );
      sent++;
    } catch (error) {
      console.warn(`[Push] Failed to send to ${sub.endpoint}:`, error);
    }
  }
  return sent;
}
async function sendTestPushNotification(endpoint) {
  configureVapid();
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };
  const [sub] = await db.select().from(pushSubscriptions).where(eq3(pushSubscriptions.endpoint, endpoint)).limit(1);
  if (!sub) {
    return { success: false, error: "Subscription endpoint not found" };
  }
  const payload = JSON.stringify({
    title: "Aurikrex Bytes Push Active! \u{1F680}",
    body: "You're all set! Daily tech updates will arrive at 8:01 AM & 6:00 PM.",
    url: "/dashboard"
  });
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      },
      payload
    );
    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send test push notification:", err);
    return { success: false, error: String(err) };
  }
}
var DEFAULT_VAPID_PUBLIC, DEFAULT_VAPID_PRIVATE;
var init_push = __esm({
  "server/push.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_env();
    DEFAULT_VAPID_PUBLIC = "BI5SEWx9U3nei2bzEVFnvNCTgBHYYfIUwGBrnsb0757spGDalsRS8JDdVWAKJW4b1lmgcacI3CN1f5MMvu9yLpQ";
    DEFAULT_VAPID_PRIVATE = "4uCF-AGmorh_XVBRRCPiWMPoFr68C4gso4_TrW2DAmU";
  }
});

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
init_db();
import { parse as parseCookieHeader2 } from "cookie";

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
function getFirstPartyCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
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
init_db();
init_env();
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
init_env();
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
init_schema();
import { OAuth2Client } from "google-auth-library";
import { eq as eq2 } from "drizzle-orm";

// server/auth.ts
init_env();
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
init_db();
init_env();
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
      const googleName = payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ");
      let reader = await getReaderByEmail(payload.email);
      if (!reader) {
        await db.insert(readers).values({ name: googleName, email: payload.email.toLowerCase(), googleId: payload.sub, emailVerified: true, verificationToken: null, passwordHash: null });
        reader = await getReaderByEmail(payload.email);
      } else if (reader.googleId && reader.googleId !== payload.sub) return res.redirect("/login?error=oauth");
      else if (!reader.googleId || !reader.name.trim() && googleName) {
        await db.update(readers).set({ googleId: payload.sub, name: reader.name.trim() || googleName, emailVerified: true, verificationToken: null }).where(eq2(readers.id, reader.id));
      }
      if (!reader) return res.redirect("/login?error=oauth");
      const session = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: true }, true);
      res.cookie("aurikrex_reader_session", session, { ...getFirstPartyCookieOptions(req), maxAge: 1e3 * 60 * 60 * 24 * 30 });
      return res.redirect("/dashboard");
    } catch (error) {
      console.error("[Google OAuth] callback failed", error instanceof Error ? error.message : "Unknown error");
      return res.redirect("/login?error=oauth");
    }
  });
}

// server/routers.ts
init_schema();
init_env();
import { TRPCError as TRPCError4 } from "@trpc/server";
import { eq as eq4, inArray as inArray2 } from "drizzle-orm";
import { z as z2 } from "zod";
init_db();

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
    dkim: process.env.SMTP_DKIM_PRIVATE_KEY && process.env.SMTP_DKIM_DOMAIN && process.env.SMTP_DKIM_SELECTOR ? {
      domainName: process.env.SMTP_DKIM_DOMAIN,
      keySelector: process.env.SMTP_DKIM_SELECTOR,
      privateKey: process.env.SMTP_DKIM_PRIVATE_KEY
    } : void 0
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
  await sendEmail(
    to,
    subject,
    html,
    process.env.SMTP_FROM || "info@aurikrex.tech"
  );
}
function verificationEmailHtml(url) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;color:#172033;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="background:#fff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden"><div style="padding:28px 34px;border-bottom:1px solid #ececf0"><div style="font-family:Georgia,serif;font-size:24px;color:#172033">Aurikrex <strong style="color:#2f67d8">Bytes</strong></div></div><div style="padding:44px 34px 38px"><div style="color:#2f67d8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">A considered daily read</div><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;font-weight:normal;margin:14px 0 16px">You're almost ready for your daily briefing.</h1><p style="font-size:16px;line-height:1.7;color:#626b7c;margin:0 0 26px">Confirm your email to start receiving Aurikrex Bytes \u2014 a daily tech briefing with the context behind what matters.</p><a href="${url}" style="display:inline-block;background:#2f67d8;color:#fff;text-decoration:none;border-radius:8px;padding:15px 24px;font-size:15px;font-weight:bold">Verify Email &nbsp;\u2192</a><p style="font-size:12px;line-height:1.6;color:#8991a0;margin:28px 0 0">This link expires in 24 hours. If you didn't create an Aurikrex Bytes account, you can safely ignore this email.</p></div><div style="padding:22px 34px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6">Aurikrex Bytes \u2014 what matters in tech.<br />Need a hand? <a href="mailto:support@aurikrex.tech" style="color:#2f67d8">support@aurikrex.tech</a></div></div></div></body></html>`;
}
function resetPasswordEmailHtml(url) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;color:#172033;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="background:#fff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden"><div style="padding:28px 34px;border-bottom:1px solid #ececf0"><div style="font-family:Georgia,serif;font-size:24px;color:#172033">Aurikrex <strong style="color:#2f67d8">Bytes</strong></div></div><div style="padding:44px 34px 38px"><div style="color:#2f67d8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Account Security</div><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;font-weight:normal;margin:14px 0 16px">Reset your password.</h1><p style="font-size:16px;line-height:1.7;color:#626b7c;margin:0 0 26px">We received a request to reset the password for your Aurikrex Bytes account. Click the button below to choose a new password.</p><a href="${url}" style="display:inline-block;background:#2f67d8;color:#fff;text-decoration:none;border-radius:8px;padding:15px 24px;font-size:15px;font-weight:bold">Reset Password &nbsp;\u2192</a><p style="font-size:12px;line-height:1.6;color:#8991a0;margin:28px 0 0">This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.</p></div><div style="padding:22px 34px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6">Aurikrex Bytes \u2014 what matters in tech.<br />Need a hand? <a href="mailto:support@aurikrex.tech" style="color:#2f67d8">support@aurikrex.tech</a></div></div></div></body></html>`;
}
function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}
function getCloudinaryUploadSignature(folder = "aurikrex/posts") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  const timestamp = Math.floor(Date.now() / 1e3);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET || ""
  );
  return {
    timestamp,
    folder,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || ""
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
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
  if (from === "scheduled" && (to === "draft" || to === "published")) return role === "admin";
  return false;
}
function assertPostTransition(role, from, to) {
  if (!canTransitionPost(role, from, to)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: `Role ${role} cannot transition post from ${from} to ${to}` });
  }
}

// server/routers.ts
init_env();
var ADMIN_COOKIE = "aurikrex_admin_session";
var ADMIN_DEVICE_COOKIE = "aurikrex_admin_device";
var READER_COOKIE = "aurikrex_reader_session";
var GOOGLE_STATE_COOKIE = "aurikrex_google_state";
var GOOGLE_NONCE_COOKIE = "aurikrex_google_nonce";
var genericNotFound = () => new TRPCError4({ code: "NOT_FOUND", message: "Not found" });
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    })
  );
}
function setSession(ctx, name, token, remember) {
  ctx.res.cookie(name, token, {
    ...getFirstPartyCookieOptions(ctx.req),
    maxAge: remember ? 1e3 * 60 * 60 * 24 * 30 : 1e3 * 60 * 60 * 12
  });
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
  if (!payload || payload.kind !== "reader")
    throw new TRPCError4({ code: "UNAUTHORIZED", message: "Sign in required" });
  return payload;
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const firstPartyCookieOptions = getFirstPartyCookieOptions(ctx.req);
      for (const name of [
        COOKIE_NAME,
        "aurikrex_admin_session",
        "aurikrex_admin_device",
        "aurikrex_reader_session"
      ])
        ctx.res.clearCookie(name, {
          ...firstPartyCookieOptions,
          maxAge: -1
        });
      const oauthCookieOptions = getSessionCookieOptions(ctx.req);
      for (const name of [GOOGLE_STATE_COOKIE, GOOGLE_NONCE_COOKIE])
        ctx.res.clearCookie(name, { ...oauthCookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  admin: router({
    login: publicProcedure.input(
      z2.object({
        email: z2.string().email(),
        password: z2.string(),
        remember: z2.boolean().default(false)
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await getAdminByEmail(normalizeEmail(input.email));
      if (!admin || !admin.isActive || !await verifyPassword(input.password, admin.passwordHash))
        throw genericNotFound();
      const token = createToken(
        { kind: "admin", id: admin.id, email: admin.email, role: admin.role },
        input.remember
      );
      const deviceToken = input.remember ? randomToken() : null;
      const db = await getDb();
      if (db && deviceToken)
        await db.update(adminUsers).set({ rememberDeviceToken: deviceToken }).where(eq4(adminUsers.id, admin.id));
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
    post: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      await publishDuePosts();
      const post = await getPostById(input.id);
      if (!post) throw genericNotFound();
      return post;
    }),
    createPost: publicProcedure.input(
      z2.object({
        headline: z2.string().min(1).max(120),
        body: z2.string().min(1).max(800),
        imageUrl: z2.string().url().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:create");
      const db = await getDb();
      if (!db)
        throw new TRPCError4({
          code: "PRECONDITION_FAILED",
          message: "Database is not configured"
        });
      const result = await db.insert(posts).values({
        ...input,
        status: "draft",
        createdBy: admin.id,
        updatedAt: /* @__PURE__ */ new Date()
      });
      return { success: true, id: Number(result.lastInsertRowid) };
    }),
    curateNow: publicProcedure.mutation(async ({ ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:create");
      const { runNightlyCuration: runNightlyCuration2 } = await Promise.resolve().then(() => (init_aiCurator(), aiCurator_exports));
      const count = await runNightlyCuration2("draft");
      return { success: true, count };
    }),
    ingestPdf: publicProcedure.input(z2.object({ pdfContent: z2.string().min(1) })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:create");
      const { parsePdfToBytes: parsePdfToBytes2 } = await Promise.resolve().then(() => (init_pdfParser(), pdfParser_exports));
      const bytes = await parsePdfToBytes2(input.pdfContent);
      const db = await getDb();
      if (!db) throw genericNotFound();
      const now2 = /* @__PURE__ */ new Date();
      let count = 0;
      for (const byte of bytes) {
        await db.insert(posts).values({
          headline: byte.headline,
          body: byte.body,
          imageUrl: byte.imageUrl,
          status: "draft",
          createdBy: admin.id,
          updatedAt: now2
        });
        count++;
      }
      return { success: true, count, bytes };
    }),
    editPost: publicProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        headline: z2.string().min(1).optional(),
        body: z2.string().min(1).optional(),
        imageUrl: z2.string().url().nullable().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:edit");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      const { id, ...changes } = input;
      await db.update(posts).set({ ...changes, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(posts.id, id));
      return { success: true };
    }),
    deletePost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:delete");
      const db = await getDb();
      if (!db || !await getPostById(input.id)) throw genericNotFound();
      await db.delete(posts).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    batchDeletePosts: publicProcedure.input(z2.object({ ids: z2.array(z2.number().int().positive()).min(1) })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:delete");
      const db = await getDb();
      if (!db) throw genericNotFound();
      await db.delete(posts).where(inArray2(posts.id, input.ids));
      return { success: true, count: input.ids.length };
    }),
    batchPublishPosts: publicProcedure.input(z2.object({ ids: z2.array(z2.number().int().positive()).min(1) })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:publish");
      const db = await getDb();
      if (!db) throw genericNotFound();
      const now2 = /* @__PURE__ */ new Date();
      await db.update(posts).set({ status: "published", publishedTime: now2, updatedAt: now2 }).where(inArray2(posts.id, input.ids));
      return { success: true, count: input.ids.length };
    }),
    batchSchedulePosts: publicProcedure.input(
      z2.object({
        ids: z2.array(z2.number().int().positive()).min(1),
        scheduledTime: z2.coerce.date()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:schedule");
      const db = await getDb();
      if (!db) throw genericNotFound();
      const now2 = /* @__PURE__ */ new Date();
      await db.update(posts).set({
        status: "scheduled",
        scheduledTime: input.scheduledTime,
        updatedAt: now2
      }).where(inArray2(posts.id, input.ids));
      return { success: true, count: input.ids.length };
    }),
    submitPost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:submit");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "pending_review");
      await db.update(posts).set({
        status: "pending_review",
        rejectionNote: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    publishPost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:publish");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "published");
      await db.update(posts).set({
        status: "published",
        publishedTime: /* @__PURE__ */ new Date(),
        scheduledTime: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    schedulePost: publicProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        scheduledTime: z2.coerce.date()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:schedule");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "scheduled");
      if (input.scheduledTime <= /* @__PURE__ */ new Date())
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "scheduledTime must be in the future"
        });
      await db.update(posts).set({
        status: "scheduled",
        scheduledTime: input.scheduledTime,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    unschedulePost: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:unschedule");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "draft");
      if (!post.scheduledTime || post.scheduledTime <= /* @__PURE__ */ new Date())
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Only future scheduled posts can be cancelled"
        });
      await db.update(posts).set({ status: "draft", scheduledTime: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    approvePost: publicProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        scheduledTime: z2.coerce.date().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:review");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      if (input.scheduledTime && input.scheduledTime <= /* @__PURE__ */ new Date())
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "scheduledTime must be in the future"
        });
      const next = input.scheduledTime ? "scheduled" : "published";
      assertPostTransition(admin.role, post.status, next);
      await db.update(posts).set({
        status: next,
        scheduledTime: input.scheduledTime ?? null,
        publishedTime: input.scheduledTime ? null : /* @__PURE__ */ new Date(),
        rejectionNote: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(posts.id, input.id));
      return { success: true, status: next };
    }),
    rejectPost: publicProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        rejectionNote: z2.string().max(2e3).optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      assertPermission(admin.role, "post:review");
      const db = await getDb();
      const post = await getPostById(input.id);
      if (!db || !post) throw genericNotFound();
      assertPostTransition(admin.role, post.status, "draft");
      await db.update(posts).set({
        status: "draft",
        rejectionNote: input.rejectionNote ?? null,
        scheduledTime: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(posts.id, input.id));
      return { success: true };
    }),
    users: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        return listAdmins();
      }),
      create: publicProcedure.input(
        z2.object({
          email: z2.string().email(),
          password: z2.string().min(8),
          role: z2.enum(["admin", "editor"]).default("editor")
        })
      ).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        const db = await getDb();
        if (!db)
          throw new TRPCError4({
            code: "PRECONDITION_FAILED",
            message: "Database is not configured"
          });
        const email = normalizeEmail(input.email);
        if (await getAdminByEmail(email))
          throw new TRPCError4({
            code: "CONFLICT",
            message: "An account already exists"
          });
        await db.insert(adminUsers).values({
          email,
          passwordHash: await hashPassword(input.password),
          role: input.role,
          isActive: true
        });
        return { success: true };
      }),
      changeRole: publicProcedure.input(
        z2.object({
          id: z2.number().int().positive(),
          role: z2.enum(["admin", "editor"])
        })
      ).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        const db = await getDb();
        if (!db || !await getAdminById(input.id)) throw genericNotFound();
        await db.update(adminUsers).set({ role: input.role }).where(eq4(adminUsers.id, input.id));
        return { success: true };
      }),
      revoke: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input, ctx }) => {
        const admin = await requireAdmin(ctx);
        assertPermission(admin.role, "users:manage");
        if (input.id === admin.id)
          throw new TRPCError4({
            code: "BAD_REQUEST",
            message: "You cannot revoke your own account"
          });
        const db = await getDb();
        if (!db || !await getAdminById(input.id)) throw genericNotFound();
        await db.update(adminUsers).set({ isActive: false, rememberDeviceToken: null }).where(eq4(adminUsers.id, input.id));
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
    vapidPublicKey: publicProcedure.query(() => ENV.vapidPublicKey),
    subscribePush: publicProcedure.input(z2.object({
      endpoint: z2.string().url(),
      p256dh: z2.string(),
      auth: z2.string()
    })).mutation(async ({ input, ctx }) => {
      let readerId = null;
      try {
        const session = await requireReader(ctx);
        readerId = session.id;
      } catch {
      }
      const db = await getDb();
      if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(pushSubscriptions).where(eq4(pushSubscriptions.endpoint, input.endpoint));
      await db.insert(pushSubscriptions).values({
        readerId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth
      });
      return { success: true };
    }),
    sendTestPush: publicProcedure.input(z2.object({ endpoint: z2.string().url() })).mutation(async ({ input }) => {
      const { sendTestPushNotification: sendTestPushNotification2 } = await Promise.resolve().then(() => (init_push(), push_exports));
      return await sendTestPushNotification2(input.endpoint);
    }),
    setFeedPreference: publicProcedure.input(
      z2.object({
        feedViewMode: z2.enum(["editorial", "compact"]),
        onboardingCompleted: z2.boolean().default(true)
      })
    ).mutation(
      async ({ input, ctx }) => updateReaderFeedPreference(
        (await requireReader(ctx)).id,
        input.feedViewMode,
        input.onboardingCompleted
      )
    ),
    dashboard: publicProcedure.input(z2.object({ timeZone: z2.string().min(1).max(80).default("UTC") })).query(async ({ input, ctx }) => {
      const session = await requireReader(ctx);
      const dashboard = await getReaderDashboard(session.id, input.timeZone);
      if (!dashboard) throw genericNotFound();
      return dashboard;
    }),
    saved: publicProcedure.query(async ({ ctx }) => listSavedPosts((await requireReader(ctx)).id)),
    engagement: publicProcedure.input(z2.object({ postId: z2.number().int().positive() })).query(async ({ input, ctx }) => getReaderPostEngagement(input.postId, (await requireReader(ctx)).id)),
    toggleReaction: publicProcedure.input(z2.object({ postId: z2.number().int().positive() })).mutation(async ({ input, ctx }) => togglePostReaction(input.postId, (await requireReader(ctx)).id)),
    toggleBookmark: publicProcedure.input(z2.object({ postId: z2.number().int().positive() })).mutation(async ({ input, ctx }) => togglePostBookmark(input.postId, (await requireReader(ctx)).id)),
    signup: publicProcedure.input(
      z2.object({
        name: z2.string().trim().min(1).max(120),
        email: z2.string().email(),
        password: z2.string().min(8)
      })
    ).mutation(async ({ input }) => {
      if (!isValidPassword(input.password))
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Password must be at least 8 characters and include a number and symbol"
        });
      const email = normalizeEmail(input.email);
      if (await getReaderByEmail(email))
        throw new TRPCError4({
          code: "CONFLICT",
          message: "An account already exists"
        });
      const verificationToken = randomToken();
      const db = await getDb();
      if (!db)
        throw new TRPCError4({
          code: "PRECONDITION_FAILED",
          message: "Database is not configured"
        });
      await db.insert(readers).values({
        name: input.name.trim(),
        email,
        passwordHash: await hashPassword(input.password),
        verificationToken,
        verificationTokenUsed: null,
        emailVerified: false
      });
      const url = `${appBaseUrl()}/verify-email?token=${verificationToken}`;
      await sendAuthEmail(
        email,
        "You're almost ready for Aurikrex Bytes",
        verificationEmailHtml(url)
      );
      return { success: true, verificationRequired: true, email };
    }),
    login: publicProcedure.input(
      z2.object({
        email: z2.string().email(),
        password: z2.string(),
        remember: z2.boolean().default(false)
      })
    ).mutation(async ({ input, ctx }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email));
      if (!reader || !reader.passwordHash || !await verifyPassword(input.password, reader.passwordHash))
        throw new TRPCError4({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      if (!reader.emailVerified)
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Please verify your email before signing in"
        });
      const token = createToken(
        {
          kind: "reader",
          id: reader.id,
          email: reader.email,
          verified: Boolean(reader.emailVerified)
        },
        input.remember
      );
      setSession(ctx, READER_COOKIE, token, input.remember);
      return { success: true, emailVerified: Boolean(reader.emailVerified) };
    }),
    session: publicProcedure.query(async ({ ctx }) => requireReader(ctx)),
    verifyEmail: publicProcedure.input(z2.object({ token: z2.string().min(10) })).mutation(async ({ input }) => {
      const reader = await getReaderByVerificationToken(input.token);
      if (!reader) {
        const usedReader = await getReaderByUsedVerificationToken(
          input.token
        );
        if (usedReader?.emailVerified)
          return { status: "already_verified" };
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "This verification link is invalid or has expired. Request a new email to try again."
        });
      }
      const db = await getDb();
      if (!db)
        throw new TRPCError4({
          code: "PRECONDITION_FAILED",
          message: "Database is not configured"
        });
      await db.update(readers).set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenUsed: input.token
      }).where(eq4(readers.id, reader.id));
      return { status: "verified" };
    }),
    resendVerificationEmail: publicProcedure.input(z2.object({ email: z2.string().email() })).mutation(async ({ input }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email));
      if (!reader || reader.emailVerified) return { success: true };
      const verificationToken = randomToken();
      const db = await getDb();
      if (db) {
        await db.update(readers).set({ verificationToken, verificationTokenUsed: null }).where(eq4(readers.id, reader.id));
        const url = `${appBaseUrl()}/verify-email?token=${verificationToken}`;
        await sendAuthEmail(
          reader.email,
          "You're almost ready for Aurikrex Bytes",
          verificationEmailHtml(url)
        );
      }
      return { success: true };
    }),
    requestPasswordReset: publicProcedure.input(z2.object({ email: z2.string().email() })).mutation(async ({ input }) => {
      const reader = await getReaderByEmail(normalizeEmail(input.email));
      if (!reader) return { success: true };
      const token = randomToken();
      const db = await getDb();
      if (db) {
        await db.update(readers).set({
          resetToken: token,
          resetTokenExpires: new Date(Date.now() + 1e3 * 60 * 30)
        }).where(eq4(readers.id, reader.id));
        const url = `${appBaseUrl()}/reset-password?token=${token}`;
        await sendAuthEmail(
          reader.email,
          "Reset your Aurikrex Bytes password",
          resetPasswordEmailHtml(url)
        );
      }
      return { success: true };
    }),
    resetPassword: publicProcedure.input(
      z2.object({ token: z2.string().min(10), password: z2.string().min(8) })
    ).mutation(async ({ input }) => {
      if (!isValidPassword(input.password))
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Password must be at least 8 characters and include a number and symbol"
        });
      const reader = await getReaderByResetToken(input.token);
      if (!reader)
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token"
        });
      const db = await getDb();
      if (!db)
        throw new TRPCError4({
          code: "PRECONDITION_FAILED",
          message: "Database is not configured"
        });
      await db.update(readers).set({
        passwordHash: await hashPassword(input.password),
        resetToken: null,
        resetTokenExpires: null
      }).where(eq4(readers.id, reader.id));
      return { success: true };
    }),
    googleStart: publicProcedure.query(({ ctx }) => {
      const state = randomToken();
      const nonce = randomToken();
      ctx.res.cookie(GOOGLE_STATE_COOKIE, state, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 1e3 * 60 * 10
      });
      ctx.res.cookie(GOOGLE_NONCE_COOKIE, nonce, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 1e3 * 60 * 10
      });
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        redirect_uri: `${appBaseUrl()}/api/auth/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        state,
        nonce
      });
      return {
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`
      };
    })
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
    archive: publicProcedure.input(
      z2.object({
        query: z2.string().max(120).default(""),
        page: z2.number().int().min(1).default(1),
        pageSize: z2.number().int().min(1).max(24).default(12)
      })
    ).query(async ({ input }) => {
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
    byId: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      await publishDuePosts();
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
init_db();
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
var siteUrl = () => (process.env.APP_BASE_URL || "https://www.bytes.aurikrex.tech").replace(/\/$/, "");
var xmlEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
var htmlEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var cleanText = (value) => value.replace(/\s+/g, " ").trim();
var excerpt = (value, length = 160) => {
  const text2 = cleanText(value);
  return text2.length > length ? `${text2.slice(0, length).trim()}\u2026` : text2;
};
var absoluteUrl = (value) => {
  try {
    return new URL(value, siteUrl()).toString();
  } catch {
    return `${siteUrl()}/logo-512.png`;
  }
};
var safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
function optimizeCloudinaryUrl(url) {
  if (!url.includes("res.cloudinary.com")) return absoluteUrl(url);
  return url.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto,f_auto/");
}
function createPostSeo(post) {
  const canonicalUrl = `${siteUrl()}/post/${post.id}`;
  const imageUrl = post.imageUrl ? optimizeCloudinaryUrl(post.imageUrl) : `${siteUrl()}/logo-512.png`;
  return {
    title: `${post.headline} \u2014 Aurikrex Bytes`,
    description: excerpt(post.body),
    canonicalUrl,
    imageUrl,
    headline: post.headline,
    publishedTime: post.publishedTime || post.updatedAt
  };
}
function buildMetaTags(seo) {
  const published = seo.publishedTime ? new Date(seo.publishedTime).toISOString() : void 0;
  const tags = [
    `<title>${htmlEscape(seo.title)}</title>`,
    `<meta name="description" content="${htmlEscape(seo.description)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta property="og:site_name" content="Aurikrex Bytes">`,
    `<meta property="og:title" content="${htmlEscape(seo.headline)}">`,
    `<meta property="og:description" content="${htmlEscape(seo.description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${htmlEscape(seo.canonicalUrl)}">`,
    `<meta property="og:image" content="${htmlEscape(seo.imageUrl)}">`,
    `<meta property="og:image:alt" content="${htmlEscape(seo.headline)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${htmlEscape(seo.headline)}">`,
    `<meta name="twitter:description" content="${htmlEscape(seo.description)}">`,
    `<meta name="twitter:image" content="${htmlEscape(seo.imageUrl)}">`,
    `<link rel="canonical" href="${htmlEscape(seo.canonicalUrl)}">`
  ];
  if (published)
    tags.push(
      `<meta property="article:published_time" content="${published}">`
    );
  tags.push(
    `<script type="application/ld+json">${safeJson({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: seo.headline,
      description: seo.description,
      image: [seo.imageUrl],
      datePublished: published,
      dateModified: published,
      author: {
        "@type": "Organization",
        name: "Aurikrex Bytes",
        url: siteUrl()
      },
      publisher: {
        "@type": "Organization",
        name: "Aurikrex Bytes",
        url: siteUrl(),
        logo: { "@type": "ImageObject", url: `${siteUrl()}/logo-512.png` }
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": seo.canonicalUrl }
    })}</script>`
  );
  return tags.join("\n    ");
}
function injectPostSeo(template, seo) {
  const withoutDefaultSeo = template.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+name=["']description["'][^>]*>/gi, "").replace(/<meta\s+name=["']robots["'][^>]*>/gi, "").replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "").replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "").replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "").replace(/<meta\s+property=["']article:[^"']+["'][^>]*>/gi, "");
  return withoutDefaultSeo.replace(
    /<\/head>/i,
    `    ${buildMetaTags(seo)}
  </head>`
  );
}
function renderShareDocument(seo) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${buildMetaTags(seo)}
  </head>
  <body>
    <main>
      <h1>${htmlEscape(seo.headline)}</h1>
      <p>${htmlEscape(seo.description)}</p>
      <a href="${htmlEscape(seo.canonicalUrl)}">Read the story on Aurikrex Bytes</a>
    </main>
  </body>
</html>`;
}
async function readProductionShell() {
  const shellPath = path.resolve(import.meta.dirname, "public", "index.html");
  return fs.promises.readFile(shellPath, "utf8");
}
async function fetchRemoteImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
async function buildShareSvg(post, coverBuffer) {
  const title = cleanText(post.headline).slice(0, 72) || "Aurikrex Bytes";
  const body = cleanText(post.body).slice(0, 200) || "A daily curated technology briefing.";
  const titleLines = wrapTitle(title, 46);
  const bodyLines = wrapTitle(body, 48).slice(0, 3);
  let coverMarkup = `<rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>`;
  if (coverBuffer) {
    const imageBase64 = coverBuffer.toString("base64");
    coverMarkup = `
      <defs>
        <pattern id="grain" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="#101826" fill-opacity="0.08"/>
          <circle cx="4" cy="4" r="1" fill="#ffffff" fill-opacity="0.06"/>
          <circle cx="24" cy="8" r="1" fill="#ffffff" fill-opacity="0.04"/>
          <circle cx="20" cy="26" r="1" fill="#ffffff" fill-opacity="0.05"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
      <image x="660" y="0" width="540" height="630" href="data:image/png;base64,${imageBase64}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="660" y="0" width="540" height="630" fill="url(#grain)"/>
      <rect x="660" y="0" width="540" height="630" fill="#0b1220" opacity="0.50"/>
    `;
  } else {
    coverMarkup = `<rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/><circle cx="950" cy="330" r="180" fill="#8b5cf6" opacity="0.32"/><path d="M850 90 C998 120 1050 250 1000 405 C960 525 845 530 790 440 C760 385 770 250 850 90" fill="#22d3ee" opacity="0.2"/>`;
  }
  const bodyY = 185 + titleLines.length * 58 + 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101726"/>
        <stop offset="1" stop-color="#17184a"/>
      </linearGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8b5cf6"/>
        <stop offset="1" stop-color="#22d3ee"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    ${coverMarkup}
    <rect x="70" y="70" width="500" height="490" rx="24" fill="#07111f" fill-opacity="0.72" stroke="#b8a2ff" stroke-opacity="0.35" filter="url(#shadow)"/>
    <text x="110" y="130" fill="#a78bfa" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2">AURIKREX BYTES</text>
    <rect x="110" y="150" width="120" height="4" fill="url(#line)"/>
    <text x="110" y="185" fill="#eef2ff" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">${titleLines.map((line, i) => `<tspan x="110" dy="${i === 0 ? 0 : 58}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="110" y="${bodyY}" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400">${bodyLines.map((line, i) => `<tspan x="110" dy="${i === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="110" y="510" fill="#8b5cf6" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">READ THE STORY</text>
    <text x="110" y="543" fill="#7dd3fc" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500">www.bytes.aurikrex.tech</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
function wrapTitle(title, maxCharsPerLine) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}
async function generateShareCard(post) {
  const coverBuffer = post.imageUrl ? await fetchRemoteImageBuffer(post.imageUrl) : null;
  return await buildShareSvg(post, coverBuffer);
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function sendPostPreview(req, res, next, mode) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();
  try {
    const post = await getPostById(id);
    if (!post || post.status !== "published")
      return res.status(404).send("Story not found");
    if (mode === "image") {
      const tmpDir = path.join(os.tmpdir(), "ab-share-cards");
      const cacheFile = path.join(tmpDir, `post-${id}.png`);
      let png;
      try {
        await fs.promises.mkdir(tmpDir, { recursive: true });
        if (fs.existsSync(cacheFile)) {
          png = await fs.promises.readFile(cacheFile);
        } else {
          png = await generateShareCard(post);
          await fs.promises.writeFile(cacheFile, png).catch(() => void 0);
        }
      } catch {
        png = await generateShareCard(post);
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      return res.status(200).end(png);
    }
    const seo = createPostSeo(post);
    if (mode === "share") {
      return res.status(200).type("html").send(renderShareDocument(seo));
    }
    const template = await readProductionShell();
    return res.status(200).type("html").send(injectPostSeo(template, seo));
  } catch (error) {
    console.warn(
      "[SEO] Dynamic post metadata could not be rendered:",
      error instanceof Error ? error.message : String(error)
    );
    return next(error);
  }
}
function registerSeoRoutes(app) {
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /falcon-system-auth",
        "Disallow: /api",
        `Sitemap: ${siteUrl()}/sitemap.xml`,
        ""
      ].join("\n")
    );
  });
  app.get("/sitemap.xml", async (_req, res) => {
    const staticPaths = [
      "/",
      "/archive",
      "/how-it-works",
      "/help",
      "/contact",
      "/privacy",
      "/terms"
    ];
    const urls = staticPaths.map(
      (pathValue) => `<url><loc>${xmlEscape(`${siteUrl()}${pathValue}`)}</loc></url>`
    );
    try {
      const posts2 = await listPublishedPosts();
      for (const post of posts2) {
        const lastmod = post.publishedTime || post.updatedAt;
        urls.push(
          `<url><loc>${xmlEscape(`${siteUrl()}/post/${post.id}`)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`
        );
      }
    } catch (error) {
      console.warn(
        "[SEO] Sitemap could not load published posts:",
        error instanceof Error ? error.message : String(error)
      );
    }
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`
    );
  });
  app.get("/post/:id", (req, res, next) => {
    if (process.env.NODE_ENV === "development") return next();
    return void sendPostPreview(req, res, next, "share");
  });
  app.get(
    "/api/share/post/:id",
    (req, res, next) => {
      return void sendPostPreview(req, res, next, "share");
    }
  );
  app.get(
    "/api/share/post/:id/image",
    (req, res, next) => {
      return void sendPostPreview(req, res, next, "image");
    }
  );
  app.get("/api/share/static", (req, res) => {
    const pathValue = req.query.path;
    const staticMap = {
      "root": { title: "Aurikrex Bytes \xE2\u20AC\u201D What matters in tech", description: "A focused editorial desk for shaping the next considered brief." },
      "archive": { title: "All Bytes \xE2\u20AC\u201D Aurikrex Bytes archive", description: "Read all published editions of Aurikrex Bytes." },
      "help": { title: "Help Center \xE2\u20AC\u201D Aurikrex Bytes", description: "Support and FAQs for Aurikrex Bytes." },
      "contact": { title: "Contact Us \xE2\u20AC\u201D Aurikrex Bytes", description: "Get in touch with the Aurikrex Bytes team." },
      "privacy": { title: "Privacy Policy \xE2\u20AC\u201D Aurikrex Bytes", description: "Privacy policy for Aurikrex Bytes." },
      "terms": { title: "Terms of Service \xE2\u20AC\u201D Aurikrex Bytes", description: "Terms of Service for Aurikrex Bytes." }
    };
    const metadata = staticMap[pathValue] || staticMap["root"];
    const seo = {
      title: metadata.title,
      description: metadata.description,
      headline: metadata.title,
      canonicalUrl: `${siteUrl()}/${pathValue === "root" ? "" : pathValue || ""}`,
      imageUrl: `${siteUrl()}/logo-512.png`
    };
    return res.status(200).type("html").send(renderShareDocument(seo));
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
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://accounts.google.com https://maps.googleapis.com; connect-src 'self' https://maps.googleapis.com https://api.cloudinary.com wss:; frame-src https://accounts.google.com; form-action 'self' https://accounts.google.com");
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
init_env();
init_db();
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
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      return res.json({ published: await publishDuePosts() });
    } catch (error) {
      console.error("[Cron] publish failed", error);
      return res.status(500).json({ error: "Publish job failed" });
    }
  });
  app.get("/api/cron/notify", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { sendDailyPushNotifications: sendDailyPushNotifications2 } = await Promise.resolve().then(() => (init_push(), push_exports));
      const sent = await sendDailyPushNotifications2();
      return res.json({ sent });
    } catch (error) {
      console.error("[Cron] notify failed", error);
      return res.status(500).json({ error: "Notify job failed" });
    }
  });
  app.get("/api/cron/curate", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { runNightlyCuration: runNightlyCuration2 } = await Promise.resolve().then(() => (init_aiCurator(), aiCurator_exports));
      const curated = await runNightlyCuration2();
      return res.json({ curated });
    } catch (error) {
      console.error("[Cron] curate failed", error);
      return res.status(500).json({ error: "Curation job failed" });
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
