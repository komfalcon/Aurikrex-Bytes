import { FormEvent, ReactNode, useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Facebook,
  FileText,
  Flame,
  Home as HomeIcon,
  Instagram,
  Info,
  Layers,
  Linkedin,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Moon,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import { PushPromptSheet } from "@/components/PushPromptSheet";
import { shouldShowPushPrompt, getOneSignal } from "@/lib/pushClient";
import { AurikrexAppsSwitcher } from "@/components/AurikrexAppsSwitcher";
import { AuriCoinBadge } from "@/components/AuriCoinBadge";
import { EndOfFeedIllustration } from "@/components/EndOfFeedIllustration";
import { useTheme } from "@/contexts/ThemeContext";
import { authRoutes } from "@/shared/authUi";
import Seo from "@/components/Seo";
import { FormattedInlineText } from "@/components/FormattedBody";

export const getInitial = (nameOrEmail?: string | null) => {
  if (!nameOrEmail) return "U";
  const clean = nameOrEmail.trim().replace(/^@/, "");
  return clean ? clean[0].toUpperCase() : "U";
};

export const formatDate = (value?: string | Date | number | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Today";

export const excerpt = (text: string, length = 150) =>
  text.length > length ? `${text.slice(0, length).trim()}…` : text;

export const optimizedImage = (url: string, width: number) =>
  url.includes("res.cloudinary.com") &&
  url.includes("/upload/") &&
  !url.includes("f_auto")
    ? url.replace("/upload/", `/upload/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_${width}/`)
    : url;

export type FeedViewMode = "editorial" | "compact";
export const FEED_VIEW_MODE_KEY = "aurikrex-feed-view-mode";
export const getInitialFeedViewMode = (): FeedViewMode => {
  if (typeof window === "undefined") return "editorial";
  return window.localStorage.getItem(FEED_VIEW_MODE_KEY) === "compact"
    ? "compact"
    : "editorial";
};

export function useIsMobileViewport(maxWidth = 850) {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return isMobile;
}

export const AUTH_RETURN_KEY = "aurikrex-auth-return-to";
export const safeReturnTo = (value: string | null | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
export const authPathWithReturnTo = (returnTo: string) =>
  `${authRoutes.login}?returnTo=${encodeURIComponent(returnTo)}`;
export const authSignupWithReturnTo = (returnTo: string) =>
  `${authRoutes.signup}?returnTo=${encodeURIComponent(returnTo)}`;
export const rememberAuthReturnTo = (returnTo: string) => {
  if (typeof window !== "undefined") window.sessionStorage.setItem(AUTH_RETURN_KEY, returnTo);
};

export function ProtectedLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  return (
    <Link
      href={href}
      className={className}
      onClick={event => {
        onClick?.(event);
        if (!session.isLoading && !session.data) {
          event.preventDefault();
          rememberAuthReturnTo(href);
          navigate(authSignupWithReturnTo(href));
        }
      }}
    >
      {children}
    </Link>
  );
}

export function Logo({ compact = false, href = "/", showMark = true }: { compact?: boolean; href?: string; showMark?: boolean }) {
  return (
    <Link
      href={href}
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="Aurikrex Bytes home"
    >
      {showMark && <img src="/logo-512.png" alt="Aurikrex Bytes logo" />}
      <span>
        Aurikrex <b>Bytes</b>
      </span>
    </Link>
  );
}

export function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.42Z" />
      <path fill="#34A853" d="M12 21.75c2.65 0 4.88-.88 6.5-2.38l-3.15-2.45c-.88.59-2 .94-3.35.94-2.57 0-4.75-1.74-5.53-4.08H3.22v2.53A9.82 9.82 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.47 13.78a5.9 5.9 0 0 1 0-3.56V7.69H3.22a9.75 9.75 0 0 0 0 8.62l3.25-2.53Z" />
      <path fill="#EA4335" d="M12 6.14c1.45 0 2.75.5 3.77 1.48l2.83-2.83C16.88 3.2 14.65 2.25 12 2.25a9.82 9.82 0 0 0-8.78 5.44l3.25 2.53C7.25 7.88 9.43 6.14 12 6.14Z" />
    </svg>
  );
}

