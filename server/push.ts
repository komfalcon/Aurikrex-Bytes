import webpush from "web-push";
import { getDb } from "./db.js";
import { pushSubscriptions } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";

export async function sendDailyPushNotifications() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ENV.vapidPublicKey;
  const privateKey = process.env.VAPID_PRIVATE_KEY || ENV.vapidPrivateKey;

  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys not configured, skipping.");
    return 0;
  }

  try {
    webpush.setVapidDetails(
      "mailto:hello@aurikrex.tech",
      publicKey,
      privateKey
    );
  } catch (err) {
    console.warn("[Push] VAPID setup error:", err);
  }

  const db = await getDb();
  if (!db) return 0;

  const subs = await db.select().from(pushSubscriptions);
  console.info(`[Push] Found ${subs.length} push subscriptions in database.`);
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
      console.warn(`[Push] Failed to send to ${sub.endpoint}:`, error);
    }
  }
  return sent;
}
