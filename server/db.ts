import { createClient } from "@libsql/client";
import { and, asc, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { adminUsers, InsertUser, postViews, posts, readers, searchQueries, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.TURSO_DATABASE_URL) {
    try { _db = drizzle(createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert"); const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }; const updateSet: Record<string, unknown> = { updatedAt: new Date(), lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod", "role"] as const) if (user[field] !== undefined) { values[field] = user[field] as never; updateSet[field] = user[field]; }
  if (user.openId === ENV.ownerOpenId && user.role === undefined) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function getAdminByEmail(email: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase())).limit(1); return result[0]; }
export async function getAdminById(id: number) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1); return result[0]; }
export async function getAdminByRememberToken(token: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(adminUsers).where(eq(adminUsers.rememberDeviceToken, token)).limit(1); return result[0]; }
export async function listAdmins() { const db = await getDb(); if (!db) return []; return db.select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role, isActive: adminUsers.isActive, createdAt: adminUsers.createdAt }).from(adminUsers).orderBy(adminUsers.createdAt); }
export async function getReaderByEmail(email: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(readers).where(eq(readers.email, email.toLowerCase())).limit(1); return result[0]; }
export async function getReaderByVerificationToken(token: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(readers).where(eq(readers.verificationToken, token)).limit(1); return result[0]; }
export async function getReaderByResetToken(token: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(readers).where(and(eq(readers.resetToken, token), gt(readers.resetTokenExpires, new Date()))).limit(1); return result[0]; }
export async function listPosts() { const db = await getDb(); if (!db) return []; return db.select().from(posts).orderBy(posts.updatedAt); }
export async function getPostById(id: number) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1); return result[0]; }
export async function publishDuePosts() {
  const db = await getDb(); if (!db) return 0;
  const due = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.status, "scheduled"), lt(posts.scheduledTime, new Date())));
  for (const post of due) await db.update(posts).set({ status: "published", publishedTime: new Date(), scheduledTime: null, updatedAt: new Date() }).where(and(eq(posts.id, post.id), eq(posts.status, "scheduled")));
  return due.length;
}
export async function listPublishedPosts() { const db = await getDb(); if (!db) return []; return db.select({ id: posts.id, headline: posts.headline, imageUrl: posts.imageUrl, publishedTime: posts.publishedTime, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedTime), desc(posts.id)); }
function localCalendarDay(value: Date, timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
export async function listTodaysPublishedPosts(timeZone = process.env.APP_TIMEZONE || "UTC") { const db = await getDb(); if (!db) return []; const today = localCalendarDay(new Date(), timeZone); const published = await db.select().from(posts).where(eq(posts.status, "published")).orderBy(asc(posts.publishedTime)); return published.filter(post => post.publishedTime && localCalendarDay(post.publishedTime, timeZone) === today); }
export async function getPublishedPostById(id: number) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.status, "published"))).limit(1); return result[0]; }
export async function searchPublishedPosts(query: string, page: number, pageSize: number) { const db = await getDb(); if (!db) return { posts: [], nextPage: null as number | null }; const normalizedQuery = query.trim().toLowerCase(); const search = normalizedQuery ? or(like(posts.headline, `%${normalizedQuery}%`), like(posts.body, `%${normalizedQuery}%`)) : undefined; const where = search ? and(eq(posts.status, "published"), search) : eq(posts.status, "published"); const rows = await db.select().from(posts).where(where).orderBy(desc(posts.publishedTime), desc(posts.id)).limit(pageSize + 1).offset((page - 1) * pageSize); return { posts: rows.slice(0, pageSize), nextPage: rows.length > pageSize ? page + 1 : null }; }
export async function recordPostView(postId: number, readerId?: number) { const db = await getDb(); if (db) await db.insert(postViews).values({ postId, readerId: readerId ?? null, viewedAt: new Date() }); }
export async function recordSearchQuery(query: string) { const normalized = query.trim().toLowerCase(); const db = await getDb(); if (db && normalized) await db.insert(searchQueries).values({ query: normalized, searchedAt: new Date() }); }
export async function getAnalytics() {
  const db = await getDb(); if (!db) return { totalReaders: 0, totalViews: 0, mostRead: [], topSearches: [], viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 })) };
  const [published, views, searches, readerRows] = await Promise.all([db.select({ id: posts.id, headline: posts.headline, status: posts.status }).from(posts).where(eq(posts.status, "published")), db.select().from(postViews), db.select().from(searchQueries), db.select({ id: readers.id }).from(readers)]);
  const titles = new Map(published.map(post => [post.id, post.headline])); const viewCounts = new Map<number, number>(); const hourCounts = new Map<number, number>();
  for (const view of views) { if (!titles.has(view.postId)) continue; viewCounts.set(view.postId, (viewCounts.get(view.postId) || 0) + 1); const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }).format(new Date(view.viewedAt))) % 24; hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1); }
  const searchCounts = new Map<string, number>(); for (const entry of searches) searchCounts.set(entry.query, (searchCounts.get(entry.query) || 0) + 1);
  return { totalReaders: readerRows.length, totalViews: views.length, mostRead: Array.from(viewCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, viewCount]) => ({ id, headline: titles.get(id), viewCount })), topSearches: Array.from(searchCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })), viewsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, views: hourCounts.get(hour) || 0 })) };
}
