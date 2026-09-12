import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";

interface PushSubscribeButtonProps {
  variant?: "header" | "button";
}

export function PushSubscribeButton({ variant = "header" }: PushSubscribeButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [loading, setLoading] = useState(false);
  const vapidKeyQuery = trpc.reader.vapidPublicKey.useQuery();
  const subscribeMutation = trpc.reader.subscribePush.useMutation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPermission("unsupported");
      } else {
        setPermission(Notification.permission);
      }
    }
  }, []);

  const handleSubscribe = async () => {
    if (permission === "unsupported") {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To get daily notifications on iPhone, tap the Share button and select 'Add to Home Screen'.", {
          duration: 6000,
        });
      } else {
        toast.error("Push notifications are not supported in this browser.", { duration: 4000 });
      }
      return;
    }

    if (permission === "denied") {
      toast.error("Notifications are blocked in your browser settings. Please enable notification permissions for aurikrex.tech in your browser settings.", {
        duration: 6000,
      });
      return;
    }

    if (permission === "granted") {
      toast.success("Daily notifications are active! You'll receive updates at 8:01 AM & 6:00 PM.", {
        duration: 4000,
      });
      return;
    }

    try {
      setLoading(true);
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "denied") {
        toast.error("Notification permission was denied. You can enable it anytime in browser settings.");
        return;
      }

      if (perm !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      if (!vapidKeyQuery.data) {
        toast.error("Notification service is preparing. Please try again in a moment.");
        return;
      }

      // Convert URL-Safe Base64 to Uint8Array for applicationServerKey
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKeyQuery.data),
      });

      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!p256dh || !auth) {
        toast.error("Could not obtain push keys from browser.");
        return;
      }

      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh)))),
        auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(auth)))),
      });

      toast.success("Daily Bytes notifications enabled! (8:01 AM & 6:00 PM)");
    } catch (e) {
      console.error("[PushSubscribe] error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to enable notifications.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "button") {
    if (permission === "granted") {
      return (
        <button type="button" onClick={handleSubscribe} className="btn ghost push-btn" title="Daily notifications active">
          <BellRing size={16} className="text-primary" /> Notifications Active
        </button>
      );
    }
    return (
      <button type="button" onClick={handleSubscribe} disabled={loading} className="btn outline push-btn">
        <Bell size={16} /> {loading ? "Enabling..." : "Enable Notifications"}
      </button>
    );
  }

  // Header icon variant (matches theme-toggle style)
  return (
    <button
      className={`theme-toggle push-toggle ${permission === "granted" ? "active" : ""}`}
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      aria-label={permission === "granted" ? "Daily notifications active" : "Enable daily notifications"}
      title={
        permission === "granted"
          ? "Daily notifications active (8:01 AM & 6:00 PM)"
          : permission === "denied"
          ? "Notifications blocked in browser"
          : permission === "unsupported"
          ? "Notifications info"
          : "Enable daily notifications (8:01 AM & 6:00 PM)"
      }
    >
      {permission === "granted" ? (
        <BellRing size={17} style={{ color: "var(--primary, #3b82f6)" }} />
      ) : permission === "denied" ? (
        <BellOff size={17} style={{ opacity: 0.6 }} />
      ) : (
        <Bell size={17} />
      )}
      <span>{permission === "granted" ? "Alerts On" : "Alerts"}</span>
    </button>
  );
}
