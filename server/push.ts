import { eq, desc, inArray } from "drizzle-orm";
import { appBaseUrl } from "./_core/env.js";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

function getOneSignalConfig() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are required");
  }
  return { appId, apiKey };
}

async function sendOneSignalNotification(payload: Record<string, unknown>) {
  const { appId, apiKey } = getOneSignalConfig();
  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_id: appId, target_channel: "push", ...payload }),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`OneSignal request failed (${response.status}): ${responseBody}`);
  }
  return responseBody ? (JSON.parse(responseBody) as Record<string, unknown>) : {};
}

export type PushDeliveryResult = {
  found: number;
  sent: number;
  failed: number;
  removed: number;
  skipped?: boolean;
};

export interface StoryCandidateForPush {
  id: number;
  headline: string;
  body: string;
  imageUrl?: string | null;
}

export interface FormattedPushContent {
  heading: string;
  body: string;
  url: string;
  imageUrl?: string;
}

/**
 * Formats dynamic, story-grounded push notification content based on the local time of day.
 * Morning (08:00 WAT): "🌅 Morning Brief: [Headline]"
 * Evening (10:00 PM WAT): "🌙 Evening Recap: [Headline]"
 */
export function formatPushContent(
  story: StoryCandidateForPush | null,
  now = new Date(),
  timeZone = process.env.APP_TIMEZONE || "Africa/Lagos",
  baseUrl = appBaseUrl()
): FormattedPushContent {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const isMorning = hour >= 4 && hour < 16;
  const prefix = isMorning ? "🌅 Morning Brief: " : "🌙 Evening Recap: ";

  if (story) {
    // Truncate headline if exceptionally long so prefix + headline fits in notification header
    let displayHeadline = story.headline.trim();
    if (displayHeadline.length > 70) {
      displayHeadline = displayHeadline.slice(0, 67).trim() + "...";
    }
    const heading = `${prefix}${displayHeadline}`;

    // Extract first ~110 characters cleanly on a word boundary for notification preview
    let snippet = story.body.replace(/\s+/g, " ").trim();
    if (snippet.length > 110) {
      const cut = snippet.slice(0, 105);
      const lastSpace = cut.lastIndexOf(" ");
      snippet = (lastSpace > 65 ? cut.slice(0, lastSpace) : cut).trim() + "...";
    }

    const url = `${baseUrl}/post/${story.id}`;
    const imageUrl =
      story.imageUrl && story.imageUrl.startsWith("http") && !story.imageUrl.startsWith("data:")
        ? story.imageUrl
        : undefined;

    return { heading, body: snippet, url, imageUrl };
  }

  // Graceful fallback if no published story exists yet
  const fallbackHeading = isMorning
    ? "🌅 Today's Tech Briefing is Ready"
    : "🌙 Tonight's Tech Recap is Ready";
  const fallbackBody = "Catch up on the latest verified tech developments on Aurikrex Bytes.";
  const fallbackUrl = `${baseUrl}/dashboard`;

  return {
    heading: fallbackHeading,
    body: fallbackBody,
    url: fallbackUrl,
  };
}

let lastNotificationDispatchTime = 0;
const IDEMPOTENCY_WINDOW_MS = 45 * 60 * 1000; // 45 minutes

