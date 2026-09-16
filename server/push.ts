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
  return responseBody ? JSON.parse(responseBody) as Record<string, unknown> : {};
}

type PushDeliveryResult = {
  found: number;
  sent: number;
  failed: number;
  removed: number;
};

export async function sendDailyPushNotifications(): Promise<PushDeliveryResult> {
  const { getDb } = await import("./db.js");
  const { oneSignalSubscriptions } = await import("../drizzle/schema.js");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const subscriptions = await db.select({ subscriptionId: oneSignalSubscriptions.subscriptionId }).from(oneSignalSubscriptions);
  const result: PushDeliveryResult = { found: 0, sent: 0, failed: 0, removed: 0 };
  result.found = subscriptions.length;
  if (subscriptions.length === 0) {
    throw new Error("No OneSignal subscriptions are registered");
  }
  try {
    const response = await sendOneSignalNotification({
      include_subscription_ids: subscriptions.map(subscription => subscription.subscriptionId),
      headings: { en: "Time for your daily bytes!" },
      contents: { en: "Catch up on what matters in tech." },
      url: "/dashboard",
    });
    result.sent = Number(response.recipients ?? 0);
    if (result.sent === 0) {
      throw new Error("OneSignal accepted the request but found no subscribed users");
    }
    console.info("[Push] OneSignal daily delivery result:", result);
  } catch (error) {
    result.failed = 1;
    console.error("[Push] OneSignal daily delivery failed:", error);
    throw error;
  }
  return result;
}

export async function sendTestPushNotification(subscriptionId: string) {
  try {
    await sendOneSignalNotification({
      include_subscription_ids: [subscriptionId],
      headings: { en: "Aurikrex Bytes Push Active!" },
      contents: { en: "You're all set! Daily tech updates will arrive at 8:00 AM and 10:00 PM." },
      url: "/dashboard",
    });
    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send OneSignal test notification:", err);
    return { success: false, error: String(err) };
  }
}
