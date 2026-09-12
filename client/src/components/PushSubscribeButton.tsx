import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Bell, BellOff } from "lucide-react";

export function PushSubscribeButton() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [loading, setLoading] = useState(false);
  const vapidKeyQuery = trpc.reader.vapidPublicKey.useQuery();
  const subscribeMutation = trpc.reader.subscribePush.useMutation();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("denied");
    }
  }, []);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      if (!vapidKeyQuery.data) return;

      // URL Safe Base64
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
      
      if (!p256dh || !auth) return;

      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh) as unknown as number[])),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth) as unknown as number[])),
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (permission === "denied" || !("Notification" in window)) {
    return null; // unsupported or blocked
  }

  if (permission === "granted") {
    return (
      <button disabled className="btn ghost" title="Notifications enabled">
        <Bell size={16} /> Subscribed
      </button>
    );
  }

  return (
    <button onClick={handleSubscribe} disabled={loading || !vapidKeyQuery.data} className="btn outline">
      <BellOff size={16} /> {loading ? "Enabling..." : "Enable Notifications"}
    </button>
  );
}
