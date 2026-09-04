import { createClient } from "@libsql/client";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { adminUsers, InsertUser, posts, readers, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.TURSO_DATABASE_URL) {
    try {
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { updatedAt: new Date(), lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod", "role"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] as never;
      updateSet[field] = user[field];
    }
  }
  if (user.openId === ENV.ownerOpenId && user.role === undefined) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getAdminByRememberToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.rememberDeviceToken, token)).limit(1);
  return result[0];
}

export async function getReaderByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(readers).where(eq(readers.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getReaderByVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(readers).where(eq(readers.verificationToken, token)).limit(1);
  return result[0];
}

export async function getReaderByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(readers).where(and(eq(readers.resetToken, token), gt(readers.resetTokenExpires, new Date()))).limit(1);
  return result[0];
}

export async function listPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(posts.updatedAt);
}
