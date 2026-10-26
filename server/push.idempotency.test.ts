import { describe, expect, it, beforeEach } from "vitest";
import { getDb } from "./db.js";
import { pushSends, readers, adminUsers, oneSignalSubscriptions, posts } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { resolvePushSlot, getLagosParts } from "./pushConfig.js";
import { claimPushSlot, updatePushSend, listEditionPublishedPosts } from "./pushLedger.js";
import { safeCompareSecrets } from "./_core/security.js";
import { processPushTrigger } from "./push.js";

describe("Push Slot & Window Resolution (Africa/Lagos)", () => {
  it("resolves morning window (08:00 - 11:00 WAT)", () => {
    // 08:30 Lagos on 2026-10-26 is 07:30 UTC
    const morningTime = new Date(Date.UTC(2026, 9, 26, 7, 30, 0));
    const res = resolvePushSlot(undefined, morningTime);
    expect(res.isValid).toBe(true);
    expect(res.slot).toBe("morning");
    expect(res.editionDate).toBe("2026-10-26");
    expect(res.scheduledFor?.toISOString()).toBe("2026-10-26T07:00:00.000Z");

    // 07:59:59 Lagos (06:59:59 UTC) -> outside morning window
    const earlyMorning = new Date(Date.UTC(2026, 9, 26, 6, 59, 59));
    const earlyRes = resolvePushSlot(undefined, earlyMorning);
    expect(earlyRes.isValid).toBe(false);
    expect(earlyRes.status).toBe("outside_window");

    // 11:00:00 Lagos (10:00:00 UTC) -> outside morning window
    const lateMorning = new Date(Date.UTC(2026, 9, 26, 10, 0, 0));
    const lateRes = resolvePushSlot(undefined, lateMorning);
    expect(lateRes.isValid).toBe(false);
    expect(lateRes.status).toBe("outside_window");
  });

  it("resolves evening window (22:00 - 01:00 WAT) including post-midnight", () => {
    // 22:15 Lagos on 2026-10-26 is 21:15 UTC
    const eveningTime = new Date(Date.UTC(2026, 9, 26, 21, 15, 0));
    const res = resolvePushSlot(undefined, eveningTime);
    expect(res.isValid).toBe(true);
    expect(res.slot).toBe("evening");
    expect(res.editionDate).toBe("2026-10-26");
    expect(res.scheduledFor?.toISOString()).toBe("2026-10-26T21:00:00.000Z");

    // 00:30 Lagos on 2026-10-27 is 23:30 UTC on 2026-10-26
    const postMidnightTime = new Date(Date.UTC(2026, 9, 26, 23, 30, 0));
    const midnightRes = resolvePushSlot(undefined, postMidnightTime);
    expect(midnightRes.isValid).toBe(true);
    expect(midnightRes.slot).toBe("evening");
    // Edition date must map to yesterday's evening edition (2026-10-26)
    expect(midnightRes.editionDate).toBe("2026-10-26");
    expect(midnightRes.scheduledFor?.toISOString()).toBe("2026-10-26T21:00:00.000Z");

    // 01:00:00 Lagos (00:00:00 UTC on Oct 27) -> outside evening window
    const pastOneAm = new Date(Date.UTC(2026, 9, 27, 0, 0, 0));
    const pastRes = resolvePushSlot(undefined, pastOneAm);
    expect(pastRes.isValid).toBe(false);
    expect(pastRes.status).toBe("outside_window");
  });

  it("supports test mode with ignoreWindow = true", () => {
    // 14:00 Lagos (normally outside any window)
    const afternoon = new Date(Date.UTC(2026, 9, 26, 13, 0, 0));
    const strictRes = resolvePushSlot(undefined, afternoon, false);
    expect(strictRes.isValid).toBe(false);

    const testRes = resolvePushSlot("morning", afternoon, true);
    expect(testRes.isValid).toBe(true);
    expect(testRes.slot).toBe("morning");
    expect(testRes.editionDate).toBe("2026-10-26");
  });
});

describe("Constant-Time Secret Comparison", () => {
  it("accurately and safely compares authorization secrets", () => {
    const secret = "aurikrex-test-super-secret-token-12345";
    expect(safeCompareSecrets(secret, secret)).toBe(true);
    expect(safeCompareSecrets("wrong-token", secret)).toBe(false);
    expect(safeCompareSecrets(secret + "extra", secret)).toBe(false);
    expect(safeCompareSecrets("", secret)).toBe(false);
    expect(safeCompareSecrets(undefined, secret)).toBe(false);
    expect(safeCompareSecrets(secret, null)).toBe(false);
  });
});

