import { FormEvent, ReactNode, useEffect, useState, type ComponentProps } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Facebook,
  Flame,
  Instagram,
  Linkedin,
  LogOut,
  Mail,
  MailOpen,
  Moon,
  Music2,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Twitter,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { authRoutes, authTitles, type ReaderAuthMode } from "@/shared/authUi";
import Seo from "@/components/Seo";

const formatDate = (value?: string | Date | number | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Today";
const excerpt = (text: string, length = 150) =>
  text.length > length ? `${text.slice(0, length).trim()}…` : text;
const optimizedImage = (url: string, width: number) =>
  url.includes("res.cloudinary.com") &&
  url.includes("/upload/") &&
  !url.includes("f_auto")
    ? url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`)
    : url;
export function Logo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="Aurikrex Bytes home"
    >
      <img src="/logo.svg" alt="Aurikrex Bytes logo" />
      <span>
        Aurikrex <b>Bytes</b>
      </span>
    </Link>
  );
}
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="icon-button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title="Toggle theme"
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
export function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => navigate("/") });
  const signedIn = Boolean(session.data);
  const homePath = signedIn ? "/dashboard" : "/";
  return (
    <header className="site-header">
      <Logo href={homePath} />
      <nav className="main-nav" aria-label="Primary">
        <Link href={homePath}>{signedIn ? "Dashboard" : "Today"}</Link>
        <Link href="/archive">All Bytes</Link>
        <Link href="/how-it-works">About</Link>
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        {signedIn ? (
          <button className="header-login text-button" onClick={() => logout.mutate()}>
            <LogOut size={14} /> Sign out
          </button>
        ) : (
          <>
            <Link className="header-login" href={authRoutes.login}>Sign in</Link>
            <Link className="button button-small" href={authRoutes.signup}>Join free <ArrowRight size={14} /></Link>
          </>
        )}
        <button
          className="mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-label="Toggle navigation"
          aria-expanded={menu}
        >
          {menu ? <X /> : <span>Menu</span>}
        </button>
      </div>
      {menu && (
        <nav className="mobile-nav">
          <Link href={homePath}>{signedIn ? "Dashboard" : "Today"}</Link>
          <Link href="/archive">All Bytes</Link>
          <Link href="/how-it-works">About</Link>
          {signedIn ? <button className="mobile-nav-join text-button" onClick={() => logout.mutate()}>Sign out</button> : <><Link href={authRoutes.login}>Sign in</Link><Link className="mobile-nav-join" href={authRoutes.signup}>Join free <ArrowRight size={14} /></Link></>}
        </nav>
      )}
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand-block">
          <Logo compact />
          <p className="footer-note">
            A calmer way to keep up.
            <br />
            Aurikrex Bytes — what matters.
          </p>
          <p className="footer-founder">
            A product of Aurikrex, founded by Korede Omotosho
          </p>
          <div className="footer-socials">
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
              <Music2 size={16} />
            </a>
            <a
              href="https://x.com/aurikrex"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter X"
            >
              <Twitter size={16} />
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
        <div className="footer-links">
          <span>Explore</span>
          <Link href="/">Today's Bytes</Link>
          <Link href="/archive">All Bytes</Link>
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
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Aurikrex Bytes</span>
        <span>Made for the signal-seekers.</span>
      </div>
    </footer>
  );
}
export function PublicLayout({
  children,
  seo,
}: {
  children: ReactNode;
  seo?: ComponentProps<typeof Seo>;
}) {
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
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
function PostCard({
  post,
  featured = false,
}: {
  post: any;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/post/${post.id}`}
      className={`post-card ${featured ? "post-card-featured" : ""}`}
    >
      <div className="card-image">
        {post.imageUrl ? (
          <img
            src={optimizedImage(post.imageUrl, featured ? 900 : 600)}
            alt={post.headline}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="image-placeholder">
            <Sparkles size={22} />
            <span>Bytes / {String(post.id).padStart(2, "0")}</span>
          </div>
        )}
      </div>
      <div className="post-card-body">
        <div className="post-meta">
          <span>{formatDate(post.publishedTime)}</span>
          <span>·</span>
          <span>4 min read</span>
        </div>
        <h2>{post.headline}</h2>
        <p>{excerpt(post.body)}</p>
        <span className="read-more">
          Read story <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}
