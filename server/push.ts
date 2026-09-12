import webpush from "web-push";
import { getDb } from "./db.js";
import { pushSubscriptions } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";

if (ENV.vapidPublicKey && ENV.vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:hello@aurikrex.tech",
    ENV.vapidPublicKey,
    ENV.vapidPrivateKey
  );
}

export async function sendDailyPushNotifications() {
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured, skipping.");
    return 0;
  }

  const db = await getDb();
  if (!db) return 0;

  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: "Time for your daily bytes!",
    body: "Catch up on what matters in tech. 🚀",
    url: "/dashboard",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      sent++;
    } catch (error) {
      // Typically, if error.statusCode === 410, the subscription is gone
      console.warn(`[Push] Failed to send to ${sub.endpoint}`, error);
    }
  }
  return sent;
}