describe("Push Ledger & Atomic Claim Guards", () => {
  const testEditionDate = "2026-12-01";
  const testSlot = "morning" as const;
  const testScheduled = new Date("2026-12-01T07:00:00.000Z");

  beforeEach(async () => {
    const db = await getDb();
    if (db) {
      await db
        .delete(pushSends)
        .where(and(eq(pushSends.editionDate, testEditionDate), eq(pushSends.slot, testSlot)));
    }
  });

  it("allows initial claim and blocks concurrent second attempt", async () => {
    const now = new Date();

    // 1. Initial claim
    const claim1 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cron-job-org",
      scheduledFor: testScheduled,
      now,
    });
    expect(claim1.claimed).toBe(true);
    if (!claim1.claimed) return;
    expect(claim1.attempts).toBe(1);

    // 2. Immediate concurrent second attempt in the same second
    const claim2 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cloudflare",
      scheduledFor: testScheduled,
      now,
    });
    expect(claim2.claimed).toBe(false);
    if (claim2.claimed) return;
    expect(claim2.status).toBe("in_progress");
  });

  it("returns already_done once row is marked sent or skipped", async () => {
    const now = new Date();
    const claim1 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cron-job-org",
      scheduledFor: testScheduled,
      now,
    });
    expect(claim1.claimed).toBe(true);
    if (!claim1.claimed) return;

    // Mark sent
    await updatePushSend(claim1.sendId, {
      status: "sent",
      finishedAt: new Date(),
      recipientsCount: 42,
    });

    // Subsequent trigger returns already_done
    const claim2 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cloudflare",
      scheduledFor: testScheduled,
      now,
    });
    expect(claim2.claimed).toBe(false);
    if (claim2.claimed) return;
    expect(claim2.status).toBe("already_done");
  });

  it("reclaims failed attempt when attempts < 3", async () => {
    const now = new Date();
    const claim1 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cron-job-org",
      scheduledFor: testScheduled,
      now,
    });
    expect(claim1.claimed).toBe(true);
    if (!claim1.claimed) return;

    // Mark failed on attempt 1
    await updatePushSend(claim1.sendId, {
      status: "failed",
      finishedAt: new Date(),
      error: "OneSignal temporary 503",
    });

    // Reclaim attempt (attempt 2)
    const claim2 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cloudflare",
      scheduledFor: testScheduled,
      now: new Date(now.getTime() + 30_000),
    });
    expect(claim2.claimed).toBe(true);
    if (!claim2.claimed) return;
    expect(claim2.attempts).toBe(2);

    // Fail again
    await updatePushSend(claim2.sendId, {
      status: "failed",
      finishedAt: new Date(),
      error: "OneSignal temporary 503 again",
    });

    // Reclaim attempt (attempt 3)
    const claim3 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "manual",
      scheduledFor: testScheduled,
      now: new Date(now.getTime() + 60_000),
    });
    expect(claim3.claimed).toBe(true);
    if (!claim3.claimed) return;
    expect(claim3.attempts).toBe(3);

    // Fail attempt 3
    await updatePushSend(claim3.sendId, {
      status: "failed",
      finishedAt: new Date(),
      error: "Third failure",
    });

    // Fourth attempt: attempts >= 3 -> max_attempts_exceeded
    const claim4 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "manual",
      scheduledFor: testScheduled,
      now: new Date(now.getTime() + 90_000),
    });
    expect(claim4.claimed).toBe(false);
    if (claim4.claimed) return;
    expect(claim4.status).toBe("max_attempts_exceeded");
  });

  it("reclaims stale sending claim older than 5 minutes", async () => {
    const oldTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
    const claim1 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cron-job-org",
      scheduledFor: testScheduled,
      now: oldTime,
    });
    expect(claim1.claimed).toBe(true);
    if (!claim1.claimed) return;

    // Trigger arrives now (6 mins later, original still marked 'sending')
    const claim2 = await claimPushSlot({
      editionDate: testEditionDate,
      slot: testSlot,
      triggerSource: "cloudflare",
      scheduledFor: testScheduled,
      now: new Date(),
    });
    expect(claim2.claimed).toBe(true);
    if (!claim2.claimed) return;
    expect(claim2.attempts).toBe(2);
  });
});

describe("DryRun & Skip Semantics", () => {
  it("dryRun returns preview without claiming or writing to push_sends ledger", async () => {
    const res = await processPushTrigger({
      requestedSlot: "morning",
      triggerSource: "manual",
      dryRun: true,
      now: new Date("2026-10-26T07:30:00Z"),
    });

    expect(res).toBeDefined();
    expect(res.dryRun).toBe(true);
    expect(res.slot).toBe("morning");
    expect(res.editionDate).toBe("2026-10-26");

    // Verify no ledger row created with status 'sending'
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(pushSends)
        .where(eq(pushSends.editionDate, "2026-10-26"));
      // Dry run must never claim or write sending rows
      const sending = rows.filter(r => r.status === "sending");
      expect(sending.length).toBe(0);
    }
  });

  it("skips and does NOT fall back to yesterday's story if target edition has no published posts", async () => {
    const emptyEditionDate = "2028-01-01"; // Future date with no posts
    const res = await processPushTrigger({
      requestedSlot: "morning",
      triggerSource: "manual",
      now: new Date("2028-01-01T07:30:00Z"),
    });

    expect(res).toBeDefined();
    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("no_published_posts");

    // Verify row in ledger is marked 'skipped'
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(pushSends)
        .where(
          and(eq(pushSends.editionDate, emptyEditionDate), eq(pushSends.slot, "morning"))
        );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("skipped");
      expect(rows[0].error).toContain("No published posts");
    }
  });
});