function XBrandIcon() {
  return (
    <svg className="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}

function TikTokBrandIcon() {
  return (
    <svg className="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon size={17} strokeWidth={1.8} /> : <Sun size={17} strokeWidth={1.8} />}
    </button>
  );
}

export function ProfileLightboxModal({
  isOpen,
  onClose,
  sessionData,
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionData: any;
}) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const avatarSignature = trpc.reader.avatarUploadSignature.useQuery(undefined, {
    enabled: isOpen,
    staleTime: 60_000,
  });
  const updateAvatarMutation = trpc.reader.updateAvatar.useMutation({
    onSuccess: async () => {
      await utils.reader.session.invalidate();
      toast.success("Profile photo updated!");
      setUploading(false);
    },
    onError: (err) => {
      const rawMsg = err?.message || "";
      const userMessage =
        rawMsg &&
        !rawMsg.includes("[{") &&
        !rawMsg.includes("Invalid avatar URL") &&
        !rawMsg.includes("TRPCClientError")
          ? rawMsg
          : "Couldn't upload photo, try again";
      toast.error(userMessage);
      setUploading(false);
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be under 5MB.");
      return;
    }

    try {
      setUploading(true);
      const sig = avatarSignature.data || await utils.reader.avatarUploadSignature.fetch();
      if (!sig?.configured || !sig.signature || !sig.cloudName) {
        throw new Error("Photo storage is temporarily unavailable. Please try again.");
      }

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder || "aurikrex/avatars");
      form.append("signature", sig.signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: form }
      );
      const result = await response.json();
      if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || "Couldn't upload photo, try again");
      }

      await updateAvatarMutation.mutateAsync({ avatarUrl: result.secure_url });
    } catch (err: any) {
      console.error("[ProfilePhoto] Upload error:", err);
      const rawMsg = err?.message || "";
      const userMessage =
        rawMsg &&
        !rawMsg.includes("[{") &&
        !rawMsg.includes("Invalid avatar URL") &&
        !rawMsg.includes("TRPCClientError")
          ? rawMsg
          : "Couldn't upload photo, try again";
      toast.error(userMessage);
      setUploading(false);
    }
  };

  const name = sessionData?.name || sessionData?.email?.split("@")[0] || "Reader";
  const initial = getInitial(name);

  return createPortal(
    <div className="whatsapp-profile-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Profile picture modal">
      <div className="whatsapp-profile-card" onClick={(e) => e.stopPropagation()}>
        <button className="whatsapp-profile-close" onClick={onClose} aria-label="Close profile modal">
          <X size={20} />
        </button>

        <div className="whatsapp-profile-avatar-wrapper">
          {sessionData?.avatarUrl ? (
            <img src={sessionData.avatarUrl} alt={name} className="whatsapp-profile-img" />
          ) : (
            <div className="whatsapp-profile-fallback">
              <span>{initial}</span>
            </div>
          )}

          <button
            type="button"
            className="whatsapp-profile-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Change Profile Picture"
          >
            <Camera size={18} />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div className="whatsapp-profile-info">
          <h3>{name}</h3>
          <p>{sessionData?.email}</p>
          
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
            <span 
              onClick={() => {
                const akxId = (sessionData as any)?.aurikrexId || `AKX-${String(sessionData?.id || '0').padStart(6, '0')}`;
                navigator.clipboard.writeText(akxId);
                toast.success("Aurikrex ID copied to clipboard!");
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                borderRadius: '9999px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              title="Click to copy Aurikrex ID"
            >
              Aurikrex ID: <strong style={{ fontFamily: 'monospace' }}>{(sessionData as any)?.aurikrexId || `AKX-${String(sessionData?.id || '0').padStart(6, '0')}`}</strong>
            </span>
          </div>
        </div>

        <div className="whatsapp-profile-actions">
          <button
            type="button"
            className="button button-small button-outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload size={14} /> Change photo
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SiteHeader() {
  const [location] = useLocation();
  const [menu, setMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const utils = trpc.useUtils();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const appIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const unregisterSubMutation = trpc.reader.unregisterOneSignalSubscription.useMutation();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.reader.session.setData(undefined, undefined);
      setMenu(false);
      window.location.replace("/");
    },
  });

  const handleHeaderLogout = async () => {
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
        console.warn("[PushLogout] Header signout cleanup error:", err);
      }
    }
    logout.mutate();
  };
  const signedIn = Boolean(session.data);
  const homePath = signedIn ? "/dashboard" : "/";
  const isDiscoverActive = location === "/dashboard";
  const isSavedActive = location === "/saved";
  const isArchiveActive = location.startsWith("/archive");
  const isAboutActive = location === "/how-it-works";
  const isHelpActive = location === "/help";
  const isContactActive = location === "/contact";
  const isProfileActive = location === "/profile";

  useEffect(() => {
    setMenu(false);
  }, [location]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!menu) {
      document.body.style.overflow = "";
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menu]);

  return (
    <header className="site-header">
      <div className="site-header-left">
        <Logo href={homePath} />
        <Link href="/archive" className="px-header-search-pill" aria-label="Search Bytes and topics">
          <Search size={14} />
          <span>Search the archive…</span>
          <kbd>/</kbd>
        </Link>
        <nav className="main-nav" aria-label="Primary">
          <span className="px-sidebar-group-label">Briefing</span>
          {signedIn ? (
            <Link href={homePath} className={isDiscoverActive ? "active" : ""}>
              <Sparkles size={16} className="px-nav-icon" />
              <span>Today&apos;s Drop</span>
            </Link>
          ) : (
            <Link href="/" className={location === "/" ? "active" : ""}>
              <HomeIcon size={16} className="px-nav-icon" />
              <span>Home</span>
            </Link>
          )}
          <Link href="/archive" className={isArchiveActive ? "active" : ""}>
            <BookOpen size={16} className="px-nav-icon" />
            <span>Archive</span>
          </Link>
          {signedIn && (
            <Link href="/saved" className={isSavedActive ? "active" : ""}>
              <Bookmark size={16} className="px-nav-icon" />
              <span>Saved</span>
            </Link>
          )}
          {signedIn && (
            <Link href="/profile" className={isProfileActive ? "active" : ""}>
              <User size={16} className="px-nav-icon" />
              <span>Profile</span>
            </Link>
          )}
          <span className="px-sidebar-group-label px-sidebar-only">Resources</span>
          <Link href="/how-it-works" className={isAboutActive ? "active" : ""}>
            <Layers size={16} className="px-nav-icon" />
            <span>About</span>
          </Link>
          <Link href="/help" className={"px-sidebar-only " + (isHelpActive ? "active" : "")}>
            <CircleHelp size={16} className="px-nav-icon" />
            <span>Help Center</span>
          </Link>
          <Link href="/contact" className={"px-sidebar-only " + (isContactActive ? "active" : "")}>
            <Mail size={16} className="px-nav-icon" />
            <span>Contact</span>
          </Link>
        </nav>
      </div>
      <div className="header-actions">
        <div className="px-header-utility-row">
          {signedIn && <AuriCoinBadge className="header-coin-badge" />}
          {signedIn && <PushSubscribeButton variant="header" />}
          <AurikrexAppsSwitcher currentAppId="bytes" />
          <ThemeToggle />
        </div>
        <div className="px-header-account-row">
          {signedIn && (
            <Link
              href="/profile"
              className={`header-avatar-btn ${isProfileActive ? "active" : ""}`}
              title="View profile & settings"
              aria-label="View profile & settings"
            >
              {session.data?.avatarUrl ? (
                <img src={session.data.avatarUrl} alt={session.data?.name || "Profile"} className="header-avatar-img" />
              ) : (
                <span className="header-avatar-initial">
                  {getInitial(session.data?.name || session.data?.email || "U")}
                </span>
              )}
              <span className="px-sidebar-user-name">
                {(session.data as any)?.nickname || session.data?.name?.trim().split(/\s+/)[0] || session.data?.email?.split("@")[0] || "Reader"}
              </span>
            </Link>
          )}
          {signedIn ? (
            <button className="header-login text-button" onClick={handleHeaderLogout} disabled={logout.isPending}>
              <LogOut size={14} /> <span>Sign out</span>
            </button>
          ) : (
            <div className="px-guest-auth-btns">
              <Link className="header-login" href={authRoutes.login}>Sign in</Link>
              <Link className="button button-small" href={authRoutes.signup}>Get the 8:00 AM drop <ArrowRight size={14} /></Link>
            </div>
          )}
        </div>
        <button
          className="mobile-menu"
          onClick={() => setMenu(value => !value)}
          aria-label={menu ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menu}
          aria-controls="mobile-navigation-drawer"
        >
          {menu ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
        </button>
      </div>
      {menu && (
        <>
          <button className="mobile-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMenu(false)} />
          <nav id="mobile-navigation-drawer" className="mobile-nav" aria-label="Mobile navigation">
            <div className="mobile-nav-section">
              <span className="mobile-nav-label">Read</span>
              {signedIn ? (
                <>
                  <Link href="/dashboard" onClick={() => setMenu(false)}><Sparkles size={16} /> Today&apos;s Drop</Link>
                  <Link href="/archive" onClick={() => setMenu(false)}><BookOpen size={16} /> Archive Library</Link>
                  <Link href="/saved" onClick={() => setMenu(false)}><Bookmark size={16} /> Saved posts</Link>
                  <Link href="/profile" onClick={() => setMenu(false)}><User size={16} /> Profile &amp; account</Link>
                </>
              ) : (
                <>
                  <Link href="/" onClick={() => setMenu(false)}><HomeIcon size={16} /> Home</Link>
                  <Link href="/archive" onClick={() => setMenu(false)}><BookOpen size={16} /> Archive Library</Link>
                </>
              )}
            </div>
            <div className="mobile-nav-section">
              <span className="mobile-nav-label">Explore</span>
              <Link href="/how-it-works" onClick={() => setMenu(false)}><Info size={16} /> About</Link>
              <Link href="/help" onClick={() => setMenu(false)}><CircleHelp size={16} /> Help center</Link>
              <Link href="/contact" onClick={() => setMenu(false)}><Mail size={16} /> Contact</Link>
            </div>
            <div className="mobile-nav-section mobile-nav-preferences">
              <span className="mobile-nav-label">Ecosystem &amp; Preferences</span>
              <div className="mobile-nav-preference-row">
                <span>Aurikrex Apps</span>
                <AurikrexAppsSwitcher currentAppId="bytes" />
              </div>
              <div className="mobile-nav-preference-row">
                <span>Appearance</span>
                <ThemeToggle />
              </div>
            </div>
            <div className="mobile-nav-section mobile-nav-legal">
              <span className="mobile-nav-label">Legal</span>
              <Link href="/privacy" onClick={() => setMenu(false)}><ShieldCheck size={16} /> Privacy policy</Link>
              <Link href="/terms" onClick={() => setMenu(false)}><FileText size={16} /> Terms of service</Link>
            </div>
            <div className="mobile-nav-account">
              {signedIn ? (
                <>
                  <Link
                    href="/profile"
                    className="mobile-nav-btn mobile-nav-btn-secondary"
                    onClick={() => setMenu(false)}
                  >
                    <User size={16} />
                    <span>View Profile</span>
                  </Link>
                  <button
                    type="button"
                    className="mobile-nav-btn mobile-nav-btn-signout"
                    onClick={handleHeaderLogout}
                    disabled={logout.isPending}
                  >
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    className="mobile-nav-btn mobile-nav-btn-secondary"
                    href={authRoutes.login}
                    onClick={() => setMenu(false)}
                  >
                    <span>Sign in</span>
                  </Link>
                  <Link
                    className="mobile-nav-btn mobile-nav-btn-primary"
                    href={authRoutes.signup}
                    onClick={() => setMenu(false)}
                  >
                    <span>Get the 8:00 AM drop</span>
                    <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </nav>
        </>
      )}
      <ProfileLightboxModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        sessionData={session.data}
      />
    </header>
  );
}

export function SiteFooter() {
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const readerHome = session.data ? "/dashboard" : "/";
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand-block">
          <Logo compact href={readerHome} />
          <p className="footer-note">
            A calmer way to keep up.
            <br />
            Aurikrex Bytes — what matters.
          </p>
          <p className="footer-founder">
            A product of Aurikrex, founded by Korede Omotosho
          </p>
          <div className="footer-socials-wrap">
            <span className="footer-socials-label">Follow Aurikrex Bytes</span>
            <div className="footer-socials" aria-label="Aurikrex Bytes social links">
              <a
                href="https://instagram.com/falcon.omotosho"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://www.tiktok.com/@falcon.omotosho"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
              >
                <TikTokBrandIcon />
              </a>
              <a
                href="https://x.com/aurikrex"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter X"
              >
                <XBrandIcon />
              </a>
              <a
                href="https://www.linkedin.com/in/falcon-omotosho"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
              >
                <Linkedin size={16} />
              </a>
              <a
                href="https://www.facebook.com/share/1SsFXC4mZP/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <Facebook size={16} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-columns-pair">
          <div className="footer-links">
            <span>Explore</span>
            <Link href={readerHome}>Today&apos;s Bytes</Link>
            <Link href="/archive">Archive Library</Link>
            <Link href="/how-it-works">How it works</Link>
          </div>
          <div className="footer-links">
            <span>Support</span>
            <Link href="/help">Help center</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} Aurikrex Bytes.</span>{" "}
        <span className="footer-tagline">Made for the signal-seekers.</span>
      </div>
    </footer>
  );
}

