import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Camera,
  ChevronRight,
  Flame,
  LogOut,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { IosInstallHelpModal } from "@/components/PushPromptSheet";
import { getOneSignal, waitForSubscriptionId, isIosSafari } from "@/lib/pushClient";
import { AurikrexAppsSwitcher } from "@/components/AurikrexAppsSwitcher";
import {
  getInitial,
  PostCard,
  ProfileLightboxModal,
  PublicLayout,
  ThemeToggle,
} from "./SharedLayout";

function EditDetailsModal({
  isOpen,
  onClose,
  currentName,
  currentNickname,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentNickname?: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [nickname, setNickname] = useState(currentNickname || "");
  const updateProfile = trpc.reader.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Details updated successfully");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update details");
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setNickname(currentNickname || "");
    }
  }, [isOpen, currentName, currentNickname]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    updateProfile.mutate({
      name: name.trim(),
      nickname: nickname.trim() || null,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-6 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--blue)]/10 text-[var(--blue)] flex items-center justify-center">
              <SquarePen size={17} />
            </div>
            <h3 className="text-base font-bold text-[var(--ink)]">Edit Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Korede Omotosho"
              maxLength={100}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-sm font-medium focus:outline-none focus:border-[var(--blue)] focus:ring-1 focus:ring-[var(--blue)] transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Nickname / Preferred Name
              </label>
              <span className="text-[11px] text-[var(--muted)]">Optional</span>
            </div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Falcon, Sam, Alex"
              maxLength={50}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-sm font-medium focus:outline-none focus:border-[var(--blue)] focus:ring-1 focus:ring-[var(--blue)] transition-all"
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              What should we call you across your briefing desk and streak updates.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)] mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={updateProfile.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProfile.isPending || !name.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--blue)] hover:bg-[var(--blue-dark,#1d4ed8)] text-white shadow-md disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function EmailDigestSettingRow({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const utils = trpc.useUtils();
  const updatePref = trpc.reader.setEmailDigestPreference.useMutation({
    onSuccess: (res) => {
      setEnabled(res.emailDigestEnabled);
      void utils.reader.session.invalidate();
      void utils.reader.dashboard.invalidate();
      toast.success(
        res.emailDigestEnabled
          ? "8:00 AM WAT morning email briefing enabled!"
          : "Morning email briefing paused."
      );
    },
    onError: () => {
      setEnabled(prev => !prev);
      toast.error("Could not update email briefing preference.");
    },
  });

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  const handleChange = (next: boolean) => {
    setEnabled(next);
    updatePref.mutate({ enabled: next });
  };

  return (
    <div className="px-profile-row">
      <div className="px-profile-setting-info">
        <span>8:00 AM WAT Email Briefing</span>
        <p className="muted small" style={{ margin: "2px 0 0", fontSize: "12px" }}>
          Receive today&apos;s 5–10 headlines and one-line takeaways in your inbox
        </p>
      </div>
      <div className="px-profile-setting-control">
        <label className="switch" title={enabled ? "Click to pause morning email" : "Click to enable morning email"}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={updatePref.isPending}
            onChange={e => handleChange(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>
    </div>
  );
}

function PushNotificationSettingRow() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const appIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const registerSub = trpc.reader.registerOneSignalSubscription.useMutation();
  const unregisterSub = trpc.reader.unregisterOneSignalSubscription.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (!appIdQuery.data) return;
    getOneSignal(appIdQuery.data)
      .then(OneSignal => {
        setIsSubscribed(Boolean(OneSignal.User?.PushSubscription?.optedIn));
      })
      .catch(() => undefined);
  }, [appIdQuery.data]);

  const handleToggle = async (enable: boolean) => {
    if (isIosSafari()) {
      setShowIosHelp(true);
      return;
    }

    if (enable) {
      if (Notification.permission === "denied") {
        toast.error("Notifications are blocked in your browser settings. Please allow notifications in site settings.");
        return;
      }
      try {
        setLoading(true);
        const OneSignal = await getOneSignal(appIdQuery.data || "");
        await OneSignal.Notifications.requestPermission();
        setPermission(Notification.permission);
        if (Notification.permission !== "granted") {
          toast.error("Notification permission was not granted.");
          return;
        }
        await OneSignal.User?.PushSubscription?.optIn?.();
        const subId = await waitForSubscriptionId(OneSignal);
        if (subId) {
          await registerSub.mutateAsync({ subscriptionId: subId });
        }
        setIsSubscribed(true);
        toast.success("Daily briefing notifications enabled!");
      } catch (err: any) {
        toast.error("Failed to enable notifications.");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        const OneSignal = await getOneSignal(appIdQuery.data || "");
        const subId = OneSignal.User?.PushSubscription?.id;
        await OneSignal.User?.PushSubscription?.optOut?.();
        if (subId) {
          await unregisterSub.mutateAsync({ subscriptionId: subId });
        }
        setIsSubscribed(false);
        toast.success("Daily notifications disabled.");
      } catch (err: any) {
        toast.error("Failed to disable notifications.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <div className="px-profile-row">
        <div className="px-profile-setting-info">
          <span>Web push notifications</span>
          <p className="muted small" style={{ margin: "2px 0 0", fontSize: "12px" }}>
            Morning (8:00 AM) and Evening (10:00 PM) browser drops
          </p>
        </div>
        <div className="px-profile-setting-control">
          {permission === "denied" ? (
            <span className="badge-blocked" title="Notifications blocked in your browser settings">
              Blocked
            </span>
          ) : (
            <label className="switch" title={isSubscribed ? "Click to opt out" : "Click to opt in"}>
              <input
                type="checkbox"
                checked={isSubscribed}
                disabled={loading || permission === "unsupported"}
                onChange={e => handleToggle(e.target.checked)}
              />
              <span className="slider" />
            </label>
          )}
        </div>
      </div>
      {showIosHelp && <IosInstallHelpModal onClose={() => setShowIosHelp(false)} />}
    </>
  );
}

export function ProfilePage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const timeZone = "Africa/Lagos";
  const dashboard = trpc.reader.dashboard.useQuery(
    { timeZone },
    { enabled: Boolean(session.data), retry: false }
  );
  const saved = trpc.reader.saved.useQuery(undefined, { enabled: Boolean(session.data), retry: false });
  const coins = trpc.auth.coinsBalance.useQuery(undefined, { enabled: Boolean(session.data), retry: false });
  const appIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const unregisterSubMutation = trpc.reader.unregisterOneSignalSubscription.useMutation();
  const [showPhoto, setShowPhoto] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.reader.session.setData(undefined, undefined);
      window.location.replace("/");
    },
  });

  const handleProfileSignout = async () => {
    if (typeof window !== "undefined" && appIdQuery.data) {
      try {
        const OneSignal = await getOneSignal(appIdQuery.data);
        const subId = OneSignal.User?.PushSubscription?.id;
        if (subId) {
          await unregisterSubMutation.mutateAsync({ subscriptionId: subId }).catch(() => undefined);
        }
        await OneSignal.User?.PushSubscription?.optOut?.().catch(() => undefined);
        await OneSignal.logout?.().catch(() => undefined);
      } catch (err) {
        console.warn("[PushLogout] Profile signout error:", err);
      }
    }
    logout.mutate();
  };
  useEffect(() => {
    if (!session.isLoading && !session.data) navigate("/login");
  }, [navigate, session.data, session.isLoading]);
  if (session.isLoading || !session.data) return <div className="route-loading">Opening your profile…</div>;

  const user = session.data as any;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "Reader";
  const nickname = user.nickname?.trim() || null;
  const coinBalance = coins.data ? Math.min((coins.data as { balance: number }).balance, 2500) : null;
  const totalBytesRead = (dashboard.data as any)?.totalBytesRead ?? (dashboard.data as any)?.readPostIds?.length ?? 0;

  const stats: Array<{ label: string; value: string; icon: ReactNode }> = [
    { label: "Day streak", value: String(dashboard.data?.streak.currentStreak ?? 0), icon: <Flame size={16} /> },
    { label: "Bytes read", value: String(totalBytesRead), icon: <BookOpen size={16} /> },
    { label: "Saved", value: String(saved.data?.length ?? 0), icon: <Bookmark size={16} /> },
    { label: "AuriCoins", value: coinBalance === null ? "…" : coinBalance.toLocaleString(), icon: <Sparkles size={16} /> },
  ];

  const emailDigestEnabled =
    (dashboard.data as any)?.reader?.emailDigestEnabled ?? user.emailDigestEnabled ?? true;

  return (
    <PublicLayout seo={{ title: "Your profile — Aurikrex Bytes", description: "Your Aurikrex Bytes profile and settings.", path: "/profile", robots: "noindex,nofollow" }}>
      <main className="container page-main px-profile-page">
        <section className="px-profile-header">
          <div className="px-profile-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} />
            ) : (
              <span>{getInitial(nickname || displayName)}</span>
            )}
          </div>
          <div className="px-profile-identity">
            <div className="px-profile-name-row">
              <h1>{user.name || displayName}</h1>
              {nickname && (
                <span className="px-profile-nickname-badge">
                  aka <strong>{nickname}</strong>
                </span>
              )}
            </div>
            {user.email && <p>{user.email}</p>}
          </div>
          <div className="px-profile-header-actions">
            <button
              type="button"
              className="px-profile-action-btn"
              onClick={() => setShowEditDetails(true)}
            >
              <SquarePen size={15} /> <span>Edit details</span>
            </button>
            <button
              type="button"
              className="px-profile-action-btn"
              onClick={() => setShowPhoto(true)}
            >
              <Camera size={15} /> <span>Change photo</span>
            </button>
          </div>
        </section>

        <section className="px-profile-stats" aria-label="Your reading stats">
          {stats.map(stat => (
            <div className="px-profile-stat" key={stat.label}>
              <span className="px-profile-stat-icon">{stat.icon}</span>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="px-profile-card">
          <h2>Delivery &amp; Preferences</h2>
          <EmailDigestSettingRow initialEnabled={Boolean(emailDigestEnabled)} />
          <PushNotificationSettingRow />
          <div className="px-profile-row">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
          <div className="px-profile-row">
            <span>Aurikrex Apps</span>
            <AurikrexAppsSwitcher currentAppId="bytes" />
          </div>
        </section>

        <section className="px-profile-card">
          <h2>Saved Briefings</h2>
          <Link href="/saved" className="px-profile-link">
            <span className="px-profile-link-icon"><Bookmark size={16} /></span>
            <span>Saved posts</span>
            <ChevronRight size={16} />
          </Link>
        </section>

        <button type="button" className="px-profile-signout" onClick={handleProfileSignout} disabled={logout.isPending}>
          <LogOut size={16} /> <span>Sign out</span>
        </button>
      </main>
      <ProfileLightboxModal isOpen={showPhoto} onClose={() => setShowPhoto(false)} sessionData={session.data} />
      <EditDetailsModal
        isOpen={showEditDetails}
        onClose={() => setShowEditDetails(false)}
        currentName={user.name || ""}
        currentNickname={nickname}
        onSuccess={() => {
          utils.reader.session.invalidate();
          utils.reader.dashboard.invalidate();
        }}
      />
    </PublicLayout>
  );
}

export function SavedPosts() {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const saved = trpc.reader.saved.useQuery(undefined, { enabled: Boolean(session.data), retry: false });
  useEffect(() => { if (!session.isLoading && !session.data) navigate("/login"); }, [navigate, session.data, session.isLoading]);
  if (session.isLoading || (!session.data && !saved.error)) return <div className="route-loading">Opening your saved stories…</div>;
  return <PublicLayout seo={{ title: "Saved Posts — Aurikrex Bytes", description: "Stories you saved for later.", path: "/saved", robots: "noindex,nofollow" }}>
    <main className="container page-main saved-page">
      <div className="page-intro"><span className="eyebrow">Your reading list</span><h1>Saved Posts</h1><p>Keep the stories worth returning to close at hand.</p></div>
      {saved.isLoading ? <div className="skeleton-grid"><div /><div /><div /></div> : saved.data?.length ? <div className="post-grid">{saved.data.map((post: any) => <PostCard key={post.id} post={post} />)}</div> : <div className="empty-state"><Bookmark size={24} /><h2>You haven’t saved anything yet</h2><p>Save a story from the feed when you want to come back to it.</p><Link className="button" href="/archive">Browse the archive <ArrowRight size={15} /></Link></div>}
    </main>
  </PublicLayout>;
}
