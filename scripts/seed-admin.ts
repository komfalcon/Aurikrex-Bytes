/**
 * One-time local operation for creating the first admin account.
 *
 * Run locally with environment variables already configured; never commit their values
 * or run this in CI:
 *
 * TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm tsx scripts/seed-admin.ts
 */

import { adminUsers } from "../drizzle/schema";
import { hashPassword, normalizeEmail } from "../server/auth";
import { getAdminByEmail, getDb } from "../server/db";

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const seedEmail = process.env.SEED_ADMIN_EMAIL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (!databaseUrl || !authToken || !seedEmail || !seedPassword) {
  throw new Error(
    "TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required"
  );
}

const email = normalizeEmail(seedEmail);
if (!email) throw new Error("SEED_ADMIN_EMAIL must not be empty");

const db = await getDb();
if (!db) throw new Error("Unable to connect to the database");

const existingAdmin = await getAdminByEmail(email);
if (existingAdmin) {
  console.log(`Admin account already exists for ${email}`);
  process.exit(0);
}

const passwordHash = await hashPassword(seedPassword);
await db.insert(adminUsers).values({
  email,
  passwordHash,
  role: "admin",
});

console.log(`Admin account created for ${email}`);
process.exit(0);
