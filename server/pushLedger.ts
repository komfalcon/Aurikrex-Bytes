import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  adminUsers,
  oneSignalSubscriptions,
  posts,
  pushSends,
  readers,
} from "../drizzle/schema.js";
import { getDb, localCalendarDay } from "./db.js";
import { PUSH_TIMEZONE } from "./pushConfig.js";

export type ClaimResult =
  | { claimed: true; sendId: number; attempts: number }
  | {
      claimed: false;
      status: "already_done" | "in_progress" | "max_attempts_exceeded";
      error?: string | null;
      existing?: any;
    };

/**
 * Atomically claims a push send slot in the ledger.
 * Guarantee: Two concurrent triggers within the same millisecond cannot both claim.
 *
 * Supports ?force=1 to reclaim 'skipped' or 'failed' slots (even if max attempts hit).
 * Reclaims 'sent' slot only if BOTH ?force=1 and ?resend=1 are passed; otherwise refuses.
 */
export async function claimPushSlot(params: {
  editionDate: string;
  slot: "morning" | "evening";
  triggerSource: string;
  scheduledFor: Date;
  now?: Date;
  force?: boolean;
  resend?: boolean;
}): Promise<ClaimResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const nowMs = params.now ? params.now.getTime() : Date.now();
  const startedAt = new Date(nowMs);
  const effectiveTriggerSource = params.force ? "manual" : params.triggerSource;

  // 1. Try atomic INSERT
  try {
    const inserted = await db
      .insert(pushSends)
      .values({
        editionDate: params.editionDate,
        slot: params.slot,
        status: "sending",
        triggerSource: effectiveTriggerSource,
        scheduledFor: params.scheduledFor,
        startedAt,
        attempts: 1,
      })
      .returning({ id: pushSends.id });

    if (inserted && inserted[0]?.id) {
      return { claimed: true, sendId: inserted[0].id, attempts: 1 };
    }
  } catch {
    // Unique constraint violation or collision: inspect existing row
  }

  // 2. Fetch existing row
  const rows = await db
    .select()
    .from(pushSends)
    .where(
      and(
        eq(pushSends.editionDate, params.editionDate),
        eq(pushSends.slot, params.slot)
      )
    )
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    throw new Error("Unable to claim or read push_sends ledger row");
  }

  // Handle existing 'sent' status
  if (existing.status === "sent") {
    if (params.force && params.resend) {
      // Reclaim for resend and log
      const reclaimed = await db
        .update(pushSends)
        .set({
          status: "sending",
          triggerSource: "manual",
          startedAt,
          finishedAt: null,
          error: `Manual resend initiated at ${new Date().toISOString()}`,
          attempts: 1,
        })
        .where(eq(pushSends.id, existing.id))
        .returning({ id: pushSends.id });

      if (reclaimed && reclaimed.length > 0) {
        return { claimed: true, sendId: existing.id, attempts: 1 };
      }
    }
    return {
      claimed: false,
      status: "already_done",
      error: "Slot already sent. Pass force=1&resend=1 to resend.",
      existing,
    };
  }

  // Handle existing 'skipped' status
  if (existing.status === "skipped") {
    if (params.force) {
      const reclaimed = await db
        .update(pushSends)
        .set({
          status: "sending",
          triggerSource: "manual",
          startedAt,
          finishedAt: null,
          error: null,
          attempts: 1,
        })
        .where(eq(pushSends.id, existing.id))
        .returning({ id: pushSends.id });

      if (reclaimed && reclaimed.length > 0) {
        return { claimed: true, sendId: existing.id, attempts: 1 };
      }
    }
    return { claimed: false, status: "already_done", existing };
  }

  // Handle existing 'failed' status
  if (existing.status === "failed") {
    if (existing.attempts >= 3 && !params.force) {
      return {
        claimed: false,
        status: "max_attempts_exceeded",
        error: existing.error,
        existing,
      };
    }

    const nextAttempts = params.force ? 1 : existing.attempts + 1;
    const reclaimed = await db
      .update(pushSends)
      .set({
        status: "sending",
        triggerSource: params.force ? "manual" : params.triggerSource,
        startedAt,
        finishedAt: null,
        error: params.force ? null : existing.error,
        attempts: nextAttempts,
      })
      .where(
        and(
          eq(pushSends.id, existing.id),
          eq(pushSends.status, "failed")
        )
      )
      .returning({ id: pushSends.id });

    if (reclaimed && reclaimed.length > 0) {
      return { claimed: true, sendId: existing.id, attempts: nextAttempts };
    }

    return { claimed: false, status: "in_progress", existing };
  }

  // Sending older than 5 minutes -> Stale claim, reclaim
  const startedAtMs =
    existing.startedAt instanceof Date
      ? existing.startedAt.getTime()
      : Number(existing.startedAt);
  const isStale = nowMs - startedAtMs > 5 * 60 * 1000;

  if (existing.status === "sending" && (isStale || params.force)) {
    if (existing.attempts >= 3 && !params.force) {
      return {
        claimed: false,
        status: "max_attempts_exceeded",
        error: existing.error,
        existing,
      };
    }

    const nextAttempts = params.force ? 1 : existing.attempts + 1;
    const reclaimed = await db
      .update(pushSends)
      .set({
        status: "sending",
        triggerSource: params.force ? "manual" : params.triggerSource,
        startedAt,
        finishedAt: null,
        error: params.force ? "Forced reclaim" : "Reclaimed stale sending claim",
        attempts: nextAttempts,
      })
      .where(
        and(
          eq(pushSends.id, existing.id),
          eq(pushSends.status, "sending")
        )
      )
      .returning({ id: pushSends.id });

    if (reclaimed && reclaimed.length > 0) {
      return { claimed: true, sendId: existing.id, attempts: nextAttempts };
    }

    return { claimed: false, status: "in_progress", existing };
  }

  // Active send in progress (< 5 min)
  return { claimed: false, status: "in_progress", existing };
}

