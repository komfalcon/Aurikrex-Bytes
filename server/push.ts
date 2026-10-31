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

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

export function stripSourcePrefixes(str: string): string {
  return str
    .replace(/^(?:(?:show|ask|tell|launch)\s+hn\s*:\s*|\[[^\]]+\]\s*:?\s*)/i, "")
    .trim();
}

export function stripEmoji(str: string): string {
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

const COMMON_TECH_ACRONYMS = new Set([
  "AI",
  "API",
  "AWS",
  "CPU",
  "GPU",
  "HTML",
  "HTTP",
  "ID",
  "IOS",
  "IP",
  "JSON",
  "LLM",
  "ML",
  "OS",
  "PWA",
  "PR",
  "RAM",
  "REST",
  "SDK",
  "SEO",
  "SQL",
  "SSD",
  "TCP",
  "UI",
  "URI",
  "URL",
  "USB",
  "UX",
  "VCF",
]);

export function fixAllCaps(str: string): string {
  const letters = str.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 6) {
    const upperCount = (str.match(/[A-Z]/g) || []).length;
    if (upperCount / letters.length > 0.75) {
      return str
        .toLowerCase()
        .split(" ")
        .map((word, idx) => {
          const clean = word.replace(/[^a-z]/gi, "").toUpperCase();
          if (COMMON_TECH_ACRONYMS.has(clean)) {
            return word.replace(new RegExp(clean, "i"), clean);
          }
          if (idx === 0 || word.length > 3) {
            return word.charAt(0).toUpperCase() + word.slice(1);
          }
          return word;
        })
        .join(" ");
    }
  }
  return str;
}

export function truncateHeadline(str: string, maxLen = 90): string {
  const trimmed = str.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  // Leave room for ellipsis "…"
  const slice = trimmed.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = (lastSpace > 30 ? slice.slice(0, lastSpace) : slice).trim();
  const cleanCut = cut.replace(/[,\-:;\s]+$/, "");
  return `${cleanCut}…`;
}

export function formatPushBody(rawHeadline: string): string {
  const decoded = decodeHtmlEntities(rawHeadline);
  const withoutPrefix = stripSourcePrefixes(decoded);
  const withoutEmoji = stripEmoji(withoutPrefix);
  const casingFixed = fixAllCaps(withoutEmoji);
  return truncateHeadline(casingFixed, 90);
}

export function transformPushImage(
  imageUrl: string | null | undefined,
  baseUrl: string
): string {
  const fallbackUrl = `${baseUrl}/images/briefing-banner-2x1.png`;
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return fallbackUrl;
  }
  if (imageUrl.includes("res.cloudinary.com") && imageUrl.includes("/upload/")) {
    return imageUrl.replace(
      /\/upload\/(?:[a-z]_[^/]+,?)*\/?(v\d+\/)?/i,
      "/upload/c_fill,ar_2:1,w_1200,g_auto,f_auto,q_auto/$1"
    );
  }
  return imageUrl;
}

export interface FormattedNotification {
  heading: string;
  content: string;
  url: string;
  imageUrl?: string | null;
  buttons?: Array<{ id: string; text: string; url: string }>;
}

export interface FormatOptions {
  postsCount?: number;
  timeZone?: string;
  now?: Date;
  slot?: PushSlot | null;
}

