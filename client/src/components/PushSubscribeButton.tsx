import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";

interface PushSubscribeButtonProps {
  variant?: "header" | "button";
}

const DEFAULT_VAPID_PUBLIC_KEY = "BI5SEWx9U3nei2bzEVFnvNCTgBHYYfIUwGBrnsb0757spGDalsRS8JDdVWAKJW4b1lmgcacI3CN1f5MMvu9yLpQ";

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export function PushSubscribeButton({ variant = "header" }: PushSubscribeButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const vapidKeyQuery = trpc.reader.vapidPublicKey.useQuery();
  const subscribeMutation = trpc.reader.subscribePush.useMutation();
  const sendTestMutation = trpc.reader.sendTestPush.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check browser support for push notifications
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setIsSubscribed(true);
        });
      }).catch(() => undefined);
    }

    // Initialize OneSignal Web SDK ONLY if a valid App ID is configured
    const oneSignalAppId = (import.meta.env.VITE_ONESIGNAL_APP_ID || "").trim();
    if (oneSignalAppId && oneSignalAppId.length > 5) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId: oneSignalAppId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: "/" },
            serviceWorkerPath: "sw.js",
            serviceWorkerOverridePath: "sw.js",
            notifyButton: { enable: false },
          });
        } catch (e) {
          console.warn("[OneSignal] Init notice:", e);
        }
      });
    }
  }, []);

  const handleSubscribe = async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To enable notifications on iOS, tap Share -> 'Add to Home Screen' first.", { duration: 6000 });
      } else {
        toast.error("Push notifications are not supported in this browser.", { duration: 4000 });
      }
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked in your browser settings. Please click the site settings / lock icon to allow notifications for aurikrex.tech.", {
        duration: 6000,
      });
      return;
    }

    try {
      setLoading(true);

      // Request browser OS notification permission
      let currentPerm = Notification.permission;
      if (currentPerm !== "granted") {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm !== "granted") {
        toast.error("Notification permission was denied.");
        return;
      }

      // Prompt OneSignal SDK if initialized
      if (window.OneSignal && window.OneSignal.Notifications) {
        try {
          await window.OneSignal.Notifications.requestPermission();
        } catch (e) {
          console.warn("[OneSignal] Permission request notice:", e);
        }
      }

      // Ensure service worker registration is active
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      // Subscribe via WebPush PushManager
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
        try {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        } catch (subErr) {
          console.warn("[PushSubscribe] Native pushManager subscribe warning:", subErr);
        }
      }

      if (subscription) {
        const jsonSub = subscription.toJSON();
        const p256dh = jsonSub.keys?.p256dh;
        const auth = jsonSub.keys?.auth;

        if (p256dh && auth) {
          await subscribeMutation.mutateAsync({
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          }).catch(() => undefined);
        }
      }

      setIsSubscribed(true);

      // Trigger a native system OS notification banner immediately on the device screen
      try {
        await reg.showNotification("Aurikrex Bytes Push Active! 🚀", {
          body: "You'll receive daily technology briefs directly on your lock screen & status bar (8:01 AM & 6:00 PM).",
          icon: "/logo-192.png",
          badge: "/logo-192.png",
          vibrate: [200, 100, 200],
          tag: "aurikrex-welcome-push",
          data: { url: "/dashboard" }
        } as NotificationOptions);
      } catch (err) {
        console.warn("[Push] Direct showNotification error:", err);
      }

      // Also call backend to trigger server-sent notification
      if (subscription?.endpoint) {
        sendTestMutation.mutateAsync({ endpoint: subscription.endpoint }).catch(() => undefined);
      }

      toast.success("System Push Notifications Enabled!");
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
          ? "Daily push notifications active (8:01 AM & 6:00 PM)"
          : permission === "denied"
          ? "Notifications blocked in browser"
          : permission === "unsupported"
          ? "Notifications info"
          : "Enable daily push notifications (8:01 AM & 6:00 PM)"
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
