import { inArray } from "drizzle-orm";
import { oneSignalSubscriptions } from "../drizzle/schema.js";
import { appBaseUrl } from "./_core/env.js";
import { getDb } from "./db.js";
import {
  PUSH_TIMEZONE,
  PushSlot,
  resolvePushSlot,
} from "./pushConfig.js";
import {
  claimPushSlot,
  getAdminSubscriptionIds,
  listEditionPublishedPosts,
  updatePushSend,
} from "./pushLedger.js";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const BATCH_SIZE = 2000;

function getOneSignalConfig() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey =
    process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    throw new Error(
      "ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are required"
    );
  }
  return { appId, apiKey };
}

export interface FormattedNotification {
  heading: string;
  content: string;
  url: string;
  imageUrl?: string | null;
}

export function formatPushNotificationContent(
  story?: {
    id: number;
    headline: string;
    body: string;
    imageUrl?: string | null;
  } | null,
  timeZone = process.env.APP_TIMEZONE || PUSH_TIMEZONE,
  now = new Date()
): FormattedNotification {
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  const isMorning = hour >= 4 && hour < 16;
  const prefix = isMorning ? "Morning Brief" : "Evening Recap";

  if (story) {
    const cleanTitle = story.headline
      .replace(/^(show\s+hn|launch\s+hn)\s*:\s*/i, "")
      .trim();
    const heading = `${prefix}: ${cleanTitle}`.slice(0, 75);

    // Extract clean first sentence or ~110 chars
    let bodySnippet = story.body.replace(/\s+/g, " ").trim();
    if (bodySnippet.length > 110) {
      const cut = bodySnippet.slice(0, 105);
      const lastSpace = cut.lastIndexOf(" ");
      bodySnippet =
        (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim() + "...";
    }

    return {
      heading,
      content: bodySnippet,
      url: `${baseUrl}/post/${story.id}`,
      imageUrl:
        story.imageUrl && story.imageUrl.startsWith("http")
          ? story.imageUrl
          : null,
    };
  }

  return {
    heading: isMorning ? "Daily Tech Briefing is Ready" : "Evening Tech Roundup",
    content: "Catch up on what matters in tech today on Aurikrex Bytes.",
    url: `${baseUrl}/dashboard`,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendOneSignalBatchWithRetry(
  payload: Record<string, unknown>,
  deadlineMs: number
): Promise<{
  notificationId?: string;
  recipients: number;
  invalidIds: string[];
}> {
  const { appId, apiKey } = getOneSignalConfig();
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    const now = Date.now();
    if (now >= deadlineMs) {
      throw new Error(
        `Timeout: OneSignal batch dispatch exceeded run deadline (attempt ${attempt})`
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: appId,
          target_channel: "push",
          ...payload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseBody = await response.text();

      // Retry 429 and 5xx errors with backoff
      if (
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
        lastError = new Error(
          `OneSignal error HTTP ${response.status}: ${responseBody}`
        );
        if (attempt < maxAttempts) {
          const delay = attempt === 1 ? 500 : 1500;
          if (Date.now() + delay < deadlineMs) {
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
        }
        throw lastError;
      }

      // Do NOT retry other 4xx errors
      if (!response.ok) {
        throw new Error(
          `OneSignal request failed (${response.status}): ${responseBody}`
        );
      }

      const parsed = responseBody
        ? (JSON.parse(responseBody) as Record<string, unknown>)
        : {};
      const notificationId = parsed.id as string | undefined;
      const recipients = Number(parsed.recipients ?? 0);

      const invalidIds: string[] = [];
      if (parsed.errors && typeof parsed.errors === "object") {
        const errObj = parsed.errors as Record<string, unknown>;
        if (Array.isArray(errObj.invalid_subscription_ids)) {
          invalidIds.push(...errObj.invalid_subscription_ids);
        }
        if (Array.isArray(errObj.invalid_player_ids)) {
          invalidIds.push(...errObj.invalid_player_ids);
        }
      }

      return { notificationId, recipients, invalidIds };
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err.name === "AbortError" || err.message?.includes("fetch");
      if (isRetryable && attempt < maxAttempts) {
        const delay = 500;
        if (Date.now() + delay < deadlineMs) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error("OneSignal batch dispatch failed after retries");
}

async function sendAdminAlertEmail(subject: string, html: string) {
  const alertEmail = process.env.ADMIN_ALERT_EMAIL?.trim();
  if (!alertEmail) {
    console.warn(
      "[PushAlert] ADMIN_ALERT_EMAIL not configured, skipping alert email."
    );
    return;
  }
  try {
    const { sendEmail } = await import("./services.js");
    await sendEmail(alertEmail, subject, html);
    console.info(`[PushAlert] Sent alert email to ${alertEmail}: ${subject}`);
  } catch (err) {
    console.error("[PushAlert] Failed to send alert email:", err);
  }
}

export interface ProcessPushOptions {
  requestedSlot?: string | null;
  triggerSource?: string;
  dryRun?: boolean;
  testOnly?: boolean;
  now?: Date;
}

export async function processPushTrigger(options: ProcessPushOptions = {}) {
  const now = options.now || new Date();
  const dryRun = Boolean(options.dryRun);
  const testOnly = Boolean(options.testOnly);
  const triggerSource = options.triggerSource || "manual";

  // 1. Resolve slot & window
  const resolution = resolvePushSlot(
    options.requestedSlot,
    now,
    dryRun || testOnly
  );
  if (!resolution.isValid) {
    return { status: resolution.status || "outside_window" };
  }

  const slot: PushSlot = resolution.slot!;
  const editionDate: string = resolution.editionDate!;
  const scheduledFor: Date = resolution.scheduledFor!;

  // 2. Test modes (?dryRun=1 and ?testOnly=1)
  if (dryRun) {
    const { publishDuePosts } = await import("./db.js");
    await publishDuePosts(now);

    const editionPosts = await listEditionPublishedPosts(editionDate);
    if (editionPosts.length === 0) {
      return {
        dryRun: true,
        status: "skipped",
        slot,
        editionDate,
        reason: "no_published_posts",
      };
    }

    const leadStory = editionPosts[0];
    const notification = formatPushNotificationContent(
      leadStory,
      PUSH_TIMEZONE,
      now
    );

    const db = await getDb();
    const subs = db
      ? await db
          .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
          .from(oneSignalSubscriptions)
      : [];

    const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
    const iconUrl = `${baseUrl}/logo-192.png`;
    const payload: Record<string, unknown> = {
      headings: { en: notification.heading },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: iconUrl,
      firefox_icon: iconUrl,
      collapse_id: `aurikrex-briefing-${editionDate}-${slot}`,
    };
    if (notification.imageUrl && notification.imageUrl.startsWith("http")) {
      payload.big_picture = notification.imageUrl;
      payload.chrome_web_image = notification.imageUrl;
    }

    return {
      dryRun: true,
      status: "ready",
      slot,
      editionDate,
      postsCount: editionPosts.length,
      leadStory: { id: leadStory.id, headline: leadStory.headline },
      recipientsCount: subs.length,
      payload,
    };
  }

  if (testOnly) {
    const { publishDuePosts } = await import("./db.js");
    await publishDuePosts(now);

    const editionPosts = await listEditionPublishedPosts(editionDate);
    if (editionPosts.length === 0) {
      return {
        testOnly: true,
        status: "skipped",
        slot,
        editionDate,
        reason: "no_published_posts",
      };
    }

    const leadStory = editionPosts[0];
    const adminSubs = await getAdminSubscriptionIds();
    if (adminSubs.length === 0) {
      return {
        testOnly: true,
        status: "no_admin_subscribers",
        slot,
        editionDate,
        recipientsCount: 0,
      };
    }

    const notification = formatPushNotificationContent(
      leadStory,
      PUSH_TIMEZONE,
      now
    );
    const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
    const iconUrl = `${baseUrl}/logo-192.png`;
    const payload: Record<string, unknown> = {
      include_subscription_ids: adminSubs,
      headings: { en: `[TEST] ${notification.heading}` },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: iconUrl,
      firefox_icon: iconUrl,
      collapse_id: `aurikrex-test-${editionDate}-${slot}`,
    };
    if (notification.imageUrl && notification.imageUrl.startsWith("http")) {
      payload.big_picture = notification.imageUrl;
      payload.chrome_web_image = notification.imageUrl;
    }

    const deadlineMs = Date.now() + 24_000;
    const result = await sendOneSignalBatchWithRetry(payload, deadlineMs);

    return {
      testOnly: true,
      status: "sent",
      slot,
      editionDate,
      leadPostId: leadStory.id,
      recipientsCount: adminSubs.length,
      notificationId: result.notificationId,
    };
  }

  // 3. Live production run: Atomic claim
  const claim = await claimPushSlot({
    editionDate,
    slot,
    triggerSource,
    scheduledFor,
    now,
  });

  if (!claim.claimed) {
    return { status: claim.status };
  }

  try {
    // 4. Order: claim -> await publishDuePosts() -> load published posts -> send -> record
    const { publishDuePosts } = await import("./db.js");
    await publishDuePosts(now);

    const editionPosts = await listEditionPublishedPosts(editionDate);
    if (editionPosts.length === 0) {
      await updatePushSend(claim.sendId, {
        status: "skipped",
        finishedAt: new Date(),
        error: `No published posts for edition date ${editionDate} (${slot})`,
      });

      await sendAdminAlertEmail(
        `[Aurikrex Bytes] Push Skipped: No published posts for ${editionDate} (${slot})`,
        `<p>The scheduled daily push for <strong>${editionDate} (${slot})</strong> was skipped because no published posts were found for this edition.</p>
         <p>Trigger source: <code>${triggerSource}</code></p>
         <p>Time: ${now.toISOString()}</p>`
      );

      return {
        status: "skipped",
        slot,
        editionDate,
        reason: "no_published_posts",
      };
    }

    const leadStory = editionPosts[0];
    const notification = formatPushNotificationContent(
      leadStory,
      PUSH_TIMEZONE,
      now
    );

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const subs = await db
      .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
      .from(oneSignalSubscriptions);

    const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
    const iconUrl = `${baseUrl}/logo-192.png`;
    const basePayload: Record<string, unknown> = {
      headings: { en: notification.heading },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: iconUrl,
      firefox_icon: iconUrl,
      collapse_id: `aurikrex-briefing-${editionDate}-${slot}`,
    };
    if (notification.imageUrl && notification.imageUrl.startsWith("http")) {
      basePayload.big_picture = notification.imageUrl;
      basePayload.chrome_web_image = notification.imageUrl;
    }

    const runDeadlineMs = Date.now() + 24_000;
    const notificationIds: string[] = [];
    const allInvalidIds: string[] = [];
    let totalSent = 0;

    if (subs.length > 0) {
      const allIds = subs.map(s => s.subscriptionId);
      const batches = chunkArray(allIds, BATCH_SIZE);

      for (const batch of batches) {
        const batchPayload = {
          ...basePayload,
          include_subscription_ids: batch,
        };
        const batchRes = await sendOneSignalBatchWithRetry(
          batchPayload,
          runDeadlineMs
        );
        if (batchRes.notificationId) {
          notificationIds.push(batchRes.notificationId);
        }
        totalSent += batchRes.recipients || batch.length;
        if (batchRes.invalidIds.length > 0) {
          allInvalidIds.push(...batchRes.invalidIds);
        }
      }
    } else {
      // Broadcast to Subscribed Users segment if no local IDs registered yet
      const segmentPayload = {
        ...basePayload,
        included_segments: ["Subscribed Users"],
      };
      const res = await sendOneSignalBatchWithRetry(
        segmentPayload,
        runDeadlineMs
      );
      if (res.notificationId) notificationIds.push(res.notificationId);
      totalSent += res.recipients || 1;
      if (res.invalidIds.length > 0) allInvalidIds.push(...res.invalidIds);
    }

    // Prune invalid subscription IDs from database
    let invalidRemovedCount = 0;
    if (allInvalidIds.length > 0) {
      try {
        await db
          .delete(oneSignalSubscriptions)
          .where(
            inArray(oneSignalSubscriptions.subscriptionId, allInvalidIds)
          );
        invalidRemovedCount = allInvalidIds.length;
        console.info(
          `[Push] Pruned ${invalidRemovedCount} invalid subscriptions from database`
        );
      } catch (pruneErr) {
        console.warn("[Push] Error pruning invalid subscriptions:", pruneErr);
      }
    }

    // Record success in ledger
    await updatePushSend(claim.sendId, {
      status: "sent",
      finishedAt: new Date(),
      leadPostId: leadStory.id,
      postsCount: editionPosts.length,
      recipientsCount: totalSent,
      onesignalNotificationIds: notificationIds,
      invalidRemovedCount,
    });

    return {
      status: "sent",
      slot,
      editionDate,
      leadPostId: leadStory.id,
      postsCount: editionPosts.length,
      recipientsCount: totalSent,
      notificationIds,
    };
  } catch (error: any) {
    // Record failure in ledger
    await updatePushSend(claim.sendId, {
      status: "failed",
      finishedAt: new Date(),
      error: error?.message || String(error),
    });

    // Email alert to admin
    await sendAdminAlertEmail(
      `[Aurikrex Bytes Alert] Daily Push Failed: ${editionDate} (${slot})`,
      `<p>The scheduled push notification for <strong>${editionDate} (${slot})</strong> failed.</p>
       <p><strong>Trigger source:</strong> <code>${triggerSource}</code></p>
       <p><strong>Attempts:</strong> ${claim.attempts}</p>
       <p><strong>Error:</strong></p>
       <pre>${error?.stack || error?.message || String(error)}</pre>`
    );

    throw error;
  }
}

export async function sendDailyPushNotifications(
  options: ProcessPushOptions = {}
): Promise<any> {
  return processPushTrigger(options);
}

export async function sendTestPushNotification(subscriptionId: string) {
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
  const iconUrl = `${baseUrl}/logo-192.png`;

  try {
    const { appId, apiKey } = getOneSignalConfig();
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_subscription_ids: [subscriptionId],
        headings: { en: "Aurikrex Bytes Push Active!" },
        contents: {
          en: "You're all set! Daily tech updates will arrive at 8:00 AM and 10:00 PM.",
        },
        url: `${baseUrl}/dashboard`,
        chrome_web_icon: iconUrl,
        chrome_web_badge: iconUrl,
        firefox_icon: iconUrl,
      }),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `OneSignal request failed (${response.status}): ${responseBody}`
      );
    }

    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send OneSignal test notification:", err);
    return { success: false, error: String(err) };
  }
}
