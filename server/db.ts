import { createClient } from "@libsql/client";
import { and, asc, desc, eq, gt, inArray, like, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  adminUsers,
  InsertUser,
  postBookmarks,
  postReactions,
  postViews,
  posts,
  readers,
  searchQueries,
  users,
} from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { updateDailyStreak } from "./streak.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _schemaRepair: Promise<void> | null = null;

async function repairReaderSchema(db: ReturnType<typeof drizzle>) {
  const columns = await db.all(sql.raw("PRAGMA table_info('readers')"));
  const names = new Set(
    columns.map(column => (column as { name?: string }).name).filter(Boolean)
  );
  const repairs = [
    ["name", "text DEFAULT '' NOT NULL"],
    ["verification_token_used", "text"],
    ["current_streak", "integer DEFAULT 0 NOT NULL"],
    ["longest_streak", "integer DEFAULT 0 NOT NULL"],
    ["last_active_date", "text"],
  ] as const;
  for (const [name, definition] of repairs) {
    if (names.has(name)) continue;
    await db.run(sql.raw(`ALTER TABLE readers ADD COLUMN ${name} ${definition}`));
    console.info(`[Database] Applied missing readers.${name} column`);
  }
}

async function repairEngagementSchema(db: ReturnType<typeof drizzle>) {
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

export async function getDb() {
  if (!_db && process.env.TURSO_DATABASE_URL) {
    try {
      _db = drizzle(
        createClient({
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        })
      );
      _schemaRepair = Promise.all([repairReaderSchema(_db), repairEngagementSchema(_db)]).then(() => undefined).catch(error => {
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
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = {
    openId: user.openId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  for (const field of ["name", "email", "loginMethod", "role"] as const)
    if (user[field] !== undefined) {
      values[field] = user[field] as never;
      updateSet[field] = user[field];
    }
  if (user.openId === ENV.ownerOpenId && user.role === undefined) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}
export async function getAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}
export async function getAdminById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  return result[0];
}
export async function getAdminByRememberToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.rememberDeviceToken, token))
    .limit(1);
  return result[0];
}
export async function listAdmins() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt);
}
export async function getReaderByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(readers)
    .where(eq(readers.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}
export async function getReaderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(readers)
    .where(eq(readers.id, id))
    .limit(1);
  return result[0];
}
export async function getReaderByVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(readers)
    .where(eq(readers.verificationToken, token))
    .limit(1);
  return result[0];
}
export async function getReaderByUsedVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(readers)
    .where(eq(readers.verificationTokenUsed, token))
    .limit(1);
  return result[0];
}
export async function getReaderByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(readers)
    .where(
      and(
        eq(readers.resetToken, token),
        gt(readers.resetTokenExpires, new Date())
      )
    )
    .limit(1);
  return result[0];
}
export async function listPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(posts.updatedAt);
}
export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0];
}
export async function publishDuePosts() {
  const db = await getDb();
  if (!db) return 0;
  const due = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(eq(posts.status, "scheduled"), lt(posts.scheduledTime, new Date()))
    );
  for (const post of due)
    await db
      .update(posts)
      .set({
        status: "published",
        publishedTime: new Date(),
        scheduledTime: null,
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, post.id), eq(posts.status, "scheduled")));
  return due.length;
}
export async function listPublishedPosts(readerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: posts.id,
      headline: posts.headline,
      body: posts.body,
      imageUrl: posts.imageUrl,
      publishedTime: posts.publishedTime,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedTime), desc(posts.id));
  return addEngagement(rows, readerId);
}

async function addEngagement<T extends { id: number }>(rows: T[], readerId?: number) {
  const db = await getDb();
  if (!db || !rows.length) return rows.map(row => ({ ...row, reactionCount: 0, hasReacted: false, isBookmarked: false }));
  const ids = rows.map(row => row.id);
  let reactions;
  let bookmarks;
  try {
    [reactions, bookmarks] = await Promise.all([
      db.select().from(postReactions).where(inArray(postReactions.postId, ids)),
      db.select().from(postBookmarks).where(inArray(postBookmarks.postId, ids)),
    ]);
  } catch (error) {
    console.warn("[Database] Engagement tables are unavailable; serving posts without engagement state", error);
    return rows.map(row => ({ ...row, reactionCount: 0, hasReacted: false, isBookmarked: false }));
  }
  const reactionCounts = new Map<number, number>();
  reactions.forEach(reaction => reactionCounts.set(reaction.postId, (reactionCounts.get(reaction.postId) || 0) + 1));
  const reacted = new Set(reactions.filter(reaction => reaction.readerId === readerId).map(reaction => reaction.postId));
  const saved = new Set(bookmarks.filter(bookmark => bookmark.readerId === readerId).map(bookmark => bookmark.postId));
  return rows.map(row => ({ ...row, reactionCount: reactionCounts.get(row.id) || 0, hasReacted: reacted.has(row.id), isBookmarked: saved.has(row.id) }));
}
export function localCalendarDay(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export async function getReaderDashboard(
  readerId: number,
  timeZone = process.env.APP_TIMEZONE || "UTC"
) {
  const db = await getDb();
  if (!db) return undefined;
  const reader = await getReaderById(readerId);
  if (!reader) return undefined;
  const today = localCalendarDay(new Date(), timeZone);
  const streak = updateDailyStreak(
    {
      currentStreak: reader.currentStreak,
      longestStreak: reader.longestStreak,
      lastActiveDate: reader.lastActiveDate,
    },
    today
  );
  if (streak.increased)
    await db
      .update(readers)
      .set({
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDate: streak.lastActiveDate,
      })
      .where(eq(readers.id, readerId));
  const [todayPosts, allPosts] = await Promise.all([
    listTodaysPublishedPosts(timeZone, readerId),
    listPublishedPosts(readerId),
  ]);
  return {
    reader: { id: reader.id, name: reader.name, email: reader.email },
    streak,
    todayPosts,
    allPosts,
  };
}
export async function listTodaysPublishedPosts(
  timeZone = process.env.APP_TIMEZONE || "UTC",
  readerId?: number
) {
  const db = await getDb();
  if (!db) return [];
  const today = localCalendarDay(new Date(), timeZone);
  const published = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(asc(posts.publishedTime));
  return addEngagement(published.filter(
    post =>
      post.publishedTime &&
      localCalendarDay(post.publishedTime, timeZone) === today
  ), readerId);
}
export async function getPublishedPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.status, "published")))
    .limit(1);
  return result[0] ? (await addEngagement(result))[0] : undefined;
}

