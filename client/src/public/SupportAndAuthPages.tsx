import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  Mail,
  MailOpen,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { authRoutes, authTitles, type ReaderAuthMode } from "@/shared/authUi";
import Seo from "@/components/Seo";
import {
  AUTH_RETURN_KEY,
  getInitial,
  GoogleIcon,
  Logo,
  PublicLayout,
  safeReturnTo,
  ThemeToggle,
} from "./SharedLayout";

export function HowItWorks() {
  return (
    <PublicLayout
      seo={{
        title: "How Aurikrex Bytes works",
        description:
          "See how Aurikrex Bytes finds the signal, adds context, and delivers a calmer daily tech briefing.",
        path: "/how-it-works",
      }}
    >
      <main className="container support-page">
        <span className="eyebrow">A better briefing</span>
        <h1>How Bytes works</h1>
        <p className="support-intro">
          Aurikrex Bytes is a small, daily ritual for people who want the
          important parts of tech without the endless scroll.
        </p>
        {[
          [
            "01",
            "We find the signal",
            "Every morning, we scan the landscape for the stories that will shape conversations, products, and decisions.",
          ],
          [
            "02",
            "We add the context",
            "Headlines are easy. Understanding is harder. Each Byte gives you the useful background in a clear, compact read.",
          ],
          [
            "03",
            "You start clearer",
            "A few minutes, a better sense of the day, and then you can get on with the rest of it.",
          ],
        ].map(([n, h, p]) => (
          <div className="step-row" key={n}>
            <span>{n}</span>
            <div>
              <h2>{h}</h2>
              <p>{p}</p>
            </div>
          </div>
        ))}
      </main>
    </PublicLayout>
  );
}

