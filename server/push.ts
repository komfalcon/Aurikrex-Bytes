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
  if (!publicKey || !privateKey) throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required");

  webpush.setVapidDetails("mailto:hello@aurikrex.tech", publicKey, privateKey);
}

type PushDeliveryResult = {
  found: number;
  sent: number;
  failed: number;
  removed: number;
};

export async function sendDailyPushNotifications(): Promise<PushDeliveryResult> {
  configureVapid();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const subs = await db.select().from(pushSubscriptions);
  const result: PushDeliveryResult = { found: subs.length, sent: 0, failed: 0, removed: 0 };
  console.info(`[Push] Starting delivery to ${subs.length} stored subscriptions.`);
  if (subs.length === 0) return result;

  const payload = JSON.stringify({
    title: "Time for your daily bytes! 🚀",
    body: "Catch up on what matters in tech.",
    url: "/dashboard",
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
      result.sent += 1;
    } catch (error: any) {
      result.failed += 1;
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410 || statusCode === 401 || statusCode === 400) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.removed += 1;
        console.warn(`[Push] Removed invalid/expired subscription ${sub.id} (${statusCode}).`);
      } else {
        console.error(`[Push] Delivery failed for subscription ${sub.id} (${statusCode || "unknown"}).`, error);
      }
    }
  }

  console.info("[Push] Delivery result:", result);
  return result;
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
    body: "You're all set! Daily tech updates will arrive at 8:00 AM & 10:00 PM.",
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
