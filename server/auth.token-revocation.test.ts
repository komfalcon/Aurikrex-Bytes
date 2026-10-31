import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import { createToken } from "./auth.js";
import { getDb } from "./db.js";
import { readers, adminUsers } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

describe("Token versioning and revocation on password change", () => {
  it("rejects reader access if tokenVersion in JWT does not match database version", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const testEmail = `token_test_${Date.now()}@example.com`;
    const [reader] = await db
      .insert(readers)
      .values({
        email: testEmail,
        name: "Token Test User",
        emailVerified: true,
        tokenVersion: 2,
      })
      .returning();

    // 1. Old stolen token with version 1
    const oldStolenToken = createToken({
      kind: "reader",
      id: reader.id,
      email: reader.email,
      verified: true,
      tokenVersion: 1,
    });

    const oldCaller = appRouter.createCaller({
      user: null,
      req: {
        protocol: "https",
        headers: { cookie: `aurikrex_reader_session=${oldStolenToken}` },
      } as never,
      res: {} as never,
    });

    // Calling any reader-protected procedure should fail
    await expect(oldCaller.reader.saved()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session expired or revoked. Please sign in again.",
    });

    // 2. Current valid token with version 2
    const currentValidToken = createToken({
      kind: "reader",
      id: reader.id,
      email: reader.email,
      verified: true,
      tokenVersion: 2,
    });

    const validCaller = appRouter.createCaller({
      user: null,
      req: {
        protocol: "https",
        headers: { cookie: `aurikrex_reader_session=${currentValidToken}` },
      } as never,
      res: {} as never,
    });

    // Should succeed and return empty saved list
    const saved = await validCaller.reader.saved();
    expect(Array.isArray(saved)).toBe(true);

    // 3. Unversioned legacy token when user is on version > 1
    const unversionedToken = createToken({
      kind: "reader",
      id: reader.id,
      email: reader.email,
      verified: true,
    });

    const unversionedCaller = appRouter.createCaller({
      user: null,
      req: {
        protocol: "https",
        headers: { cookie: `aurikrex_reader_session=${unversionedToken}` },
      } as never,
      res: {} as never,
    });

    await expect(unversionedCaller.reader.saved()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session expired or revoked. Please sign in again.",
    });

    // Clean up
    await db.delete(readers).where(eq(readers.id, reader.id));
  });

  it("bumps tokenVersion and invalidates old tokens after password reset", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const testEmail = `pw_reset_test_${Date.now()}@example.com`;
    const resetToken = `reset_token_test_${Date.now()}`;
    const [reader] = await db
      .insert(readers)
      .values({
        email: testEmail,
        name: "Reset Test User",
        emailVerified: true,
        resetToken: resetToken,
        resetTokenExpires: new Date(Date.now() + 60_000),
        tokenVersion: 1,
      })
      .returning();

    // Generate token prior to password reset
    const preResetToken = createToken({
      kind: "reader",
      id: reader.id,
      email: reader.email,
      verified: true,
      tokenVersion: 1,
    });

    // Caller before reset works
    const preResetCaller = appRouter.createCaller({
      user: null,
      req: {
        protocol: "https",
        headers: { cookie: `aurikrex_reader_session=${preResetToken}` },
      } as never,
      res: {} as never,
    });
    expect(Array.isArray(await preResetCaller.reader.saved())).toBe(true);

    // Perform password reset
    const publicCaller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    });

    const resetResult = await publicCaller.reader.resetPassword({
      token: resetToken,
      password: "NewPassword123#@",
    });
    expect(resetResult.success).toBe(true);

    // Verify tokenVersion bumped in DB
    const [updatedReader] = await db.select().from(readers).where(eq(readers.id, reader.id));
    expect(updatedReader.tokenVersion).toBe(2);

    // Now the preResetToken MUST fail immediately!
    await expect(preResetCaller.reader.saved()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session expired or revoked. Please sign in again.",
    });

    // Clean up
    await db.delete(readers).where(eq(readers.id, reader.id));
  });
});