export async function sendDailyPushNotifications(force = false): Promise<PushDeliveryResult> {
  const now = Date.now();
  if (!force && now - lastNotificationDispatchTime < IDEMPOTENCY_WINDOW_MS) {
    console.info("[Push] Notification already dispatched within the last 45 minutes. Skipping duplicate blast.");
    return { found: 0, sent: 0, failed: 0, removed: 0, skipped: true };
  }

  const { getDb } = await import("./db.js");
  const { oneSignalSubscriptions, posts } = await import("../drizzle/schema.js");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // 1. Fetch latest published story for story-grounded copy
  const recentPosts = await db
    .select({
      id: posts.id,
      headline: posts.headline,
      body: posts.body,
      imageUrl: posts.imageUrl,
    })
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedTime), desc(posts.id))
    .limit(1);

  const topStory = recentPosts[0] || null;
  const baseUrl = appBaseUrl();
  const pushContent = formatPushContent(topStory, new Date(), process.env.APP_TIMEZONE || "Africa/Lagos", baseUrl);

  // 2. Fetch registered subscription IDs
  const subscriptions = await db
    .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
    .from(oneSignalSubscriptions);

  const subscriptionIds = subscriptions.map(s => s.subscriptionId).filter(Boolean);
  const result: PushDeliveryResult = { found: subscriptionIds.length, sent: 0, failed: 0, removed: 0 };

  const logoUrl = `${baseUrl}/logo-192.png`;
  const notificationPayload: Record<string, unknown> = {
    headings: { en: pushContent.heading },
    contents: { en: pushContent.body },
    url: pushContent.url,
    priority: 10, // High priority delivery across FCM/APNs so Android/iOS doesn't defer
    ttl: 14400, // 4-hour validity so morning notification doesn't linger into evening
    chrome_web_icon: logoUrl,
    chrome_web_badge: logoUrl,
    firefox_icon: logoUrl,
  };

  if (pushContent.imageUrl) {
    notificationPayload.big_picture = pushContent.imageUrl;
    notificationPayload.chrome_web_image = pushContent.imageUrl;
  }

  // 3. Audience targeting: target subscription IDs if present, or fallback to "Subscribed Users" segment
  if (subscriptionIds.length > 0) {
    notificationPayload.include_subscription_ids = subscriptionIds;
  } else {
    // If local DB table has 0 records, still dispatch to all active OneSignal subscribers
    notificationPayload.included_segments = ["Subscribed Users"];
  }

  try {
    const response = await sendOneSignalNotification(notificationPayload);
    if (!response.id) throw new Error("OneSignal did not return a notification ID");

    result.sent = Number(response.recipients ?? (subscriptionIds.length || 1));
    lastNotificationDispatchTime = now;
    console.info("[Push] OneSignal daily delivery result:", result);

    // 4. Prune dead or unsubscribed player IDs
    const invalidIds: string[] = [];
    if (Array.isArray(response.invalid_player_ids)) {
      invalidIds.push(...response.invalid_player_ids);
    }
    const respErrors = response.errors as any;
    if (respErrors) {
      if (Array.isArray(respErrors.invalid_player_ids)) invalidIds.push(...respErrors.invalid_player_ids);
      if (Array.isArray(respErrors.invalid_subscription_ids)) invalidIds.push(...respErrors.invalid_subscription_ids);
    }

    if (invalidIds.length > 0 && subscriptionIds.length > 0) {
      const toDelete = subscriptionIds.filter(id => invalidIds.includes(id));
      if (toDelete.length > 0) {
        await db
          .delete(oneSignalSubscriptions)
          .where(inArray(oneSignalSubscriptions.subscriptionId, toDelete));
        result.removed = toDelete.length;
        console.info(`[Push] Pruned ${toDelete.length} invalid OneSignal subscriptions from database`);
      }
    }
  } catch (error) {
    result.failed = 1;
    console.error("[Push] OneSignal daily delivery failed:", error);
    throw error;
  }

  return result;
}

export async function sendTestPushNotification(subscriptionId: string) {
  const baseUrl = appBaseUrl();
  const logoUrl = `${baseUrl}/logo-192.png`;
  try {
    await sendOneSignalNotification({
      include_subscription_ids: [subscriptionId],
      headings: { en: "Aurikrex Bytes Push Active!" },
      contents: { en: "You're all set! Daily tech updates will arrive at 8:00 AM and 10:00 PM WAT." },
      url: `${baseUrl}/dashboard`,
      chrome_web_icon: logoUrl,
      chrome_web_badge: logoUrl,
      firefox_icon: logoUrl,
    });
    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send OneSignal test notification:", err);
    return { success: false, error: String(err) };
  }
}