function MobileBottomNav() {
  const [location] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const signedIn = Boolean(session.data);
  const isDiscover = location === "/dashboard" || location.startsWith("/post/");
  const isArchive = location.startsWith("/archive");
  const isProfile = location === "/profile";

  if (!signedIn) return null;

  return (
    <nav
      className="px-mobile-bottom-nav"
      aria-label="Mobile quick navigation"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      <Link href="/dashboard" className={"px-bottom-tab " + (isDiscover ? "active" : "")}>
        <Sparkles size={18} strokeWidth={1.9} />
        <span>Today</span>
      </Link>
      <Link href="/archive" className={"px-bottom-tab " + (isArchive ? "active" : "")}>
        <BookOpen size={18} strokeWidth={1.9} />
        <span>Archive</span>
      </Link>
      <Link href="/profile" className={"px-bottom-tab " + (isProfile ? "active" : "")}>
        <User size={18} strokeWidth={1.9} />
        <span>Profile</span>
      </Link>
    </nav>
  );
}

function PushPromptListener() {
  const [showPrompt, setShowPrompt] = useState(false);
  useEffect(() => {
    const onTrigger = () => {
      if (shouldShowPushPrompt()) {
        setShowPrompt(true);
      }
    };
    window.addEventListener("aurikrex:trigger-push-prompt", onTrigger);
    return () => window.removeEventListener("aurikrex:trigger-push-prompt", onTrigger);
  }, []);

  return <PushPromptSheet isOpen={showPrompt} onClose={() => setShowPrompt(false)} />;
}