function EmptyToday() {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Clock3 size={24} />
      </div>
      <span className="eyebrow">The next edition is in progress</span>
      <h2>Next drop at 8:00 AM</h2>
      <p>Come back in the morning for the stories worth your attention.</p>
      <Link className="button button-outline" href="/archive">
        Browse the archive <ArrowRight size={15} />
      </Link>
    </div>
  );
}
export function Home() {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  useEffect(() => {
    if (session.data) navigate("/dashboard");
  }, [navigate, session.data]);
  const today = trpc.publicPosts.today.useQuery();
  const posts = today.data ?? [];
  return (
    <PublicLayout>
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" />
              The daily tech briefing
            </span>
            <h1>
              Aurikrex Bytes —<br />
              <em>what matters.</em>
            </h1>
            <p>
              Five to ten considered technology stories, curated and edited for
              a better start to your day. A useful daily ritual, delivered at
              8:00 AM.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/signup">
                Start reading free <ArrowRight size={16} />
              </Link>
              <Link className="text-link" href="/how-it-works">
                How it works <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="hero-note">
            <span>08:00</span>
            <strong>Every morning</strong>
            <p>
              One calm drop. The context behind what is changing. No endless
              scroll required.
            </p>
          </div>
        </section>
        <section className="section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">The format</span>
              <h2>Three steps to better context.</h2>
            </div>
          </div>
          <div className="steps-grid">
            <div>
              <span>01</span>
              <h3>Daily curation</h3>
              <p>
                We read widely and select the stories that will shape the day
                ahead.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>8 AM drop</h3>
              <p>
                Our edited briefing arrives as a focused set of branded story
                cards.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>Read your way</h3>
              <p>
                Browse Today's Bytes or search the complete archive whenever you
                need it.
              </p>
            </div>
          </div>
        </section>
        <section className="section container sample-section">
          <div className="sample-copy">
            <span className="eyebrow">A Byte, up close</span>
            <h2>News you can actually use.</h2>
            <p>
              Each card gives you a clear headline, the useful context behind
              it, and a few quiet minutes to understand what matters.
            </p>
            <Link className="text-link" href="/archive">
              See the archive <ArrowRight size={15} />
            </Link>
          </div>
          <div className="sample-card">
            <div className="sample-card-image">
              <Sparkles size={22} />
              <span>Bytes / 08</span>
            </div>
            <div>
              <span className="sample-badge">Example story</span>
              <span className="post-meta">Today · 4 min read</span>
              <h3>The quiet shift changing how teams build with AI</h3>
              <p>
                A considered look at the tools, habits, and decisions shaping
                the next chapter of work.
              </p>
              <span className="read-more">
                Read story <ArrowRight size={15} />
              </span>
            </div>
          </div>
        </section>
        <section className="section why-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Why Bytes</span>
                <h2>Less noise. More signal.</h2>
              </div>
            </div>
            <div className="why-grid">
              <div>
                <h3>Edited by a person</h3>
                <p>
                  Not an algorithmic firehose. A real editorial choice about
                  what deserves your attention.
                </p>
              </div>
              <div>
                <h3>A daily ritual</h3>
                <p>
                  Five to ten stories at 8:00 AM, so staying informed has a
                  beginning and an end.
                </p>
              </div>
              <div>
                <h3>Built to return to</h3>
                <p>
                  A searchable archive that makes the useful stories easy to
                  find again.
                </p>
              </div>
            </div>
            <Link className="button" href="/signup">
              Join Aurikrex Bytes <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="manifesto">
          <div className="container manifesto-inner">
            <Sparkles size={24} />
            <div>
              <span className="eyebrow">The Bytes promise</span>
              <h2>Make room for what matters.</h2>
              <p>
                Start tomorrow’s briefing with a free reader account, or explore
                the archive first.
              </p>
            </div>
            <Link className="button" href="/signup">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
export function ReaderDashboard() {
  const [, navigate] = useLocation();
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const [tab, setTab] = useState<"today" | "all">("today");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const dashboard = trpc.reader.dashboard.useQuery(
    { timeZone },
    { enabled: Boolean(session.data), retry: false }
  );
  useEffect(() => {
    if (!session.isLoading && !session.data) navigate("/login");
  }, [navigate, session.data, session.isLoading]);
  if (session.isLoading || (!session.data && !dashboard.error))
    return <div className="route-loading">Opening your briefing…</div>;
  const data = dashboard.data;
  const posts = tab === "today" ? data?.todayPosts ?? [] : data?.allPosts ?? [];
  const firstName = data?.reader.name?.trim().split(/\s+/)[0] || "reader";
  return (
    <PublicLayout seo={{ title: "Your dashboard — Aurikrex Bytes", description: "Your daily Aurikrex Bytes briefing and reading streak.", path: "/dashboard", robots: "noindex,nofollow" }}>
      <main className="container reader-dashboard">
        <section className="dashboard-intro">
          <div>
            <span className="eyebrow"><span className="live-dot" /> Your reading desk</span>
            <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}.</h1>
            <p>Here’s the signal worth your attention today.</p>
          </div>
          <div className={`streak-card ${data?.streak.increased ? "streak-card-celebrate" : ""}`}>
            <div className="streak-flame"><Flame size={25} fill="currentColor" /></div>
            <div><strong>{data?.streak.currentStreak ?? 0}</strong><span>day streak</span></div>
            <small>Best: {data?.streak.longestStreak ?? 0} days</small>
          </div>
        </section>
        <section className="dashboard-feed">
          <div className="section-heading dashboard-heading">
            <div><span className="eyebrow">Your briefing</span><h2>{tab === "today" ? "Today’s Bytes" : "All Bytes"}</h2></div>
            <div className="reader-tabs" role="tablist" aria-label="Reader feed">
              <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
              <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All Bytes</button>
            </div>
          </div>
          {dashboard.isLoading ? <div className="skeleton-grid"><div /><div /><div /></div> : posts.length ? <div className="post-grid">{posts.map((post: any, index: number) => <PostCard key={post.id} post={post} featured={tab === "today" && index === 0} />)}</div> : <EmptyToday />}
        </section>
      </main>
    </PublicLayout>
  );
}
export function Archive() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const archive = trpc.publicPosts.archive.useQuery({
    query,
    page,
    pageSize: 12,
  });
  return (
    <PublicLayout
      seo={{
        title: "All Bytes — Aurikrex Bytes archive",
        description:
          "Search every considered Aurikrex Bytes technology story, with useful context ready when you are.",
        path: page > 1 ? `/archive?page=${page}` : "/archive",
        prev: page > 1 ? `/archive?page=${page - 1}` : null,
        next: archive.data?.nextPage
          ? `/archive?page=${archive.data.nextPage}`
          : null,
      }}
    >
      <main className="container page-main">
        <div className="page-intro">
          <span className="eyebrow">The complete record</span>
          <h1>All Bytes</h1>
          <p>Every story, thoughtfully selected and ready when you are.</p>
        </div>
        <div className="search-wrap">
          <Search size={18} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search headlines and stories"
            aria-label="Search the archive"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        {archive.isLoading ? (
          <div className="skeleton-grid">
            <div />
            <div />
            <div />
          </div>
        ) : archive.data?.posts?.length ? (
          <>
            <div className="post-grid archive-grid">
              {archive.data?.posts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <div className="pagination">
              <button
                className="button button-outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="button button-outline"
                disabled={archive.data.nextPage === null}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Search size={24} />
            <h2>No stories found</h2>
            <p>Try a different phrase or browse the latest drop.</p>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
export function PostDetail() {
  const [, params] = useRoute("/post/:id");
  const id = Number(params?.id);
  const post = trpc.publicPosts.byId.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );
  const seo = post.data
    ? {
        title: `${post.data.headline} — Aurikrex Bytes`,
        description: excerpt(post.data.body, 160),
        path: `/post/${post.data.id}`,
        image: post.data.imageUrl || "/logo-512.png",
        type: "article" as const,
        article: {
          headline: post.data.headline,
          datePublished: post.data.publishedTime,
          image: post.data.imageUrl,
        },
      }
    : {
        title: "Story — Aurikrex Bytes",
        description:
          "Read the latest considered technology story from Aurikrex Bytes.",
        path: `/post/${Number.isFinite(id) ? id : ""}`,
      };
  return (
    <PublicLayout seo={seo}>
      <main className="container detail-page">
        {post.isLoading ? (
          <div className="detail-loading" />
        ) : post.data ? (
          <article>
            <Link className="back-link" href="/archive">
              ← Back to all bytes
            </Link>
            <div className="detail-meta">
              <span className="eyebrow">Aurikrex Bytes</span>
              <span>{formatDate(post.data.publishedTime)} · 4 min read</span>
            </div>
            <h1>{post.data.headline}</h1>
            {post.data.imageUrl && (
              <img
                className="detail-image"
                src={optimizedImage(post.data.imageUrl, 1400)}
                alt={post.data.headline}
                loading="eager"
                fetchPriority="high"
              />
            )}
            <div className="detail-body">
              {post.data.body
                .split(/\n+/)
                .map((paragraph: string, i: number) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <h2>Story not found</h2>
            <Link className="text-link" href="/archive">
              Back to the archive <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
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
      "Choose Sign in or Join free, then select Create an account. Enter your email and a password of at least eight characters. We will send a verification link before you can use reader-only features.",
    ],
    [
      "How do push notifications work?",
      "If notifications are enabled on your installed PWA or browser, we can alert you when the 8:00 AM edition is ready. You control permission in your device or browser settings, and you can turn notifications off at any time.",
    ],
    [
      "What is the difference between Today's Bytes and All Bytes?",
      "Today's Bytes is the current daily drop and resets after midnight until the next 8:00 AM edition. All Bytes is the searchable, reverse-chronological archive of every published story.",
    ],
    [
      "How do I search the archive?",
      "Open All Bytes and enter a phrase from a headline or story body. Search results are paginated, and you can move between pages without losing your query.",
    ],
    [
      "I forgot my password or did not receive a verification email.",
      "Use Forgot password on the sign-in page. For a missing verification email, check spam first, then request a new message or contact support if the issue continues.",
    ],
    [
      "How do I report an incorrect or outdated story?",
      "Email info@aurikrex.tech with the story link and the correction you believe is needed. Include a source where possible so the editorial team can review it quickly.",
    ],
    [
      "How do I contact support?",
      "Email info@aurikrex.tech for account, editorial, or accessibility help. We aim to respond during normal business hours.",
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
            <a className="inline-link" href="mailto:info@aurikrex.tech">
              info@aurikrex.tech <ArrowRight size={15} />
            </a>
          </div>
          <div className="contact-card">
            <ShieldCheck size={21} />
            <h2>Prefer a call?</h2>
            <p>
              Our support line is available during business hours in Nigeria.
            </p>
            <a className="inline-link" href="tel:+2349113683395">
              +234 911 368 3395 <ArrowRight size={15} />
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
            <strong>Last updated:</strong> 6 September 2026
          </p>
          <p>
            <strong>Controller:</strong> Aurikrex, operated by Korede Omotosho ·{" "}
            <strong>Address:</strong> United Kingdom
          </p>
          <p>
            <strong>Governing law:</strong> England and Wales.
          </p>
          <p>
            Third-party policies:{" "}
            <a href="https://cloudinary.com/privacy" rel="noreferrer">
              Cloudinary Privacy Policy
            </a>
            ,{" "}
            <a href="https://policies.google.com/privacy" rel="noreferrer">
              Google Privacy Policy
            </a>
            , and{" "}
            <a href="https://turso.tech/legal/privacy-policy" rel="noreferrer">
              Turso Privacy Policy
            </a>
            .
          </p>
        </div>
        {privacy ? (
          <>
            <ArticleSection title="Information we collect">
              When you create a reader account, we collect your email address
              and a securely hashed password. If you use Google OAuth, we
              receive the Google account identifier and email needed to create
              or match your reader account. We also collect usage and analytics
              data such as stories opened, archive searches, and timestamps so
              we can understand which parts of the briefing are useful.
            </ArticleSection>
            <ArticleSection title="Cookies and storage">
              We use essential session cookies to keep you signed in, remember
              administrative devices, and protect OAuth flows. Local storage may
              remember your light or dark mode preference. You can clear cookies
              through your browser, although doing so may sign you out.
            </ArticleSection>
            <ArticleSection title="How we use information">
              We use information to authenticate accounts, send verification and
              password-reset emails, provide the daily briefing, measure
              readership, protect the service, and improve editorial decisions.
              We do not sell reader information or use reading history for
              unrelated advertising.
            </ArticleSection>
            <ArticleSection title="Service providers">
              The service may use Turso for application data storage, Cloudinary
              for post imagery, Google OAuth for optional sign-in, email
              delivery providers for account messages, and browser/PWA
              notification services where a reader grants permission. Each
              provider receives only the information needed for its function.
            </ArticleSection>
            <ArticleSection title="Retention and your rights">
              We retain account and activity data while it is needed to operate
              and protect the service. You may request account deletion, a
              copy/export of account information, or correction of inaccurate
              information by emailing info@aurikrex.tech. We will verify
              requests before acting on them and explain any information we must
              retain for security or legal reasons.
            </ArticleSection>
            <ArticleSection title="Contact">
              For privacy questions or requests, contact info@aurikrex.tech.
              This policy applies to the free Aurikrex Bytes reader experience
              and may be updated as the service changes.
            </ArticleSection>
          </>
        ) : (
          <>
            <ArticleSection title="The service">
              Aurikrex Bytes is a free reader briefing that curates and edits
              technology stories into daily cards. Today's Bytes is the current
              edition; All Bytes is the searchable archive. The service may
              change, pause, or add features as we improve it.
            </ArticleSection>
            <ArticleSection title="Accounts and responsibilities">
              Keep your sign-in details secure, provide accurate information,
              and do not share access in a way that compromises the service or
              other readers. You must be at least 13 years old to create an
              account.
            </ArticleSection>
            <ArticleSection title="Content and attribution">
              Aurikrex Bytes writes, edits, curates, and presents editorial
              cards using information from public reporting and other sources.
              Original Aurikrex Bytes writing, edits, design, branding, and
              software belong to Aurikrex or their licensors. You may read and
              share links, but do not reproduce the service wholesale or present
              our edits as your own.
            </ArticleSection>
            <ArticleSection title="Acceptable use">
              Do not scrape or overload the service, interfere with accounts,
              impersonate others, reverse engineer protected systems, submit
              malicious material, or use the platform for unlawful activity. We
              may suspend or terminate access for abuse, fraud, security risk,
              or serious violations.
            </ArticleSection>
            <ArticleSection title="Disclaimer and governing terms">
              Bytes is provided for general information and context, not
              financial, legal, medical, or professional advice. We work to keep
              stories accurate and current but cannot guarantee that every card
              is complete or error-free. To the extent permitted by law,
              Aurikrex is not liable for decisions made solely from a Byte.
              Questions about these terms can be sent to info@aurikrex.tech.
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
  const [token] = useState(
    () => new URLSearchParams(location.search).get("token") || ""
  );
  const [message, setMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationState, setVerificationState] = useState<
    "idle" | "verified" | "already_verified" | "error"
  >("idle");
  const requirements = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One symbol", valid: /[^A-Za-z0-9]/.test(password) },
  ];
  const login = trpc.reader.login.useMutation({
    onSuccess: async r => {
      await utils.reader.session.invalidate();
      if (r.emailVerified) navigate("/dashboard");
      else setMessage("Please verify your email before accessing all stories.");
    },
    onError: e => setMessage(e.message),
  });
  const googleStart = trpc.reader.googleStart.useQuery(undefined, { enabled: false });
  const startGoogle = async () => {
    const result = await googleStart.refetch();
    if (result.data?.configured) window.location.assign(result.data.url);
    else setMessage("Google sign-in is not configured yet.");
  };
  const signup = trpc.reader.signup.useMutation({
    onSuccess: r => {
      setVerificationEmail(r.email);
      setMessage("");
    },
    onError: e => setMessage(e.message),
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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") login.mutate({ email, password, remember: true });
    if (mode === "signup") {
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
      signup.mutate({ name, email, password });
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
      ? "Join readers who choose context over the scroll."
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
          daily briefing.
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
          This link has already done its job. Sign in to continue reading.
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
          <div>
            <span className="eyebrow">A considered daily read</span>
            <h1>
              Your briefing,
              <br />
              <em>waiting for you.</em>
            </h1>
            <p>
              Five to ten stories. Better context. A calmer start to the day.
            </p>
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
                    <label>
                      Full name
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                      />
                    </label>
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
                  <button className="button button-full" type="submit">
                    {mode === "signup"
                      ? "Create account"
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
                    <button type="button" className="google-button" onClick={startGoogle} disabled={googleStart.isFetching}>
                      {googleStart.isFetching ? "Connecting…" : "Continue with Google"}
                    </button>
                    <div className="auth-links">
                      <Link href={authRoutes.signup}>Create an account</Link>
                      <Link href={authRoutes.forgotPassword}>
                        Forgot password?
                      </Link>
                    </div>
                  </>
                )}
                {mode === "signup" && (
                  <div className="auth-links">
                    <Link href={authRoutes.login}>
                      Already a reader? Sign in
                    </Link>
                  </div>
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
