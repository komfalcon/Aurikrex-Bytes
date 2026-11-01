import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { ArrowRight, BookOpen, Check, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  EmptyToday,
  FEED_VIEW_MODE_KEY,
  FeedViewMode,
  FeedViewModeControl,
  getInitialFeedViewMode,
  PostCard,
  PublicLayout,
  ReadingViewOnboarding,
  TodayCompletionCard,
} from "./SharedLayout";

function getWeekDays(lastActiveDate: string | null | undefined, currentStreak: number, timeZone: string) {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const today = new Date(`${todayKey}T12:00:00Z`);
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay());
  const streakEnd = lastActiveDate || "";
  const streakEndDate = streakEnd ? new Date(`${streakEnd}T12:00:00Z`) : null;
  const streakStartDate = streakEndDate ? new Date(streakEndDate) : null;
  if (streakStartDate && streakEndDate) {
    streakStartDate.setUTCDate(streakEndDate.getUTCDate() - Math.max(currentStreak - 1, 0));
  }
  const dayFormatter = new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setUTCDate(startOfWeek.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const isActive =
      currentStreak > 0 &&
      streakStartDate !== null &&
      streakEnd !== "" &&
      key >= streakStartDate.toISOString().slice(0, 10) &&
      key <= streakEnd &&
      key <= todayKey;
    return {
      key,
      label: dayFormatter.format(date),
      dateLabel: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date),
      isToday: key === todayKey,
      isFuture: key > todayKey,
      isActive,
    };
  });
}