export function PublicLayout({
  children,
  seo,
}: {
  children: ReactNode;
  seo?: ComponentProps<typeof Seo>;
}) {
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const pending = session.isLoading;
  const guest = !pending && !session.data;
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("px-no-bottom-nav", guest);
    return () => document.body.classList.remove("px-no-bottom-nav");
  }, [guest]);
  return (
    <>
      <Seo
        {...(seo || {
          title: "Aurikrex Bytes — What matters in tech",
          description:
            "A daily curated technology briefing with the context behind what matters.",
          path: "/",
        })}
      />
      <div className={`px-app-shell${guest ? " px-app-shell-topnav" : ""}${pending ? " px-app-shell-pending" : ""}`}>
        <SiteHeader />
        <div className="px-app-main">
          {children}
          <SiteFooter />
        </div>
      </div>
      <MobileBottomNav />
      <PushPromptListener />
    </>
  );
}

export function ShareButton({ post }: { post: any }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const requireSignup = () => {
    if (session.isLoading) return false;
    if (!session.data) {
      const returnTo = `/post/${post.id}`;
      rememberAuthReturnTo(returnTo);
      navigate(authSignupWithReturnTo(returnTo));
      return false;
    }
    return true;
  };
  const shareUrl = `https://www.bytes.aurikrex.com/post/${post.id}`;
  const share = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const payload: ShareData = { title: post.headline, text: post.headline, url: shareUrl };
      
      try {
        if (post.imageUrl && navigator.canShare) {
          const imageUrl = post.imageUrl.includes("res.cloudinary.com")
            ? post.imageUrl.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto,f_auto/")
            : post.imageUrl;
            
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], `post-${post.id}.jpg`, { type: blob.type || "image/jpeg" });
          
          if (navigator.canShare({ files: [file] })) {
            payload.files = [file];
          }
        }
      } catch (e) {
        console.warn("Could not attach share image:", e);
      }

      try {
        await navigator.share(payload);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") setOpen(true);
      }
      return;
    }
    setOpen(value => !value);
  };
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      else {
        const input = document.createElement("textarea");
        input.value = shareUrl;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      toast.success("Link copied");
      setOpen(false);
    } catch {
      toast.error("Copy failed — use the share link directly");
    }
  };
  return <div className="share-control" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
    <button type="button" className="engagement-button" onClick={e => { e.preventDefault(); e.stopPropagation(); if (requireSignup()) void share(); }} aria-label="Share post" title="Share post"><Share2 size={15} /></button>
    {open && <div className="share-menu" onClick={e => e.stopPropagation()}><button type="button" onClick={e => { e.preventDefault(); void copy(); }}><Check size={14} /> Copy link</button><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.headline)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">Share to X</a><a href={shareUrl} target="_blank" rel="noreferrer">Open post</a></div>}
  </div>;
}

