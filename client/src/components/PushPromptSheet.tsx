import React, { useState } from "react";
import { Bell, Sparkles, X, Share, PlusSquare, Smartphone, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "../lib/trpc";
import {
  getOneSignal,
  waitForSubscriptionId,
  recordPushPromptDismissed,
  recordPushPromptGranted,
  isIosSafari,
} from "../lib/pushClient";

interface PushPromptSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
}

export function PushPromptSheet({ isOpen, onClose, onSubscribed }: PushPromptSheetProps) {
  const [loading, setLoading] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const oneSignalAppIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const registerSubscriptionMutation = trpc.reader.registerOneSignalSubscription.useMutation();

  if (!isOpen) return null;

  const handleDismiss = () => {
    recordPushPromptDismissed();
    onClose();
  };

  const handleEnable = async () => {
    if (isIosSafari()) {
      setShowIosModal(true);
      return;
    }

    if (!oneSignalAppIdQuery.data) {
      toast.error("Push service is initializing, please try again in a moment.");
      return;
    }

    try {
      setLoading(true);
      const OneSignal = await getOneSignal(oneSignalAppIdQuery.data);
      await OneSignal.Notifications.requestPermission();

      if (Notification.permission !== "granted") {
        recordPushPromptDismissed();
        toast.error("Notification permission was not granted.");
        onClose();
        return;
      }

      recordPushPromptGranted();
      const subscriptionId = await waitForSubscriptionId(OneSignal);
      if (subscriptionId) {
        await registerSubscriptionMutation.mutateAsync({ subscriptionId });
      }

      toast.success("Daily briefing notifications enabled!");
      onSubscribed?.();
      onClose();
    } catch (err: any) {
      console.error("[PushPromptSheet] Failed to enable notifications:", err);
      toast.error("Could not complete push setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (showIosModal) {
    return <IosInstallHelpModal onClose={() => { setShowIosModal(false); onClose(); }} />;
  }

  return (
    <div className="push-sheet-backdrop" onClick={handleDismiss} role="dialog" aria-modal="true" aria-labelledby="push-sheet-title">
      <div className="push-sheet-container" onClick={e => e.stopPropagation()}>
        <button className="push-sheet-close" onClick={handleDismiss} aria-label="Close">
          <X size={18} />
        </button>

        <div className="push-sheet-header">
          <div className="push-sheet-badge">
            <Bell size={24} className="text-primary" />
          </div>
          <div className="push-sheet-title-group">
            <span className="push-sheet-eyebrow">
              <Sparkles size={13} /> High-Signal Delivery
            </span>
            <h2 id="push-sheet-title" className="push-sheet-title">Never miss the drop</h2>
          </div>
        </div>

        <p className="push-sheet-desc">
          Get Aurikrex Bytes delivered to your lock screen right on time.
          Zero noise, no spam, and one tray notification that updates automatically.
        </p>

        <div className="push-sheet-schedule-pills">
          <div className="push-schedule-pill">
            <span className="pill-dot morning" />
            <div className="pill-text">
              <strong>Morning Brief</strong>
              <span>8:00 AM Lagos</span>
            </div>
          </div>
          <div className="push-schedule-pill">
            <span className="pill-dot evening" />
            <div className="pill-text">
              <strong>Evening Recap</strong>
              <span>10:00 PM Lagos</span>
            </div>
          </div>
        </div>

        <div className="push-sheet-actions">
          <button
            type="button"
            className="push-btn-primary"
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? "Enabling..." : "Enable Daily Notifications"}
          </button>
          <button
            type="button"
            className="push-btn-secondary"
            onClick={handleDismiss}
            disabled={loading}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

export function IosInstallHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="push-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="push-sheet-container ios-help" onClick={e => e.stopPropagation()}>
        <button className="push-sheet-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="push-sheet-header">
          <div className="push-sheet-badge ios">
            <Smartphone size={24} className="text-primary" />
          </div>
          <div className="push-sheet-title-group">
            <h2 className="push-sheet-title">Add to Home Screen for iOS</h2>
          </div>
        </div>

        <p className="push-sheet-desc">
          Apple requires web apps to be added to your Home Screen before they can send push notifications:
        </p>

        <div className="ios-steps-list">
          <div className="ios-step-item">
            <div className="step-num"><Share size={15} /></div>
            <div>
              <strong>1. Tap Share</strong>
              <p>In Safari’s bottom toolbar, tap the Share icon (square with arrow).</p>
            </div>
          </div>
          <div className="ios-step-item">
            <div className="step-num"><PlusSquare size={15} /></div>
            <div>
              <strong>2. Add to Home Screen</strong>
              <p>Scroll down the menu and choose “Add to Home Screen”.</p>
            </div>
          </div>
          <div className="ios-step-item">
            <div className="step-num"><Check size={15} /></div>
            <div>
              <strong>3. Open & Enable</strong>
              <p>Launch Bytes from your Home Screen and tap the bell icon to get 8 AM & 10 PM drops.</p>
            </div>
          </div>
        </div>

        <button type="button" className="push-btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