export function HelpCenter() {
  const qs = [
    [
      "How do I create an account?",
      "Choose Sign in or Get the 8:00 AM drop, then select Create an account. Enter your email and a password of at least eight characters. We will send a verification link before you can use reader-only features.",
    ],
    [
      "How do the 8:00 AM email and push briefings work?",
      "Every morning at 8:00 AM WAT, we send today's finite edition (5–10 headlines + one-line takeaways) to opted-in readers via email and web push. You can toggle email delivery or browser push notifications independently in your Profile settings or unsubscribe with one click.",
    ],
    [
      "How do daily reading streaks work?",
      "Your streak advances when you finish reading today's finite drop on your dashboard (or mark today's briefing read). Read progress is synced to your account across all devices.",
    ],
    [
      "What is the difference between Today's Drop and the Archive Library?",
      "Today's Drop on your dashboard is strictly bounded to today's 5–10 stories so you can finish in 5 minutes. The Archive Library (/archive) is the searchable catalog of all past editions.",
    ],
    [
      "How do I search the archive?",
      "Open Archive and filter by category, source publisher, or keyword phrase.",
    ],
    [
      "I forgot my password or did not receive a verification email.",
      "Use Forgot password on the sign-in page. For a missing verification email, check spam first, then request a new message or contact support if the issue continues.",
    ],
    [
      "How do I contact support?",
      "Email support@aurikrex.com for account, editorial, or accessibility help. We aim to respond during normal business hours.",
    ],
  ];
  return (
    <PublicLayout
      seo={{
        title: "Help center — Aurikrex Bytes",
        description:
          "Answers about Aurikrex Bytes accounts, daily editions, archive search, notifications, and support.",
        path: "/help",
      }}
    >
      <main className="container article-page">
        <span className="eyebrow">Answers, quickly</span>
        <h1>Help center</h1>
        <p className="article-lede">
          Useful answers for your daily reading habit, account, and
          notifications.
        </p>
        <div className="faq-list">
          {qs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={17} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </main>
    </PublicLayout>
  );
}

export function Contact() {
  return (
    <PublicLayout
      seo={{
        title: "Contact Aurikrex Bytes",
        description:
          "Contact the Aurikrex Bytes team about account support, editorial feedback, story tips, or partnerships.",
        path: "/contact",
      }}
    >
      <main className="container support-page">
        <span className="eyebrow">We are listening</span>
        <h1>Contact us</h1>
        <p className="support-intro">
          Questions, feedback, story tips, or a kind note — send it our way.
        </p>
        <div className="contact-grid">
          <div className="contact-card">
            <Mail size={21} />
            <h2>Email the team</h2>
            <p>
              For account support, editorial feedback, or partnership enquiries.
            </p>
            <a className="inline-link" href="mailto:support@aurikrex.com">
              support@aurikrex.com <ArrowRight size={15} />
            </a>
          </div>
          <div className="contact-card">
            <ShieldCheck size={21} />
            <h2>Contact us on WhatsApp</h2>
            <p>
              Send us a message on WhatsApp and we will respond during normal business hours.
            </p>
            <a
              className="inline-link"
              href="https://wa.me/2349113683395"
              target="_blank"
              rel="noreferrer"
            >
              Message us on WhatsApp <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}

export function SupportPage({ kind }: { kind: "/privacy" | "/terms" }) {
  const privacy = kind === "/privacy";
  return (
    <PublicLayout
      seo={{
        title: `${privacy ? "Privacy policy" : "Terms of service"} — Aurikrex Bytes`,
        description: privacy
          ? "Read the Aurikrex Bytes privacy policy, including account data, cookies, analytics, and reader choices."
          : "Read the Aurikrex Bytes terms of service for using the daily technology briefing.",
        path: kind,
      }}
    >
      <main className="container article-page">
        <span className="eyebrow">Aurikrex Bytes</span>
        <h1>{privacy ? "Privacy policy" : "Terms of service"}</h1>
        <p className="article-lede">
          {privacy
            ? "A clear account of what we collect, why we use it, and the choices available to readers."
            : "The simple rules for using Aurikrex Bytes thoughtfully as a free reader service."}
        </p>
        <div className="legal-meta">
          <p>
            <strong>Effective date:</strong> 6 September 2026 ·{" "}
            <strong>Last updated:</strong> 1 November 2026
          </p>
          <p>
            <strong>Controller:</strong> Aurikrex Bytes — a product of Aurikrex, operated by Korede Samuel Omotosho ·{" "}
            <strong>Based in:</strong> Lagos, Nigeria
          </p>
          <p>
            <strong>Governing law:</strong> Federal Republic of Nigeria (Nigeria Data Protection Act 2023).
          </p>
          <p>
            Third-party service policies:{" "}
            <a href="https://cloudinary.com/privacy" rel="noreferrer">
              Cloudinary Privacy Policy
            </a>
            ,{" "}
            <a href="https://policies.google.com/privacy" rel="noreferrer">
              Google Privacy Policy
            </a>
            ,{" "}
            <a href="https://turso.tech/legal/privacy-policy" rel="noreferrer">
              Turso Privacy Policy
            </a>
            ,{" "}
            <a href="https://resend.com/legal/privacy-policy" rel="noreferrer">
              Resend Privacy Policy
            </a>
            , and{" "}
            <a href="https://onesignal.com/privacy_policy" rel="noreferrer">
              OneSignal Privacy Policy
            </a>
            .
          </p>
        </div>
        {privacy ? (
          <>
            <ArticleSection title="Information we collect">
              When you create a reader account, we collect your name, email address,
              and a securely hashed password. If you use Google OAuth or Aurikrex SSO, we
              receive the account identifier and email needed to create
              or match your reader account. We also store your story read history (`reader_post_reads`),
              bookmarks, reactions, and archive search queries so we can sync your daily
              reading streak and completion state across devices.
            </ArticleSection>
            <ArticleSection title="Lawful basis and your rights under the Nigeria Data Protection Act 2023">
              Our lawful basis for processing your personal data is consent and contract performance: you
              actively create an account and choose your delivery preferences. Under the
              Nigeria Data Protection Act 2023, you may access the personal data
              we hold about you, request correction of inaccurate data, request
              deletion of your account and data, and object to or opt out of morning email or push
              deliveries at any time. If you believe your rights have been violated, you may
              lodge a complaint with the Nigeria Data Protection Commission
              (NDPC).
            </ArticleSection>
            <ArticleSection title="Cookies and storage">
              We use essential first-party session cookies to keep you signed in, remember
              administrative devices, and protect OAuth flows. Local storage may
              remember your light or dark mode and reading layout preferences. You can clear cookies
              through your browser, although doing so may sign you out.
            </ArticleSection>
            <ArticleSection title="How we use information">
              We use information to authenticate accounts, send verification and
              password-reset emails, deliver the optional 8:00 AM WAT morning email briefing
              and web push notifications, sync your daily reading streak across devices, and
              power Falke AI follow-up threads. We do not sell reader information or use reading history for
              third-party advertising.
            </ArticleSection>
            <ArticleSection title="Service providers">
              The service uses Turso (libSQL) for application data storage, Cloudinary
              for post and profile imagery, Google OAuth for optional sign-in, Resend / SMTP
              for transactional and morning digest email delivery, OneSignal for optional web push
              notifications, and Mistral AI / NVIDIA NIM / Cloudflare Workers AI / Tavily for editorial synthesis
              and Falke AI follow-ups. Each provider receives only the information needed for its function.
            </ArticleSection>
            <ArticleSection title="Retention and data requests">
              We retain account and reading progress data for as long as your account is
              active. You can unsubscribe from the 8:00 AM email briefing at any time using the one-click
              unsubscribe link in any email or from your Profile page. Send access, correction, or
              account deletion requests to support@aurikrex.com.
            </ArticleSection>
            <ArticleSection title="Contact">
              For privacy questions or requests, contact support@aurikrex.com.
              This policy applies to the Aurikrex Bytes reader experience
              and may be updated as the service evolves.
            </ArticleSection>
          </>
        ) : (
          <>
            <ArticleSection title="The service">
              Aurikrex Bytes is a free reader briefing that curates and edits
              technology stories into finite daily editions (Today&apos;s Drop) and a searchable
              past-editions library (Archive). The service may
              change, pause, or add features as we improve it.
            </ArticleSection>
            <ArticleSection title="Accounts and responsibilities">
              Keep your sign-in details secure, provide accurate information,
              and do not share access in a way that compromises the service or
              other readers. You must be at least 13 years old to create an
              account.
            </ArticleSection>
            <ArticleSection title="Content, provenance, and Falke AI threads">
              Our curation system and editorial desk compile source material from verified technology publications
              and link directly to primary source provenance. Falke AI follow-up threads (bounded to 4 turns per story)
              synthesize story context and live web search results; AI-generated answers are provided for informational
              context and should be verified against primary sources for critical decisions.
              Original Aurikrex Bytes writing, edits, design, branding, and
              software belong to Aurikrex or their licensors.
            </ArticleSection>
            <ArticleSection title="Acceptable use">
              Do not scrape or overload the service, abuse Falke AI endpoints, interfere with accounts,
              impersonate others, reverse engineer protected systems, submit
              malicious material, or use the platform for unlawful activity. We
              may suspend or terminate access for abuse, fraud, security risk,
              or serious violations.
            </ArticleSection>
            <ArticleSection title="Disclaimer and governing terms">
              Bytes is provided for general information and technical context, not
              financial, legal, medical, or investment advice. We work to keep
              stories accurate and current but cannot guarantee that every card
              is complete or error-free. To the extent permitted by law,
              Aurikrex is not liable for decisions made solely from a Byte.
              Questions about these terms can be sent to support@aurikrex.com.
            </ArticleSection>
          </>
        )}
      </main>
    </PublicLayout>
  );
}

function ArticleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="article-section">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

export function ReaderAuth({ mode }: { mode: ReaderAuthMode }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") || ""
  );
  const [returnTo] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("returnTo");
    const fromStorage = window.sessionStorage.getItem(AUTH_RETURN_KEY);
    return safeReturnTo(fromUrl || fromStorage);
  });
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).get("error") === "oauth"
      ? "Google sign-in failed. Please try again."
      : ""
  );
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationState, setVerificationState] = useState<
    "idle" | "verified" | "already_verified" | "error"
  >("idle");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarSignature = trpc.reader.avatarUploadSignature.useQuery(undefined, {
    enabled: mode === "signup",
    staleTime: 60_000,
  });

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setAvatarUploading(true);
      const sig = avatarSignature.data || (await utils.reader.avatarUploadSignature.fetch());
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

      setAvatarUrl(result.secure_url);
      setAvatarPreview(result.secure_url);
    } catch (err: any) {
      console.error("[SignupAvatar] Upload error:", err);
      const rawMsg = err?.message || "";
      const userMessage =
        rawMsg &&
        !rawMsg.includes("[{") &&
        !rawMsg.includes("Invalid avatar URL") &&
        !rawMsg.includes("TRPCClientError")
          ? rawMsg
          : "Couldn't upload photo, try again";
      toast.error(userMessage);
    } finally {
      setAvatarUploading(false);
    }
  };
  const google = trpc.reader.googleStart.useQuery(undefined, {
    enabled: mode === "login" || mode === "signup",
    retry: false,
  });
  const requirements = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One symbol", valid: /[^A-Za-z0-9]/.test(password) },
  ];
  const login = trpc.reader.login.useMutation({
    onSuccess: async r => {
      await utils.reader.session.invalidate();
      if (r.emailVerified) {
        window.sessionStorage.removeItem(AUTH_RETURN_KEY);
        navigate(returnTo);
      }
      else setMessage("Please verify your email before accessing all stories.");
    },
    onError: e => setMessage(e.message),
  });
  const signup = trpc.reader.signup.useMutation({
    onSuccess: r => {
      setVerificationEmail(r.email);
      setMessage("");
    },
    onError: e => {
      const rawMsg = e.message || "";
      if (rawMsg.includes("[{") || rawMsg.includes("Invalid avatar URL")) {
        setMessage("Invalid photo or upload failed. Please try again.");
      } else {
        setMessage(rawMsg);
      }
    },
  });
  const forgot = trpc.reader.requestPasswordReset.useMutation({
    onSuccess: () =>
      setMessage("If that address exists, a reset link is on its way."),
  });
  const reset = trpc.reader.resetPassword.useMutation({
    onSuccess: () => {
      setMessage("Password updated. You can sign in now.");
      navigate("/login");
    },
    onError: e => setMessage(e.message),
  });
  const verify = trpc.reader.verifyEmail.useMutation({
    onSuccess: r => setVerificationState(r.status),
    onError: () => setVerificationState("error"),
  });
  const resend = trpc.reader.resendVerificationEmail.useMutation({
    onSuccess: () => setMessage("A fresh verification email is on its way."),
    onError: e => setMessage(e.message),
  });
  useEffect(() => {
    if (mode === "verify" && token && verificationState === "idle" && !verify.isPending)
      verify.mutate({ token });
  }, [mode, token, verificationState, verify.isPending]);
  useEffect(() => {
    if (mode !== "verify" || !["verified", "already_verified"].includes(verificationState)) return;
    const timer = window.setTimeout(() => navigate(authRoutes.login), 1800);
    return () => window.clearTimeout(timer);
  }, [mode, navigate, verificationState]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") login.mutate({ email, password, remember: true });
    if (mode === "signup") {
      if (avatarUploading) {
        setMessage("Please wait for your photo to finish uploading.");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
      signup.mutate({ name, email, password, avatarUrl: avatarUrl || undefined });
    }
    if (mode === "forgot") forgot.mutate({ email });
    if (mode === "reset") {
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
      reset.mutate({ token, password });
    }
  };
  const copy =
    mode === "signup"
      ? "Get the 8:00 AM WAT edition in your inbox and reading desk."
      : mode === "forgot"
        ? "We’ll send a secure link if we find an account for that email."
        : "Your daily briefing, waiting when you are.";
  const authPath =
    mode === "login"
      ? authRoutes.login
      : mode === "signup"
        ? authRoutes.signup
        : mode === "forgot"
          ? authRoutes.forgotPassword
          : mode === "reset"
            ? authRoutes.resetPassword
            : authRoutes.verifyEmail;
  const authLink = (path: string) =>
    returnTo === "/dashboard"
      ? path
      : `${path}?returnTo=${encodeURIComponent(returnTo)}`;
  const verifyView =
    mode === "verify" && verificationState === "idle" ? (
      <div className="verification-state">
        <div className="verification-icon verification-envelope">
          <MailOpen size={30} />
        </div>
        <h2>Confirm your email</h2>
        <p className="auth-lede">
          You’re one click away from your daily Aurikrex Bytes briefing.
        </p>
        <button
          className="button button-full"
          onClick={() => verify.mutate({ token })}
          disabled={!token || verify.isPending}
        >
          {verify.isPending ? "Verifying…" : "Verify email"} <Check size={16} />
        </button>
      </div>
    ) : verificationState === "verified" ? (
      <div className="verification-state verification-success">
        <div className="verification-icon">
          <Check size={30} />
        </div>
        <h2>Email verified</h2>
        <p className="auth-lede">
          Your Aurikrex Bytes account is ready. You can sign in and start your
          daily briefing. Redirecting you to login…
        </p>
        <Link className="button button-full" href={authRoutes.login}>
          Proceed to login <ArrowRight size={16} />
        </Link>
      </div>
    ) : verificationState === "already_verified" ? (
      <div className="verification-state">
        <div className="verification-icon">
          <Check size={30} />
        </div>
        <h2>This email is already verified</h2>
        <p className="auth-lede">
          This link has already done its job. Redirecting you to login…
        </p>
        <Link className="button button-full" href={authRoutes.login}>
          Go to login <ArrowRight size={16} />
        </Link>
      </div>
    ) : verificationState === "error" ? (
      <div className="verification-state">
        <div className="verification-icon verification-icon-error">
          <X size={30} />
        </div>
        <h2>That link needs a refresh</h2>
        <p className="auth-lede">
          This verification link is invalid or has expired. Request a new one
          and we’ll get you back on track.
        </p>
        <label>
          Email address
          <input
            type="email"
            value={verificationEmail || email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button
          className="button button-full"
          onClick={() => resend.mutate({ email: verificationEmail || email })}
          disabled={!email && !verificationEmail}
        >
          Resend verification email <Mail size={16} />
        </button>
      </div>
    ) : (
      <div className="verification-state">
        <div className="verification-icon verification-envelope">
          <MailOpen size={30} />
        </div>
        <h2>Check your inbox</h2>
        <p className="auth-lede">
          We sent a verification email to{" "}
          <strong>{verificationEmail || "your email address"}</strong>. Click
          the link inside to confirm your account.
        </p>
        <button
          className="button button-outline button-full"
          onClick={() => resend.mutate({ email: verificationEmail || email })}
        >
          Resend email <Mail size={16} />
        </button>
        <p className="verification-hint">
          Can’t find it? Check your spam or promotions folder.
        </p>
      </div>
    );
  return (
    <>
      <Seo
        title={
          (verificationEmail ? "Check your inbox" : authTitles[mode]) +
          " — Aurikrex Bytes"
        }
        description="Sign in or create an Aurikrex Bytes reader account for a calmer daily technology briefing."
        path={authPath}
        robots="noindex,nofollow"
      />
      <div className="auth-shell">
        <div className="auth-side">
          <Logo />
          <div className="px-auth-side-hero">
            <span className="eyebrow">A considered daily read</span>
            <h1>
              Your briefing,
              <br />
              <em>waiting for you.</em>
            </h1>
            <p>
              Five to ten stories at 8:00 AM WAT. Better context. A calmer start to the day.
            </p>
            <div className="px-auth-feature-list">
              <div className="px-auth-feature-item">
                <div className="px-auth-feature-icon"><Clock3 size={16} /></div>
                <div>
                  <strong>8:00 AM WAT Daily Drop</strong>
                  <span>Receive 5–10 finite stories via morning email digest &amp; web push.</span>
                </div>
              </div>
              <div className="px-auth-feature-item">
                <div className="px-auth-feature-icon"><Sparkles size={16} /></div>
                <div>
                  <strong>Pinned Falke AI Threads</strong>
                  <span>Ask 2–4 grounded follow-up questions anchored directly to each story.</span>
                </div>
              </div>
              <div className="px-auth-feature-item">
                <div className="px-auth-feature-icon"><Bookmark size={16} /></div>
                <div>
                  <strong>True Reading Streaks</strong>
                  <span>Finish today&apos;s finite edition to earn your streak across devices.</span>
                </div>
              </div>
            </div>
          </div>
          <span className="auth-quote">“A little signal goes a long way.”</span>
        </div>
        <div className="auth-main">
          <div className="auth-top">
            <Logo compact />
            <div className="auth-top-actions">
              <ThemeToggle />
              <button className="text-button" onClick={() => navigate("/")}>
                Back home
              </button>
            </div>
          </div>
          <div className="auth-panel">
            {verificationEmail && mode === "signup" ? (
              verifyView
            ) : mode === "verify" ? (
              <>
                {verifyView}
                {!verificationState && (
                  <button
                    className="text-button verification-back"
                    onClick={() => navigate(authRoutes.login)}
                  >
                    Back to login
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="eyebrow">Aurikrex Bytes</span>
                <h2>{authTitles[mode]}</h2>
                <p className="auth-lede">{copy}</p>
                <form onSubmit={submit}>
                  {mode === "signup" && (
                    <>
                      <div className="signup-avatar-field">
                        <label className="signup-avatar-label">Profile photo (optional)</label>
                        <div className="signup-avatar-row">
                          <div className="signup-avatar-preview">
                            {avatarPreview ? (
                              <img src={avatarPreview} alt="Preview" />
                            ) : (
                              <span>{getInitial(name || email || "U")}</span>
                            )}
                          </div>
                          <label
                            className="button button-small button-outline signup-avatar-upload-btn"
                            style={{
                              pointerEvents: avatarUploading ? "none" : undefined,
                              opacity: avatarUploading ? 0.7 : 1,
                            }}
                          >
                            {avatarUploading ? (
                              <>
                                <Loader2 size={14} className="animate-spin" /> Uploading...
                              </>
                            ) : (
                              <>
                                <Camera size={14} /> {avatarPreview ? "Change photo" : "Upload photo"}
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleAvatarFileChange}
                              style={{ display: "none" }}
                              disabled={avatarUploading}
                            />
                          </label>
                          {avatarPreview && (
                            <button
                              type="button"
                              className="text-button text-button-muted"
                              style={{ fontSize: "12px" }}
                              onClick={() => {
                                setAvatarUrl("");
                                setAvatarPreview("");
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <label>
                        Full name
                        <input
                          value={name}
                          onChange={e => setName(e.target.value)}
                          required
                        />
                      </label>
                    </>
                  )}
                  {mode !== "reset" && (
                    <label>
                      Email address
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                      />
                    </label>
                  )}
                  {mode !== "forgot" && (
                    <>
                      <label>
                        Password
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="At least 8 characters, a number and symbol"
                        />
                      </label>
                      {mode === "login" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-6px", marginBottom: "16px" }}>
                          <Link className="text-link" style={{ fontSize: "13px" }} href={authRoutes.forgotPassword}>
                            Forgot password?
                          </Link>
                        </div>
                      )}
                      {(mode === "signup" || mode === "reset") && (
                        <>
                          <ul
                            className="password-requirements"
                            aria-label="Password requirements"
                          >
                            {requirements.map(item => (
                              <li
                                key={item.label}
                                className={item.valid ? "valid" : ""}
                              >
                                <Check size={14} />
                                {item.label}
                              </li>
                            ))}
                          </ul>
                          <label>
                            Confirm password
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              required
                              minLength={8}
                            />
                          </label>
                        </>
                      )}
                    </>
                  )}
                  <button
                    className="button button-full"
                    type="submit"
                    disabled={avatarUploading || signup.isPending || login.isPending || forgot.isPending || reset.isPending}
                  >
                    {mode === "signup"
                      ? "Get the 8:00 AM drop"
                      : mode === "forgot"
                        ? "Send reset link"
                        : mode === "reset"
                          ? "Update password"
                          : "Sign in"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </form>
                {(mode === "login" || mode === "signup") && (
                  <>
                    <div className="auth-divider">
                      <span>or continue with</span>
                    </div>
                    <a
                      className={`google-button ${google.isLoading ? "is-loading" : ""}`}
                      href={google.data?.url}
                      aria-disabled={!google.data?.url}
                      onClick={event => {
                        if (!google.data?.url) event.preventDefault();
                      }}
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </a>
                    <div className="auth-links">
                      {mode === "login" ? (
                        <Link href={authLink(authRoutes.signup)}>Create an account</Link>
                      ) : (
                        <Link href={authLink(authRoutes.login)}>
                          Already a reader? Sign in
                        </Link>
                      )}
                    </div>
                  </>
                )}
                <p className="form-message" role="status">
                  {message}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