function NicknameOnboardingModal({
  isOpen,
  onClose,
  defaultName,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultName: string;
  onSaved: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const updateProfile = trpc.reader.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Welcome to Aurikrex Bytes!");
      onSaved();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save nickname");
    },
  });

  useEffect(() => {
    if (isOpen) {
      const suggested = defaultName.trim().split(/\s+/)[0] || "";
      setNickname(suggested);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      onClose();
      return;
    }
    updateProfile.mutate({
      name: defaultName || nickname.trim(),
      nickname: nickname.trim(),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-6 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 text-2xl">
          👋
        </div>
        <h3 className="text-lg font-bold text-[var(--ink)]">What should we call you?</h3>
        <p className="mt-1.5 text-xs text-[var(--muted)] leading-relaxed">
          Pick a preferred first name or nickname for your daily briefings, streak updates, and reading desk.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Alex, Falcon, Sam"
            maxLength={50}
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-sm font-semibold text-center focus:outline-none focus:border-[var(--blue)] focus:ring-1 focus:ring-[var(--blue)] transition-all"
          />

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={updateProfile.isPending || !nickname.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[var(--blue)] hover:bg-[var(--blue-dark,#1d4ed8)] text-white shadow-md disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? "Saving…" : "Save & Continue"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={updateProfile.isPending}
              className="py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export function ReaderDashboard() {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [viewMode, setViewMode] = useState<FeedViewMode>(getInitialFeedViewMode);
  const effectiveViewMode: FeedViewMode = viewMode;
  const [preferenceHydrated, setPreferenceHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const timeZone = "Africa/Lagos";
  const dashboard = trpc.reader.dashboard.useQuery(
    { timeZone },
    { enabled: Boolean(session.data), retry: false }
  );
  const savePreference = trpc.reader.setFeedPreference.useMutation();
  const markPostRead = trpc.reader.markPostRead.useMutation({
    onSuccess: () => {
      void utils.reader.dashboard.invalidate({ timeZone });
    },
  });
  const completeBriefing = trpc.reader.completeTodayBriefing.useMutation({
    onSuccess: (res) => {
      void utils.reader.dashboard.invalidate({ timeZone });
      if (res.streak?.increased) {
        toast.success(`${res.streak.currentStreak}-day streak unlocked! Today's briefing is complete.`);
      } else {
        toast.success("Today's briefing marked complete!");
      }
    },
    onError: () => {
      toast.error("Could not mark today's briefing complete. Please try again.");
    },
  });
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);

  useEffect(() => {
    if (session.isLoading || !session.data) return;
    const user = session.data as any;
    if (!user.nickname && typeof window !== "undefined") {
      const dismissed = window.localStorage.getItem("aurikrex:nickname-prompt-dismissed");
      if (!dismissed) {
        setShowNicknamePrompt(true);
      }
    }
  }, [session.data, session.isLoading]);

  const data = dashboard.data as any;
  const todayPosts = useMemo(() => (data?.todayPosts ?? []).slice(0, 10), [data?.todayPosts]);
  const serverReadIds = useMemo(() => new Set<number>(data?.readPostIds ?? []), [data?.readPostIds]);
  const todayReadCount = useMemo(
    () =>
      typeof data?.todayReadCount === "number"
        ? data.todayReadCount
        : todayPosts.filter((p: any) => p.isRead || serverReadIds.has(p.id)).length,
    [data?.todayReadCount, todayPosts, serverReadIds]
  );
  const todayTotalCount = todayPosts.length;
  const progressPercent = todayTotalCount > 0 ? Math.min(100, Math.round((todayReadCount / todayTotalCount) * 100)) : 0;

  useEffect(() => {
    if (!session.isLoading && !session.data) navigate("/login");
  }, [navigate, session.data, session.isLoading]);

  useEffect(() => {
    if (!dashboard.data || preferenceHydrated) return;
    setViewMode(dashboard.data.reader.feedViewMode === "compact" ? "compact" : "editorial");
    setShowOnboarding(!dashboard.data.reader.feedViewOnboardingCompleted);
    setPreferenceHydrated(true);
  }, [dashboard.data, preferenceHydrated]);

  useEffect(() => {
    window.localStorage.setItem(FEED_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const persistPreference = (nextMode: FeedViewMode, completeOnboarding: boolean) => {
    const previousMode = viewMode;
    setViewMode(nextMode);
    if (completeOnboarding) setShowOnboarding(false);
    savePreference.mutate(
      { feedViewMode: nextMode, onboardingCompleted: completeOnboarding || Boolean(dashboard.data?.reader.feedViewOnboardingCompleted) },
      {
        onSuccess: () => {
          if (completeOnboarding) setShowOnboarding(false);
        },
        onError: () => {
          setViewMode(previousMode);
          if (completeOnboarding) setShowOnboarding(true);
          toast.error("Your reading preference could not be saved. Please try again.");
        },
        onSettled: () => void utils.reader.dashboard.invalidate({ timeZone }),
      }
    );
  };

  if (session.isLoading || (!session.data && !dashboard.error))
    return <div className="route-loading">Opening your briefing…</div>;

  const previewPost = todayPosts[0] ?? data?.allPosts?.[0] ?? { headline: "The useful context behind what matters", body: "A considered look at the stories shaping the day.", imageUrl: null };
  const firstName = (session.data as any)?.nickname || (data?.reader as any)?.nickname || data?.reader.name?.trim().split(/\s+/)[0] || "reader";
  const weekDays = getWeekDays(data?.streak.lastActiveDate, data?.streak.currentStreak ?? 0, timeZone);

  return (
    <PublicLayout seo={{ title: "Today's Edition — Aurikrex Bytes", description: "Your daily finite Aurikrex Bytes briefing and reading streak.", path: "/dashboard", robots: "noindex,nofollow" }}>
      <main className="container reader-dashboard">
        <section className="dashboard-intro">
          <div className="dashboard-welcome">
            <span className="eyebrow"><span className="live-dot" /> Your reading desk · Finite Daily Drop</span>
            <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}.</h1>
            <p>
              {todayTotalCount > 0
                ? `Today’s finite edition has ${todayTotalCount} curated ${todayTotalCount === 1 ? "Byte" : "Bytes"}. Finish the drop to lock in your daily streak.`
                : "Your calm 5-minute daily technology ritual."}
            </p>
          </div>
          <div className={`streak-card ${data?.streak.completedToday ? "streak-card-celebrate" : ""}`}>
            <div className="streak-card-heading">
              <div className="streak-card-heading-main">
                <div className="streak-flame"><Flame size={20} fill="currentColor" /></div>
                <div>
                  <strong>{data?.streak.currentStreak ?? 0}</strong>
                  <span>{data?.streak.completedToday ? "day streak (complete)" : "day streak"}</span>
                </div>
              </div>
              <small>Best: {data?.streak.longestStreak ?? 0} days</small>
            </div>
            <div className="streak-week" aria-label="Current week reading activity">
              {weekDays.map(day => (
                <div className={`streak-day ${day.isActive ? "is-active" : ""} ${day.isToday ? "is-today" : ""} ${day.isFuture ? "is-future" : ""}`} key={day.key} title={`${day.dateLabel}${day.isActive ? " · Completed" : " · Not completed"}`}>
                  <span>{day.label}</span>
                  <i aria-hidden="true"><Flame size={13} fill="currentColor" /></i>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="dashboard-view-control">
          <FeedViewModeControl value={viewMode} onChange={mode => persistPreference(mode, false)} />
          <span className="feed-view-helper">Switch between Editorial cards and Compact grid on desktop &amp; mobile</span>
        </div>

        {showOnboarding && (
          <ReadingViewOnboarding
            value={viewMode}
            post={previewPost}
            onChange={setViewMode}
            onContinue={() => persistPreference(viewMode, true)}
            onSkip={() => persistPreference("editorial", true)}
          />
        )}

        <section className="dashboard-feed">
          <div className="section-heading dashboard-heading">
            <h2>Today’s Bytes</h2>
          </div>

          {todayTotalCount > 0 && (
            <div className="edition-progress-strip" role="status" aria-label="Today's reading progress">
              <div className="edition-progress-info">
                <strong>
                  {todayReadCount} of {todayTotalCount} {todayTotalCount === 1 ? "Byte" : "Bytes"} read today
                </strong>
                <span>
                  {todayReadCount >= todayTotalCount
                    ? "Daily ritual complete — streak earned!"
                    : `${todayTotalCount - todayReadCount} remaining to earn today's streak`}
                </span>
              </div>
              <div className="edition-progress-bar-track" aria-hidden="true">
                <div className="edition-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              {todayReadCount < todayTotalCount && (
                <button
                  type="button"
                  className="button button-small button-outline"
                  onClick={() => completeBriefing.mutate({ timeZone })}
                  disabled={completeBriefing.isPending}
                >
                  <Check size={14} />
                  <span>{completeBriefing.isPending ? "Completing…" : "Mark today's briefing read"}</span>
                </button>
              )}
            </div>
          )}

          {dashboard.isLoading ? (
            <div className={`skeleton-grid skeleton-grid-${effectiveViewMode}`}><div /><div /><div /></div>
          ) : todayPosts.length ? (
            <>
              <div className={`post-grid post-grid-${effectiveViewMode}`}>
                {todayPosts.map((post: any, index: number) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    featured={effectiveViewMode === "editorial" && index === 0}
                    isRead={Boolean(post.isRead || serverReadIds.has(post.id))}
                    onMarkRead={postId => markPostRead.mutate({ postId, timeZone })}
                  />
                ))}
              </div>
              <TodayCompletionCard
                streak={data?.streak.currentStreak}
                readCount={todayReadCount}
                totalCount={todayTotalCount}
                leadPostId={todayPosts[0]?.id}
                onMarkComplete={() => completeBriefing.mutate({ timeZone })}
                isCompleting={completeBriefing.isPending}
              />
            </>
          ) : (
            <EmptyToday emptyState={data?.emptyState} />
          )}
        </section>
      </main>
      <NicknameOnboardingModal
        isOpen={showNicknamePrompt}
        onClose={() => {
          setShowNicknamePrompt(false);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("aurikrex:nickname-prompt-dismissed", "true");
          }
        }}
        defaultName={session.data?.name || ""}
        onSaved={() => {
          setShowNicknamePrompt(false);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("aurikrex:nickname-prompt-dismissed", "true");
          }
          utils.reader.session.invalidate();
          utils.reader.dashboard.invalidate();
        }}
      />
    </PublicLayout>
  );
}
