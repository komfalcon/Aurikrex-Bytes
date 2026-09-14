import webpush from "web-push";
import { getDb } from "./db.js";
import { pushSubscriptions } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { eq } from "drizzle-orm";

const DEFAULT_VAPID_PUBLIC = "BI5SEWx9U3nei2bzEVFnvNCTgBHYYfIUwGBrnsb0757spGDalsRS8JDdVWAKJW4b1lmgcacI3CN1f5MMvu9yLpQ";
const DEFAULT_VAPID_PRIVATE = "4uCF-AGmorh_XVBRRCPiWMPoFr68C4gso4_TrW2DAmU";

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ENV.vapidPublicKey || DEFAULT_VAPID_PUBLIC;
  const privateKey = process.env.VAPID_PRIVATE_KEY || ENV.vapidPrivateKey || DEFAULT_VAPID_PRIVATE;

  try {
    webpush.setVapidDetails(
      "mailto:hello@aurikrex.tech",
      publicKey,
      privateKey
    );
  } catch (err) {
    console.warn("[Push] VAPID setup error:", err);
  }
}

export async function sendDailyPushNotifications() {
  configureVapid();

  const db = await getDb();
  if (!db) return 0;

  const subs = await db.select().from(pushSubscriptions);
  console.info(`[Push] Found ${subs.length} push subscriptions in database.`);
  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: "Time for your daily bytes! 🚀",
    body: "Catch up on what matters in tech.",
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

export async function sendTestPushNotification(endpoint: string) {
  configureVapid();

  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const [sub] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (!sub) {
    return { success: false, error: "Subscription endpoint not found" };
  }

  const payload = JSON.stringify({
    title: "Aurikrex Bytes Push Active! 🚀",
    body: "You're all set! Daily tech updates will arrive at 8:01 AM & 6:00 PM.",
    url: "/dashboard",
  });

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
    return { success: true };
  } catch (err) {
    console.error("[Push] Failed to send test push notification:", err);
    return { success: false, error: String(err) };
  }
}