export function formatPushNotificationContent(
  story?: {
    id: number;
    headline: string;
    body?: string;
    imageUrl?: string | null;
  } | null,
  optionsOrTimeZone?: FormatOptions | string,
  legacyNow?: Date
): FormattedNotification {
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";

  let postsCount = 1;
  let timeZone = PUSH_TIMEZONE;
  let now = new Date();
  let requestedSlot: PushSlot | null = null;

  if (typeof optionsOrTimeZone === "string") {
    timeZone = optionsOrTimeZone;
    if (legacyNow) now = legacyNow;
  } else if (optionsOrTimeZone && typeof optionsOrTimeZone === "object") {
    if (optionsOrTimeZone.postsCount !== undefined) {
      postsCount = optionsOrTimeZone.postsCount;
    }
    if (optionsOrTimeZone.timeZone) timeZone = optionsOrTimeZone.timeZone;
    if (optionsOrTimeZone.now) now = optionsOrTimeZone.now;
    if (optionsOrTimeZone.slot) requestedSlot = optionsOrTimeZone.slot;
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const isMorning = requestedSlot
    ? requestedSlot === "morning"
    : hour >= 4 && hour < 16;

  // Title: "Morning Brief · {N} new Bytes" or "Evening Recap · {N} Bytes today" (under ~40 chars)
  const heading = isMorning
    ? postsCount === 1
      ? "Morning Brief · 1 new Byte"
      : `Morning Brief · ${postsCount} new Bytes`
    : postsCount === 1
    ? "Evening Recap · 1 Byte today"
    : `Evening Recap · ${postsCount} Bytes today`;

  const fallbackBanner = `${baseUrl}/images/briefing-banner-2x1.png`;

  if (story) {
    const content = formatPushBody(story.headline);
    const storyUrl = `${baseUrl}/post/${story.id}`;
    const imageUrl = transformPushImage(story.imageUrl, baseUrl);

    return {
      heading,
      content,
      url: storyUrl,
      imageUrl,
      buttons: [
        { id: "read-now", text: "Read now", url: storyUrl },
        { id: "all-bytes", text: "All Bytes", url: `${baseUrl}/` },
      ],
    };
  }

  return {
    heading: isMorning ? "Daily Tech Briefing is Ready" : "Evening Tech Roundup",
    content: "Catch up on today's highest-signal tech stories on Aurikrex Bytes.",
    url: `${baseUrl}/`,
    imageUrl: fallbackBanner,
    buttons: [
      { id: "all-bytes", text: "All Bytes", url: `${baseUrl}/` },
    ],
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

export async function sendAdminAlertEmail(subject: string, html: string) {
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
  force?: boolean;
  resend?: boolean;
  now?: Date;
}

export async function processPushTrigger(options: ProcessPushOptions = {}) {
  const now = options.now || new Date();
  const dryRun = Boolean(options.dryRun);
  const testOnly = Boolean(options.testOnly);
  const force = Boolean(options.force);
  const resend = Boolean(options.resend);
  const triggerSource = force
    ? "manual"
    : options.triggerSource || "manual";

  // 1. Resolve slot & window (bypass window check if force, dryRun, or testOnly)
  const resolution = resolvePushSlot(
    options.requestedSlot,
    now,
    dryRun || testOnly || force
  );
  if (!resolution.isValid) {
    return { status: resolution.status || "outside_window" };
  }

  const slot: PushSlot = resolution.slot!;
  const editionDate: string = resolution.editionDate!;
  const scheduledFor: Date = resolution.scheduledFor!;

  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.com";
  const iconUrl = `${baseUrl}/logo-192.png`;
  const badgeUrl = `${baseUrl}/badge-96.png`;

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
    const notification = formatPushNotificationContent(leadStory, {
      postsCount: editionPosts.length,
      timeZone: PUSH_TIMEZONE,
      now,
      slot,
    });

    const db = await getDb();
    const subs = db
      ? await db
          .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
          .from(oneSignalSubscriptions)
      : [];

    const payload: Record<string, unknown> = {
      headings: { en: notification.heading },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: badgeUrl,
      firefox_icon: iconUrl,
      collapse_id: "aurikrex-briefing",
      web_push_topic: "aurikrex-briefing",
      web_buttons: notification.buttons,
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

    const notification = formatPushNotificationContent(leadStory, {
      postsCount: editionPosts.length,
      timeZone: PUSH_TIMEZONE,
      now,
      slot,
    });

    const payload: Record<string, unknown> = {
      include_subscription_ids: adminSubs,
      headings: { en: `[TEST] ${notification.heading}` },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: badgeUrl,
      firefox_icon: iconUrl,
      collapse_id: "aurikrex-test-briefing",
      web_push_topic: "aurikrex-test-briefing",
      web_buttons: notification.buttons,
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

  // 3. Live run: Atomic claim in ledger
  const claim = await claimPushSlot({
    editionDate,
    slot,
    triggerSource,
    scheduledFor,
    now,
    force,
    resend,
  });

  if (!claim.claimed) {
    return { status: claim.status, message: (claim as any).error };
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
    const notification = formatPushNotificationContent(leadStory, {
      postsCount: editionPosts.length,
      timeZone: PUSH_TIMEZONE,
      now,
      slot,
    });

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const subs = await db
      .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
      .from(oneSignalSubscriptions);

    const basePayload: Record<string, unknown> = {
      headings: { en: notification.heading },
      contents: { en: notification.content },
      url: notification.url,
      priority: 10,
      ttl: 14400,
      chrome_web_icon: iconUrl,
      chrome_web_badge: badgeUrl,
      firefox_icon: iconUrl,
      collapse_id: "aurikrex-briefing",
      web_push_topic: "aurikrex-briefing",
      web_buttons: notification.buttons,
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
  const badgeUrl = `${baseUrl}/badge-96.png`;

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
        headings: { en: "Morning Brief · 1 new Byte" },
        contents: {
          en: "OpenAI announces reasoning improvements with faster tool execution and lower latency.",
        },
        url: `${baseUrl}/`,
        chrome_web_icon: iconUrl,
        chrome_web_badge: badgeUrl,
        firefox_icon: iconUrl,
        big_picture: `${baseUrl}/images/briefing-banner-2x1.png`,
        chrome_web_image: `${baseUrl}/images/briefing-banner-2x1.png`,
        collapse_id: "aurikrex-briefing",
        web_push_topic: "aurikrex-briefing",
        web_buttons: [
          { id: "read-now", text: "Read now", url: `${baseUrl}/` },
          { id: "all-bytes", text: "All Bytes", url: `${baseUrl}/` },
        ],
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