/**
 * Updates a push send row in the ledger with final delivery results or error state.
 */
export async function updatePushSend(
  sendId: number,
  updates: {
    status?: "sending" | "sent" | "failed" | "skipped";
    finishedAt?: Date;
    leadPostId?: number | null;
    postsCount?: number;
    recipientsCount?: number;
    onesignalNotificationIds?: string[];
    invalidRemovedCount?: number;
    error?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;

  const setObj: Record<string, any> = {};
  if (updates.status) setObj.status = updates.status;
  if (updates.finishedAt) setObj.finishedAt = updates.finishedAt;
  if (updates.leadPostId !== undefined) setObj.leadPostId = updates.leadPostId;
  if (updates.postsCount !== undefined) setObj.postsCount = updates.postsCount;
  if (updates.recipientsCount !== undefined)
    setObj.recipientsCount = updates.recipientsCount;
  if (updates.onesignalNotificationIds) {
    setObj.onesignalNotificationIds = JSON.stringify(
      updates.onesignalNotificationIds
    );
  }
  if (updates.invalidRemovedCount !== undefined)
    setObj.invalidRemovedCount = updates.invalidRemovedCount;
  if (updates.error !== undefined) setObj.error = updates.error;

  await db.update(pushSends).set(setObj).where(eq(pushSends.id, sendId));
}

/**
 * Lists the most recent push send records for the Admin Dashboard.
 */
export async function listRecentPushSends(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(pushSends)
    .orderBy(desc(pushSends.id))
    .limit(limit);
}

/**
 * Loads published posts for the given edition date in Africa/Lagos time.
 */
export async function listEditionPublishedPosts(
  editionDate: string,
  timeZone = PUSH_TIMEZONE
) {
  const db = await getDb();
  if (!db) return [];

  const published = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(asc(posts.publishedTime));

  return published.filter(
    post =>
      post.publishedTime &&
      localCalendarDay(post.publishedTime, timeZone) === editionDate
  );
}

/**
 * Fetches subscription IDs registered to active admin users for ?testOnly=1 testing.
 */
export async function getAdminSubscriptionIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const admins = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.isActive, true));

  const adminEmails = admins
    .map(a => a.email.toLowerCase().trim())
    .filter(Boolean);
  if (adminEmails.length === 0) return [];

  const matchedReaders = await db
    .select({ id: readers.id })
    .from(readers)
    .where(inArray(readers.email, adminEmails));

  const readerIds = matchedReaders.map(r => r.id);
  if (readerIds.length === 0) return [];

  const subs = await db
    .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
    .from(oneSignalSubscriptions)
    .where(inArray(oneSignalSubscriptions.readerId, readerIds));

  return subs.map(s => s.subscriptionId);
}
