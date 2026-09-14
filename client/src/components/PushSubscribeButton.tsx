import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";

interface PushSubscribeButtonProps {
  variant?: "header" | "button";
}

const DEFAULT_VAPID_PUBLIC_KEY = "BI5SEWx9U3nei2bzEVFnvNCTgBHYYfIUwGBrnsb0757spGDalsRS8JDdVWAKJW4b1lmgcacI3CN1f5MMvu9yLpQ";

export function PushSubscribeButton({ variant = "header" }: PushSubscribeButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const vapidKeyQuery = trpc.reader.vapidPublicKey.useQuery();
  const subscribeMutation = trpc.reader.subscribePush.useMutation();
  const sendTestMutation = trpc.reader.sendTestPush.useMutation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPermission("unsupported");
      } else {
        setPermission(Notification.permission);
        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
              if (sub) setIsSubscribed(true);
            });
          }).catch(() => undefined);
        }
      }
    }
  }, []);

  const handleSubscribe = async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To get daily notifications on iPhone, tap Share -> 'Add to Home Screen' first.", {
          duration: 6000,
        });
      } else {
        toast.error("Push notifications are not supported in this browser.", { duration: 4000 });
      }
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked in your browser settings. Please click the lock icon in your address bar to allow notifications for aurikrex.tech.", {
        duration: 6000,
      });
      return;
    }

    try {
      setLoading(true);
      let currentPerm = Notification.permission;
      if (currentPerm !== "granted") {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm !== "granted") {
        toast.error("Notification permission was denied.");
        return;
      }

      // Ensure service worker is registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      const vapidKey = (vapidKeyQuery.data && vapidKeyQuery.data.length > 10)
        ? vapidKeyQuery.data
        : DEFAULT_VAPID_PUBLIC_KEY;

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const jsonSub = subscription.toJSON();
      const p256dh = jsonSub.keys?.p256dh;
      const auth = jsonSub.keys?.auth;

      if (!p256dh || !auth) {
        toast.error("Could not obtain push subscription keys from browser.");
        return;
      }

      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      });

      setIsSubscribed(true);
      toast.success("Daily Bytes notifications active! (8:01 AM & 6:00 PM)");

      // Trigger instant test notification so the user sees a confirmation popup
      try {
        await sendTestMutation.mutateAsync({ endpoint: subscription.endpoint });
      } catch (err) {
        console.warn("[PushSubscribe] Test notification send failed:", err);
      }
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
        <Bell size={16} /> {loading ? "Enabling..." : "Enable Notifications"}
      </button>
    );
  }

  // Header icon variant
  return (
    <button
      className={`theme-toggle push-toggle ${permission === "granted" || isSubscribed ? "active" : ""}`}
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      aria-label={permission === "granted" || isSubscribed ? "Daily notifications active" : "Enable daily notifications"}
      title={
        permission === "granted" || isSubscribed
          ? "Daily notifications active (8:01 AM & 6:00 PM)"
          : permission === "denied"
          ? "Notifications blocked in browser"
          : permission === "unsupported"
          ? "Notifications info"
          : "Enable daily notifications (8:01 AM & 6:00 PM)"
      }
    >
      {permission === "granted" || isSubscribed ? (
        <BellRing size={17} strokeWidth={1.8} style={{ color: "var(--primary, #3b82f6)" }} />
      ) : permission === "denied" ? (
        <BellOff size={17} strokeWidth={1.8} style={{ opacity: 0.6 }} />
      ) : (
        <Bell size={17} strokeWidth={1.8} />
      )}
      <span>{permission === "granted" || isSubscribed ? "Alerts On" : "Alerts"}</span>
    </button>
  );
}
