import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";

interface PushSubscribeButtonProps {
  variant?: "header" | "button";
}

type OneSignalInstance = {
  init(options: { appId: string; serviceWorkerPath?: string }): Promise<void>;
  Notifications: { requestPermission(): Promise<void> };
  User: { PushSubscription: { id?: string | null; optedIn?: boolean } };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(instance: OneSignalInstance) => void | Promise<void>>;
  }
}

let oneSignalPromise: Promise<OneSignalInstance> | null = null;

function getOneSignal(appId: string) {
  if (oneSignalPromise) return oneSignalPromise;
  if (!appId) return Promise.reject(new Error("OneSignal is not configured for this site."));

  oneSignalPromise = new Promise((resolve, reject) => {
    const queue = window.OneSignalDeferred || [];
    window.OneSignalDeferred = queue;
    queue.push(async OneSignal => {
      try {
        await OneSignal.init({ appId, serviceWorkerPath: "/OneSignalSDKWorker.js" });
        resolve(OneSignal);
      } catch (error) {
        reject(error);
      }
    });
  });
  return oneSignalPromise;
}

async function waitForSubscriptionId(OneSignal: OneSignalInstance) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const subscriptionId = OneSignal.User.PushSubscription.id;
    if (subscriptionId) return subscriptionId;
    await new Promise(resolve => window.setTimeout(resolve, 500));
  }
  return null;
}

export function PushSubscribeButton({ variant = "header" }: PushSubscribeButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const oneSignalAppIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const sendTestMutation = trpc.reader.sendTestPush.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    if (!oneSignalAppIdQuery.data) return;
    getOneSignal(oneSignalAppIdQuery.data).then(OneSignal => {
      setIsSubscribed(Boolean(OneSignal.User.PushSubscription.optedIn));
    }).catch(() => undefined);

  }, [oneSignalAppIdQuery.data]);

  const handleSubscribe = async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To enable notifications on iOS, tap Share -> 'Add to Home Screen' first.", { duration: 6000 });
      } else {
        toast.error("Push notifications are not supported in this browser.", { duration: 4000 });
      }
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked in your browser settings. Click the site settings / lock icon in address bar to allow notifications.", {
        duration: 6000,
      });
      return;
    }

    try {
      setLoading(true);

      const OneSignal = await getOneSignal(oneSignalAppIdQuery.data || "");
      await OneSignal.Notifications.requestPermission();
      setPermission(Notification.permission);
      if (Notification.permission !== "granted") {
        toast.error("Notification permission was denied.");
        return;
      }
      setIsSubscribed(true);

      const subscriptionId = await waitForSubscriptionId(OneSignal);
      if (!subscriptionId) throw new Error("OneSignal did not return a subscription ID yet. Please try again.");
      const testResult = await sendTestMutation.mutateAsync({ subscriptionId });
      if (!testResult.success) throw new Error(testResult.error || "The test notification could not be sent.");

      toast.success("OneSignal notifications enabled!");
    } catch (e) {
      console.error("[PushSubscribe] error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to enable notifications.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "button") {
    if (permission === "granted" || isSubscribed) {
      return (
        <button type="button" onClick={handleSubscribe} disabled={loading} className="btn ghost push-btn" title="Daily notifications active (Click to resync)">
          <BellRing size={16} className="text-primary" /> {loading ? "Syncing..." : "Notifications Active"}
        </button>
      );
    }
    return (
      <button type="button" onClick={handleSubscribe} disabled={loading} className="btn outline push-btn">
        <Bell size={16} /> {loading ? "Enabling..." : "Enable System Push"}
      </button>
    );
  }

  // Header icon button variant (Clean 40x40 icon button on both mobile & desktop)
  return (
    <button
      className={`theme-toggle push-toggle ${permission === "granted" || isSubscribed ? "active" : ""}`}
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      aria-label={permission === "granted" || isSubscribed ? "Daily notifications active" : "Enable daily notifications"}
      title={
        permission === "granted" || isSubscribed
          ? "Daily push notifications active (8:00 AM & 10:00 PM)"
          : permission === "denied"
          ? "Notifications blocked in browser settings"
          : permission === "unsupported"
          ? "Notifications info"
          : "Enable daily push notifications (8:00 AM & 10:00 PM)"
      }
    >
      {permission === "granted" || isSubscribed ? (
        <BellRing size={18} strokeWidth={2} style={{ color: "var(--primary, #3b82f6)" }} />
      ) : permission === "denied" ? (
        <BellOff size={18} strokeWidth={1.8} style={{ opacity: 0.6 }} />
      ) : (
        <Bell size={18} strokeWidth={1.8} />
      )}
      <span className="sr-only">{permission === "granted" || isSubscribed ? "Alerts On" : "Alerts"}</span>
      {(permission === "granted" || isSubscribed) && <span className="push-active-dot" />}
    </button>
  );
}
