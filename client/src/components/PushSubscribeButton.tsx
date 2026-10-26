import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  getOneSignal,
  waitForSubscriptionId,
  isIosSafari,
} from "../lib/pushClient";
import { IosInstallHelpModal } from "./PushPromptSheet";

interface PushSubscribeButtonProps {
  variant?: "header" | "button";
}

export function PushSubscribeButton({ variant = "header" }: PushSubscribeButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const oneSignalAppIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const registerSubscriptionMutation = trpc.reader.registerOneSignalSubscription.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    if (!oneSignalAppIdQuery.data) return;

    getOneSignal(oneSignalAppIdQuery.data)
      .then(OneSignal => {
        setIsSubscribed(Boolean(OneSignal.User?.PushSubscription?.optedIn));
      })
      .catch(() => undefined);
  }, [oneSignalAppIdQuery.data]);

  const handleSubscribe = async () => {
    if (typeof window === "undefined") return;

    if (isIosSafari()) {
      setShowIosHelp(true);
      return;
    }

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      toast.error("Push notifications are not supported in this browser.", { duration: 4000 });
      return;
    }

    if (Notification.permission === "denied") {
      toast.error(
        "Notifications are blocked in your browser settings. Click the lock/site settings icon in your address bar to allow notifications.",
        { duration: 6000 }
      );
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

      await OneSignal.User?.PushSubscription?.optIn?.();
      const subscriptionId = await waitForSubscriptionId(OneSignal);
      if (!subscriptionId) {
        throw new Error("OneSignal did not return a subscription ID yet. Please try again.");
      }

      await registerSubscriptionMutation.mutateAsync({ subscriptionId });
      setIsSubscribed(true);

      toast.success("Daily briefing notifications enabled!");
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
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={loading}
          className="btn ghost push-btn"
          title="Daily notifications active (Click to resync)"
        >
          <BellRing size={16} className="text-primary" /> {loading ? "Syncing..." : "Notifications Active"}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="btn outline push-btn"
      >
        <Bell size={16} /> {loading ? "Enabling..." : "Enable System Push"}
      </button>
    );
  }

  // Header icon button variant with 3 distinct states: on / off / blocked
  return (
    <>
      <button
        className={`theme-toggle push-toggle ${permission === "granted" || isSubscribed ? "active" : ""} ${permission === "denied" ? "blocked" : ""}`}
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        aria-label={
          permission === "granted" || isSubscribed
            ? "Daily notifications active"
            : permission === "denied"
            ? "Notifications blocked in browser settings"
            : "Enable daily notifications"
        }
        title={
          permission === "granted" || isSubscribed
            ? "Daily push notifications active (8:00 AM & 10:00 PM)"
            : permission === "denied"
            ? "Notifications blocked in browser settings. Click to learn how to unblock."
            : isIosSafari()
            ? "Tap for iOS Home Screen push setup instructions"
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
        <span className="sr-only">
          {permission === "granted" || isSubscribed ? "Alerts On" : permission === "denied" ? "Alerts Blocked" : "Alerts"}
        </span>
        {(permission === "granted" || isSubscribed) && <span className="push-active-dot" />}
      </button>

      {showIosHelp && <IosInstallHelpModal onClose={() => setShowIosHelp(false)} />}
    </>
  );
}