export async function getReaderPostEngagement(postId: number, readerId: number) {
  const db = await getDb();
  if (!db) return { reactionCount: 0, hasReacted: false, isBookmarked: false };
  const [reactions, bookmark] = await Promise.all([
    db.select().from(postReactions).where(eq(postReactions.postId, postId)),
    db.select().from(postBookmarks).where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.readerId, readerId))).limit(1),
  ]);
  return { reactionCount: reactions.length, hasReacted: reactions.some(reaction => reaction.readerId === readerId), isBookmarked: Boolean(bookmark[0]) };
}

export async function togglePostReaction(postId: number, readerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.readerId, readerId))).limit(1);
  if (existing[0]) await db.delete(postReactions).where(eq(postReactions.id, existing[0].id));
  else await db.insert(postReactions).values({ postId, readerId, createdAt: new Date() });
  return getReaderPostEngagement(postId, readerId);
}

export async function togglePostBookmark(postId: number, readerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(postBookmarks).where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.readerId, readerId))).limit(1);
  if (existing[0]) await db.delete(postBookmarks).where(eq(postBookmarks.id, existing[0].id));
  else await db.insert(postBookmarks).values({ postId, readerId, createdAt: new Date() });
  return getReaderPostEngagement(postId, readerId);
}

export async function listSavedPosts(readerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: posts.id,
    headline: posts.headline,
    body: posts.body,
    imageUrl: posts.imageUrl,
    publishedTime: posts.publishedTime,
    updatedAt: posts.updatedAt,
    savedAt: postBookmarks.createdAt,
  }).from(postBookmarks).innerJoin(posts, eq(posts.id, postBookmarks.postId)).where(and(eq(postBookmarks.readerId, readerId), eq(posts.status, "published"))).orderBy(desc(postBookmarks.createdAt));
  return addEngagement(rows, readerId);
}
export async function searchPublishedPosts(
  query: string,
  page: number,
  pageSize: number
) {
  const db = await getDb();
  if (!db) return { posts: [], nextPage: null as number | null };
  const normalizedQuery = query.trim().toLowerCase();
  const search = normalizedQuery
    ? or(
        like(posts.headline, `%${normalizedQuery}%`),
        like(posts.body, `%${normalizedQuery}%`)
      )
    : undefined;
  const where = search
    ? and(eq(posts.status, "published"), search)
    : eq(posts.status, "published");
  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishedTime), desc(posts.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return {
    posts: await addEngagement(rows.slice(0, pageSize)),
    nextPage: rows.length > pageSize ? page + 1 : null,
  };
}
export async function recordPostView(postId: number, readerId?: number) {
  const db = await getDb();
  if (db)
    await db
      .insert(postViews)
      .values({ postId, readerId: readerId ?? null, viewedAt: new Date() });
}
export async function recordSearchQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  const db = await getDb();
  if (db && normalized)
    await db
      .insert(searchQueries)
      .values({ query: normalized, searchedAt: new Date() });
}
export async function getAnalytics() {
  const db = await getDb();
  if (!db)
    return {
      totalReaders: 0,
      totalViews: 0,
      mostRead: [],
      topSearches: [],
      viewsByHour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        views: 0,
      })),
    };
  const [published, views, searches, readerRows] = await Promise.all([
    db
      .select({ id: posts.id, headline: posts.headline, status: posts.status })
      .from(posts)
      .where(eq(posts.status, "published")),
    db.select().from(postViews),
    db.select().from(searchQueries),
    db.select({ id: readers.id }).from(readers),
  ]);
  const titles = new Map(published.map(post => [post.id, post.headline]));
  const viewCounts = new Map<number, number>();
  const hourCounts = new Map<number, number>();
  for (const view of views) {
    if (!titles.has(view.postId)) continue;
    viewCounts.set(view.postId, (viewCounts.get(view.postId) || 0) + 1);
    const hour =
      Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
        }).format(new Date(view.viewedAt))
      ) % 24;
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }
  const searchCounts = new Map<string, number>();
  for (const entry of searches)
    searchCounts.set(entry.query, (searchCounts.get(entry.query) || 0) + 1);
  return {
    totalReaders: readerRows.length,
    totalViews: views.length,
    mostRead: Array.from(viewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, viewCount]) => ({ id, headline: titles.get(id), viewCount })),
    topSearches: Array.from(searchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count })),
    viewsByHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      views: hourCounts.get(hour) || 0,
    })),
  };
}
