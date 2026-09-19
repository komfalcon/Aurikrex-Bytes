import { inArray } from "drizzle-orm";
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
};

export interface FormattedNotification {
  heading: string;
  content: string;
  url: string;
  imageUrl?: string | null;
}

export function formatPushNotificationContent(
  story?: { id: number; headline: string; body: string; imageUrl?: string | null } | null,
  timeZone = process.env.APP_TIMEZONE || "Africa/Lagos",
  now = new Date()
): FormattedNotification {
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.tech";
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  const isMorning = hour >= 4 && hour < 16;
  const prefix = isMorning ? "🌅 Morning Brief" : "🌙 Evening Recap";

  if (story) {
    const cleanTitle = story.headline.replace(/^(show\s+hn|launch\s+hn)\s*:\s*/i, "").trim();
    const heading = `${prefix}: ${cleanTitle}`.slice(0, 75);

    // Extract clean first sentence or ~110 chars
    let bodySnippet = story.body.replace(/\s+/g, " ").trim();
    if (bodySnippet.length > 110) {
      const cut = bodySnippet.slice(0, 105);
      const lastSpace = cut.lastIndexOf(" ");
      bodySnippet = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim() + "...";
    }

    return {
      heading,
      content: bodySnippet,
      url: `${baseUrl}/post/${story.id}`,
      imageUrl: story.imageUrl && story.imageUrl.startsWith("http") ? story.imageUrl : null,
    };
  }

  return {
    heading: isMorning ? "🌅 Daily Tech Briefing is Ready" : "🌙 Evening Tech Roundup",
    content: "Catch up on what matters in tech today on Aurikrex Bytes.",
    url: `${baseUrl}/dashboard`,
  };
}

export async function sendDailyPushNotifications(): Promise<PushDeliveryResult> {
  const { getDb, listTodaysPublishedPosts, listPublishedPosts } = await import("./db.js");
  const { oneSignalSubscriptions } = await import("../drizzle/schema.js");

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const subscriptions = await db
    .select({ subscriptionId: oneSignalSubscriptions.subscriptionId })
    .from(oneSignalSubscriptions);

  const result: PushDeliveryResult = { found: subscriptions.length, sent: 0, failed: 0, removed: 0 };

  const timeZone = process.env.APP_TIMEZONE || "Africa/Lagos";
  const now = new Date();

  // Find top story for today or latest published story
  let topStory: { id: number; headline: string; body: string; imageUrl?: string | null } | undefined;
  try {
    const todaysPosts = await listTodaysPublishedPosts(timeZone);
    if (todaysPosts && todaysPosts.length > 0) {
      topStory = todaysPosts[0];
    } else {
      const allPosts = await listPublishedPosts();
      if (allPosts && allPosts.length > 0) {
        topStory = allPosts[0];
      }
    }
  } catch (err) {
    console.warn("[Push] Unable to fetch latest story for notification, using fallback copy:", err);
  }

  const notification = formatPushNotificationContent(topStory, timeZone, now);
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.tech";
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
  };

  if (notification.imageUrl && notification.imageUrl.startsWith("http")) {
    payload.big_picture = notification.imageUrl;
    payload.chrome_web_image = notification.imageUrl;
  }

  // Audience targeting:
  // If registered subscriptions exist, target them.
  // If local DB table has 0 rows, target ["Subscribed Users"] segment so it still sends.
  if (subscriptions.length > 0) {
    payload.include_subscription_ids = subscriptions.map(s => s.subscriptionId);
  } else {
    payload.included_segments = ["Subscribed Users"];
  }

  try {
    const response = await sendOneSignalNotification(payload);

    if (!response.id) throw new Error("OneSignal did not return a notification ID");
    result.sent = Number(response.recipients ?? subscriptions.length ?? 1);
    console.info("[Push] OneSignal daily delivery result:", result);

    // Prune invalid or unsubscribed IDs if reported by OneSignal
    if (response.errors && typeof response.errors === "object") {
      const errObj = response.errors as Record<string, unknown>;
      const invalidIds: string[] = [];
      if (Array.isArray(errObj.invalid_subscription_ids)) {
        invalidIds.push(...errObj.invalid_subscription_ids);
      }
      if (Array.isArray(errObj.invalid_player_ids)) {
        invalidIds.push(...errObj.invalid_player_ids);
      }
      if (invalidIds.length > 0) {
        try {
          await db
            .delete(oneSignalSubscriptions)
            .where(inArray(oneSignalSubscriptions.subscriptionId, invalidIds));
          result.removed = invalidIds.length;
          console.info(`[Push] Pruned ${invalidIds.length} invalid subscriptions from database`);
        } catch (pruneErr) {
          console.warn("[Push] Error pruning invalid subscriptions:", pruneErr);
        }
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
  const baseUrl = appBaseUrl() || "https://www.bytes.aurikrex.tech";
  const iconUrl = `${baseUrl}/logo-192.png`;

  try {
    await sendOneSignalNotification({
      include_subscription_ids: [subscriptionId],
      headings: { en: "Aurikrex Bytes Push Active!" },
      contents: { en: "You're all set! Daily tech updates will arrive at 8:00 AM and 10:00 PM." },
      url: `${baseUrl}/dashboard`,
      chrome_web_icon: iconUrl,
      chrome_web_badge: iconUrl,
      firefox_icon: iconUrl,
    });
    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send OneSignal test notification:", err);
    return { success: false, error: String(err) };
  }
}