export function FireReactionIcon({ active }: { active: boolean }) {
  const gradientId = `fire-reaction-${useId().replace(/:/g, "")}`;
  return (
    <svg className="fire-reaction-mark" viewBox="0 0 24 24" aria-hidden="true">
      {active && (
        <defs>
          <linearGradient id={gradientId} x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.5" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#f6c85f" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2.25c.32 2.14-.2 3.65-1.64 5.08-1.15 1.14-2.61 2.24-2.61 4.48 0 1.24.54 2.37 1.4 3.16-.06-1.78.73-3.17 2.17-4.38.93-.79 1.54-1.71 1.55-3.02 2.25 1.62 4.6 4.37 4.6 7.35 0 1.03-.24 1.99-.68 2.85.57-.29 1.11-.71 1.57-1.22-.16 3.89-2.86 6.53-6.36 6.53-4.1 0-6.9-2.73-6.9-6.58 0-3.3 1.9-5.72 4.01-7.81C10.68 6.98 11.51 5.13 12 2.25Z"
        fill={active ? `url(#${gradientId})` : "none"}
        stroke={active ? "none" : "currentColor"}
        strokeWidth={active ? 0 : 1.5}
        strokeLinejoin="round"
      />
      {active && (
        <path
          d="M12.2 11.35c.86 1.03 1.45 2.12 1.45 3.48 0 1.26-.63 2.27-1.66 2.93-.9-.64-1.4-1.57-1.4-2.58 0-1.45.86-2.56 1.61-3.83Z"
          fill="#fff2be"
        />
      )}
    </svg>
  );
}

export function EngagementActions({ post, onBookmark }: { post: any; onBookmark?: (saved: boolean) => void }) {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const engagement = trpc.reader.engagement.useQuery({ postId: post.id }, { enabled: Boolean(session.data), retry: false });
  const utils = trpc.useUtils();
  const reaction = trpc.reader.toggleReaction.useMutation({
    onMutate: async () => {
      await utils.reader.engagement.cancel({ postId: post.id });
      const previous = utils.reader.engagement.getData({ postId: post.id });
      utils.reader.engagement.setData({ postId: post.id }, current => {
        const next = current || { reactionCount: 0, hasReacted: false, isBookmarked: false, isRead: false };
        return { ...next, hasReacted: !next.hasReacted, reactionCount: Math.max(0, next.reactionCount + (next.hasReacted ? -1 : 1)) };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.reader.engagement.setData({ postId: post.id }, context.previous);
    },
    onSettled: () => void utils.reader.engagement.invalidate({ postId: post.id }),
  });
  const bookmark = trpc.reader.toggleBookmark.useMutation({
    onSuccess: data => {
      onBookmark?.(data.isBookmarked);
      void utils.reader.engagement.invalidate({ postId: post.id });
      void utils.reader.dashboard.invalidate();
      void utils.reader.saved.invalidate();
      if (data.isBookmarked && shouldShowPushPrompt()) {
        window.dispatchEvent(new CustomEvent("aurikrex:trigger-push-prompt"));
      }
    },
  });
  const requireLogin = () => {
    if (session.isLoading) return false;
    if (!session.data) {
      const returnTo = `/post/${post.id}`;
      rememberAuthReturnTo(returnTo);
      navigate(authSignupWithReturnTo(returnTo));
      return false;
    }
    return true;
  };
  const state = { ...post, ...(engagement.data || {}) };
  return <div className="engagement-actions" onClick={e => e.preventDefault()}>
    <button className={`engagement-button fire-button ${state.hasReacted ? "active" : ""}`} disabled={reaction.isPending} onClick={() => requireLogin() && reaction.mutate({ postId: post.id })} aria-label={state.hasReacted ? "Remove Aurikrex fire reaction" : "Send Aurikrex fire reaction"} title="Aurikrex fire reaction"><FireReactionIcon active={Boolean(state.hasReacted)} /><span>{state.reactionCount || 0}</span></button>
    <button className={`engagement-button ${state.isBookmarked ? "active" : ""}`} onClick={() => requireLogin() && bookmark.mutate({ postId: post.id })} aria-label={state.isBookmarked ? "Remove bookmark" : "Save post"} title={state.isBookmarked ? "Remove bookmark" : "Save post"}><Bookmark size={15} fill={state.isBookmarked ? "currentColor" : "none"} /></button>
    <ShareButton post={state} />
  </div>;
}

export function FeedViewModeControl({
  value,
  onChange,
}: {
  value: FeedViewMode;
  onChange: (value: FeedViewMode) => void;
}) {
  return (
    <div className="feed-view-control" role="group" aria-label="Reading view mode">
      <span className="feed-view-label">Reading view</span>
      <div className="feed-view-options">
        <button
          type="button"
          className={value === "editorial" ? "active" : ""}
          aria-pressed={value === "editorial"}
          title="Editorial view"
          onClick={() => onChange("editorial")}
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <rect x="2.5" y="2.5" width="13" height="4" rx="1" />
            <rect x="2.5" y="11.5" width="13" height="4" rx="1" />
          </svg>
          Editorial
        </button>
        <button
          type="button"
          className={value === "compact" ? "active" : ""}
          aria-pressed={value === "compact"}
          title="Compact view"
          onClick={() => onChange("compact")}
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
            <rect x="10.5" y="2.5" width="5" height="5" rx="1" />
            <rect x="2.5" y="10.5" width="5" height="5" rx="1" />
            <rect x="10.5" y="10.5" width="5" height="5" rx="1" />
          </svg>
          Compact
        </button>
      </div>
    </div>
  );
}

export function ReadingViewPreviewCard({ post, compact = false, index = 0 }: { post: any; compact?: boolean; index?: number }) {
  const previewPost = index === 0
    ? post
    : { ...post, headline: "The context behind the next important shift", body: "A second Byte preview keeps the useful detail visible without taking over the page." };
  return (
    <article className={`reading-preview-card ${compact ? "reading-preview-card-compact" : ""}`}>
      <div className="reading-preview-image">
        <img src={previewPost.imageUrl ? optimizedImage(previewPost.imageUrl, compact ? 240 : 480) : "/logo-512.png"} alt={previewPost.headline || "Aurikrex Bytes"} />
      </div>
      <div className="reading-preview-copy">
        <span className="reading-preview-meta">Today · 4 min read</span>
        <strong>{previewPost.headline}</strong>
        <span>{excerpt(previewPost.body, compact ? 68 : 108)}</span>
        <span className="reading-preview-action">Read story <ArrowRight size={11} /></span>
      </div>
      <div className="reading-preview-engagement" aria-hidden="true"><FireReactionIcon active={index === 0} /><span>{index === 0 ? "12" : "8"}</span><Bookmark size={11} /><Share2 size={11} /></div>
    </article>
  );
}

export function ReadingViewOnboarding({
  value,
  post,
  onChange,
  onContinue,
  onSkip,
}: {
  value: FeedViewMode;
  post: any;
  onChange: (value: FeedViewMode) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const options: Array<{ mode: FeedViewMode; title: string; description: string }> = [
    { mode: "editorial", title: "Editorial", description: "Best for focused reading and the full publication experience." },
    { mode: "compact", title: "Compact", description: "Best for scanning more stories quickly while keeping the useful detail." },
  ];
  return (
    <section className="reading-onboarding" aria-labelledby="reading-onboarding-title">
      <div className="reading-onboarding-intro">
        <span className="eyebrow">A better way to browse</span>
        <h2 id="reading-onboarding-title">Choose your reading view</h2>
        <p>Pick the rhythm that suits your morning on desktop or mobile. You can change it any time from the briefing header.</p>
      </div>
      <div className="reading-onboarding-options" role="radiogroup" aria-label="Reading view options">
        {options.map(option => {
          const selected = value === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              className={`reading-onboarding-option ${selected ? "selected" : ""}`}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.mode)}
            >
              <div className="reading-onboarding-option-head">
                <div><span className="reading-onboarding-option-kicker">{option.mode === "editorial" ? "One Byte at a time" : "More signal per screen"}</span><h3>{option.title}</h3></div>
                <span className="reading-onboarding-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
              </div>
              <div className={`reading-preview reading-preview-${option.mode}`}>
                <ReadingViewPreviewCard post={post} compact={option.mode === "compact"} />
                {option.mode === "compact" && <ReadingViewPreviewCard post={post} compact index={1} />}
              </div>
              <p>{option.description}</p>
            </button>
          );
        })}
      </div>
      <div className="reading-onboarding-actions">
        <button type="button" className="button" onClick={onContinue}>Continue <ArrowRight size={15} /></button>
        <button type="button" className="text-link" onClick={onSkip}>Choose later</button>
      </div>
    </section>
  );
}

export function getReadPostIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("aurikrex_read_posts");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markPostAsReadLocal(id: number) {
  if (typeof window === "undefined" || !id) return;
  try {
    const set = getReadPostIds();
    set.add(id);
    localStorage.setItem("aurikrex_read_posts", JSON.stringify(Array.from(set)));
  } catch {}
}

export function getPostMetaInfo(post: any) {
  const category = (post?.category || "Tech").trim();
  const publisher = (post?.sourcePublisher || "Aurikrex Editorial").trim();
  let domain = "bytes.aurikrex.com";
  if (post?.sourceUrl) {
    try {
      domain = new URL(post.sourceUrl).hostname.replace(/^www\./, "");
    } catch {}
  }
  const code = publisher
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || "")
    .join("") || "AB";

  return {
    topic: category,
    publisher,
    domain,
    sourceUrl: post?.sourceUrl || null,
    whyItMatters: post?.whyItMatters || null,
    isEditorPick: Boolean(post?.isEditorPick),
    sources: [
      { code, name: publisher, domain, url: post?.sourceUrl || null },
    ],
  };
}

export function PostCard({
  post,
  featured = false,
  isRead = false,
  onMarkRead,
}: {
  post: any;
  featured?: boolean;
  isRead?: boolean;
  onMarkRead?: (postId: number) => void;
}) {
  const meta = useMemo(() => getPostMetaInfo(post), [post?.category, post?.sourcePublisher, post?.sourceUrl, post?.whyItMatters, post?.isEditorPick]);
  const readFlag = Boolean(isRead || post?.isRead);

  const handleOpenPost = () => {
    markPostAsReadLocal(post.id);
    onMarkRead?.(post.id);
  };

  return (
    <article
      className={`post-card ${featured ? "post-card-featured" : ""} ${readFlag ? "is-read" : ""}`}
      data-read={readFlag ? "true" : "false"}
      data-post-id={post.id}
    >
      <ProtectedLink
        href={`/post/${post.id}`}
        className="post-card-link"
        onClick={handleOpenPost}
      >
        <div className="card-image">
          {post.imageUrl ? (
            <img
              src={optimizedImage(post.imageUrl, featured ? 900 : 600)}
              alt={post.headline}
              loading="lazy"
              decoding="async"
              onError={event => {
                event.currentTarget.src = "/logo-512.png";
                event.currentTarget.classList.add("px-brand-cover-mark");
              }}
            />
          ) : (
            <div className="image-placeholder px-brand-cover-wrap">
              <img src="/logo-512.png" alt="Aurikrex Bytes" className="px-brand-cover-mark" />
              <span>Aurikrex Bytes</span>
            </div>
          )}
        </div>
        <div className="post-card-body">
          <div className="post-meta">
            <span className="px-card-topic-pill">
              {featured || meta.isEditorPick ? `Editor's Pick · ${meta.topic}` : meta.topic}
            </span>
            <span className="post-meta-info">
              <span className="post-meta-date">{formatDate(post.publishedTime)}</span>
              <span className="post-meta-dot" aria-hidden="true">·</span>
              <span className="post-meta-readtime">{meta.publisher}</span>
              {readFlag && (
                <span className="post-card-read-badge">
                  <span className="post-meta-dot" aria-hidden="true">·</span>
                  <Check size={13} /> Read
                </span>
              )}
            </span>
          </div>
          <h2>{post.headline}</h2>
          <p><FormattedInlineText text={excerpt(meta.whyItMatters || post.body, featured ? 220 : 155)} /></p>
          <span className="read-more px-featured-cta">
            {readFlag ? "Read briefing again" : "Read full briefing"} <ArrowRight size={14} />
          </span>
        </div>
      </ProtectedLink>
      <div className="post-card-actions">
        <ProtectedLink
          href={`/post/${post.id}`}
          className="px-card-synthesis-row"
          onClick={handleOpenPost}
        >
          <div className="px-source-avatars" aria-hidden="true">
            {meta.sources.map((src, idx) => (
              <span key={idx} className={`px-source-avatar px-source-avatar-${idx}`}>{src.code}</span>
            ))}
          </div>
          <span className="px-sources-count-label">
            {meta.publisher}
          </span>
        </ProtectedLink>
        <EngagementActions post={post} />
      </div>
    </article>
  );
}

export function PublishedStoryCarousel({ featured = false }: { featured?: boolean }) {
  const archive = trpc.publicPosts.carousel.useQuery();
  const posts = useMemo(
    () =>
      [...(archive.data?.posts ?? [])].sort((a, b) => {
        const publishedTimeDifference =
          new Date(b.publishedTime ?? 0).getTime() - new Date(a.publishedTime ?? 0).getTime();
        return publishedTimeDifference || b.id - a.id;
      }).slice(0, 12),
    [archive.data?.posts],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeIndex >= posts.length && posts.length > 0) setActiveIndex(0);
  }, [activeIndex, posts.length]);

  useEffect(() => {
    if (paused || posts.length < 2) return;
    const rotation = window.setInterval(() => {
      setActiveIndex(current => {
        const candidates = posts.map((_, index) => index).filter(index => index !== current);
        return candidates[Math.floor(Math.random() * candidates.length)] ?? current;
      });
    }, 3000);
    return () => window.clearInterval(rotation);
  }, [paused, posts.length]);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const pauseForInteraction = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    setPaused(true);
  };
  const resumeAfterInteraction = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setPaused(false), 5500);
  };

  const slides = posts;

  if (!slides.length && archive.isLoading) return null;

  if (!slides.length) {
    return (
      <div className="sample-card sample-card-carousel sample-card-empty" aria-label="Latest published Bytes">
        <div className="sample-card-empty-copy">
          <span className="eyebrow">Latest published Byte</span>
          <h2>{archive.isLoading ? "Loading the latest Byte…" : "No published Bytes yet"}</h2>
          <p>The newest published story will appear here as soon as it is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`sample-card sample-card-carousel ${paused ? "is-paused" : ""}`}
      onPointerEnter={posts.length > 1 ? pauseForInteraction : undefined}
      onPointerLeave={posts.length > 1 ? resumeAfterInteraction : undefined}
      onPointerDown={posts.length > 1 ? pauseForInteraction : undefined}
      onPointerUp={posts.length > 1 ? resumeAfterInteraction : undefined}
      aria-label={posts.length > 1 ? "Latest published Bytes" : "Example Byte preview"}
    >
      <div className="sample-card-slides">
        {slides.map((post: any, index: number) => {
          const isActive = index === activeIndex;
          return (
            <div key={post.id || index} className={`sample-card-slide ${isActive ? "is-active" : ""}`} aria-hidden={!isActive}>
              <PostCard post={post} featured={featured} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getClientTimeAwareEmptyTodayState(now = new Date(), timeZone = "Africa/Lagos") {
  let hour = now.getUTCHours() + 1;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
    }).formatToParts(now);
    const h = Number(parts.find(p => p.type === "hour")?.value ?? 0) % 24;
    if (Number.isFinite(h)) hour = h;
  } catch {}

  if (hour < 8) {
    return {
      phase: "pre_drop" as const,
      eyebrow: "Morning edition incoming",
      heading: "Today’s drop lands at 8:00 AM WAT",
      body: "Our editors are finalizing today’s 5–10 stories. Catch up on yesterday’s edition in the archive while you wait.",
    };
  }
  if (hour < 18) {
    return {
      phase: "in_session" as const,
      eyebrow: "Newsroom in session",
      heading: "Today’s edition is being finished",
      body: "Today’s briefing is taking a little longer in editorial review. Yesterday’s Bytes are ready in the archive.",
    };
  }
  return {
    phase: "edition_wrap" as const,
    eyebrow: "Edition wrap",
    heading: "Yesterday’s Bytes are in the archive",
    body: "No new drop was published today. Browse recent editions in the archive — tomorrow’s briefing arrives at 8:00 AM WAT.",
  };
}

export function EmptyToday({
  emptyState,
}: {
  emptyState?: { eyebrow: string; heading: string; body: string } | null;
}) {
  const resolved = emptyState || getClientTimeAwareEmptyTodayState();
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Clock3 size={24} />
      </div>
      <span className="eyebrow">{resolved.eyebrow}</span>
      <h2>{resolved.heading}</h2>
      <p>{resolved.body}</p>
      <Link className="button button-outline" href="/archive">
        Browse the archive <ArrowRight size={15} />
      </Link>
    </div>
  );
}

export function TodayCompletionCard({
  streak = 0,
  readCount = 0,
  totalCount = 0,
  leadPostId,
  onMarkComplete,
  isCompleting = false,
}: {
  streak?: number;
  readCount?: number;
  totalCount?: number;
  leadPostId?: number;
  onMarkComplete?: () => void;
  isCompleting?: boolean;
}) {
  const isFullyRead = totalCount > 0 && readCount >= totalCount;

  useEffect(() => {
    if (isFullyRead && shouldShowPushPrompt()) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("aurikrex:trigger-push-prompt"));
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isFullyRead]);

  const handleShare = () => {
    const activeStreak = Math.max(1, streak || 1);
    const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
    const params = new URLSearchParams({
      streak: String(activeStreak),
      date: todayDate,
    });
    if (leadPostId) params.set("lead", String(leadPostId));
    const url = `https://www.bytes.aurikrex.com/share/streak?${params.toString()}`;
    const text = `I just finished today's tech briefing on Aurikrex Bytes! ${activeStreak}-day reading streak active.`;

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "Aurikrex Bytes Briefing Complete", text, url }).catch(() => undefined);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Shareable streak card link copied!");
    }
  };

  const handleFinishBriefing = () => {
    const firstUnread = document.querySelector(".post-card[data-read='false'], .post-card:not(.is-read)");
    if (firstUnread) {
      firstUnread.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      className={`today-completion-card ${isFullyRead ? "is-completed" : "is-uncompleted"}`}
      role="region"
      aria-label="Today's briefing completion status"
    >
      <div className="today-completion-art">
        <EndOfFeedIllustration isFullyRead={isFullyRead} />
      </div>

      <div className={`today-completion-badge ${isFullyRead ? "badge-completed" : "badge-uncompleted"}`}>
        {isFullyRead ? (
          <>
            <CheckCircle2 size={14} strokeWidth={2.5} />
            <span>DAILY BRIEFING COMPLETE</span>
          </>
        ) : (
          <>
            <BookOpen size={14} strokeWidth={2.5} />
            <span>{readCount} OF {totalCount} BYTES READ TODAY</span>
          </>
        )}
      </div>

      <h3 className="today-completion-title">
        {isFullyRead ? (
          <>
            Today&apos;s Bytes: <span className="today-completion-highlight">Complete.</span>
          </>
        ) : (
          <>
            Finish today&apos;s drop to <span className="today-completion-highlight">earn your streak.</span>
          </>
        )}
      </h3>

      <p className="today-completion-subtitle">
        {isFullyRead
          ? `You've completed all ${totalCount} Bytes in today's finite drop. Your daily streak is locked in.`
          : `You've read ${readCount} of ${totalCount} stories in today's drop. Read the remaining stories or mark today's briefing complete when you're done scanning.`}
      </p>

      <div className="today-completion-streak">
        <span className="streak-fire" aria-hidden="true"><Flame size={15} fill="currentColor" /></span>
        <span className="streak-divider">|</span>
        <span className="streak-text">
          {isFullyRead
            ? `${Math.max(1, streak || 1)}-Day Reading Streak`
            : `${streak || 0}-Day Streak · Complete today's drop to advance`}
        </span>
      </div>

      <div className="today-completion-actions">
        {isFullyRead ? (
          <button type="button" className="today-completion-btn-primary" onClick={handleShare}>
            <Share2 size={16} />
            <span>Share My Streak Card</span>
            <ArrowRight size={15} />
          </button>
        ) : (
          <>
            <button type="button" className="today-completion-btn-primary" onClick={handleFinishBriefing}>
              <ArrowUp size={16} />
              <span>Read Remaining ({Math.max(0, totalCount - readCount)})</span>
            </button>
            {onMarkComplete && (
              <button
                type="button"
                className="today-completion-btn-secondary"
                onClick={onMarkComplete}
                disabled={isCompleting}
              >
                <Check size={15} />
                <span>{isCompleting ? "Marking complete…" : "Mark today's briefing read"}</span>
              </button>
            )}
          </>
        )}
        <Link href="/archive" className="today-completion-btn-secondary">
          <span>Browse the archive library</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="today-completion-footer">
        <Clock3 size={14} />
        <span>Your next finite briefing arrives tomorrow at 8:00 AM WAT.</span>
      </div>
    </div>
  );
}
