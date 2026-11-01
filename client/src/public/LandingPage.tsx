import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Layers,
  Mail,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FormattedInlineText } from "@/components/FormattedBody";
import {
  excerpt,
  formatDate,
  ProtectedLink,
  PublicLayout,
  PublishedStoryCarousel,
} from "./SharedLayout";

function FeaturePillarsGrid() {
  const pillars = [
    {
      icon: <Bot size={22} />,
      badge: "AI INTELLIGENCE",
      title: "Falke AI Follow-Up Thread",
      description: "Explore a focused 2–4 turn follow-up thread anchored directly to any Byte with live web search context."
    },
    {
      icon: <Flame size={22} />,
      badge: "HABIT TRACKING",
      title: "Earned Reading Streaks",
      description: "Build a real 5-minute morning ritual. Complete today's finite drop to advance your daily streak."
    },
    {
      icon: <Layers size={22} />,
      badge: "CUSTOM READING",
      title: "Dual Reading Modes",
      description: "Switch seamlessly between immersive Editorial story cards and rapid Compact grid scanning on desktop & mobile."
    },
    {
      icon: <Bell size={22} />,
      badge: "8:00 AM WAT DROP",
      title: "Morning Email & Web Push",
      description: "Receive the 8:00 AM WAT drop in your inbox with one-line takeaways or via clean browser & PWA notifications."
    }
  ];

  return (
    <section className="section container landing-pillars">
      <div className="section-heading text-center">
        <div>
          <span className="eyebrow">Everything you need in tech</span>
          <h2>Built for signal. Designed for focus.</h2>
          <p className="section-subtitle">Four core pillars that transform how you stay ahead in technology.</p>
        </div>
      </div>
      <div className="pillars-grid">
        {pillars.map(p => (
          <div key={p.title} className="pillar-card">
            <div className="pillar-icon-wrap">{p.icon}</div>
            <span className="pillar-badge">{p.badge}</span>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoiseVsSignalSection() {
  const [activeTab, setActiveTab] = useState<"signal" | "noise">("signal");

  const signalPoints = [
    {
      icon: <Layers size={18} className="text-blue" />,
      title: "5 to 10 Curated Stories Daily",
      desc: "A finite daily edition—never an endless scroll. Read what matters and move on with your day."
    },
    {
      icon: <Workflow size={18} className="text-blue" />,
      title: "Verified 3-Part Briefs",
      desc: "Clear structure: The Lead, Why It Matters, and Industry Outlook."
    },
    {
      icon: <Clock3 size={18} className="text-blue" />,
      title: "Finished in 5 Quiet Minutes",
      desc: "Delivered at 8:00 AM WAT via email digest and optional web push."
    },
    {
      icon: <ShieldCheck size={18} className="text-blue" />,
      title: "100% Ad-Free & Distraction-Free",
      desc: "Zero sponsored posts, clickbait headlines, or algorithmic rage bait."
    },
    {
      icon: <Sparkles size={18} className="text-blue" />,
      title: "Pinned Falke AI Threads",
      desc: "Ask 2–4 grounded follow-up questions directly on any story in real time."
    },
  ];

  const noisePoints = [
    {
      icon: <XCircle size={18} className="text-red" />,
      title: "100+ Unverified Feed Items",
      desc: "Overwhelming noise, duplicate rumors, and unvetted hot takes."
    },
    {
      icon: <XCircle size={18} className="text-red" />,
      title: "Clickbait Headline Loops",
      desc: "Manipulative headlines designed to generate outrage clicks."
    },
    {
      icon: <XCircle size={18} className="text-red" />,
      title: "Endless Infinite Scrolling",
      desc: "Addictive design loops that waste 45+ minutes of your day."
    },
    {
      icon: <XCircle size={18} className="text-red" />,
      title: "Intrusive Ads & Sponsored Content",
      desc: "Promoted ads disguised as authentic technical recommendations."
    },
    {
      icon: <XCircle size={18} className="text-red" />,
      title: "No Technical Depth or Context",
      desc: "Shallow surface text with no interactive follow-up capability."
    },
  ];

  return (
    <section className="section container noise-signal-section">
      <div className="section-heading text-center">
        <div>
          <span className="eyebrow">The Difference</span>
          <h2>Why traditional tech feeds fail you</h2>
        </div>
      </div>

      <div className="mobile-comparison-toggle" role="tablist" aria-label="Choose comparison view">
        <button
          type="button"
          id="comparison-tab-signal"
          className={activeTab === "signal" ? "active" : ""}
          role="tab"
          aria-selected={activeTab === "signal"}
          aria-controls="comparison-panel-signal"
          onClick={() => setActiveTab("signal")}
        >
          <CheckCircle2 size={15} className="text-blue" /> Aurikrex Bytes
        </button>
        <button
          type="button"
          id="comparison-tab-noise"
          className={activeTab === "noise" ? "active" : ""}
          role="tab"
          aria-selected={activeTab === "noise"}
          aria-controls="comparison-panel-noise"
          onClick={() => setActiveTab("noise")}
        >
          <XCircle size={15} className="text-red" /> Social Feeds
        </button>
      </div>

      <div className="comparison-container" role="group" aria-label="Aurikrex Bytes versus social feeds">
        <div
          id="comparison-panel-noise"
          className={`comparison-col comparison-noise ${activeTab === "noise" ? "show-mobile" : ""}`}
          role="tabpanel"
          aria-labelledby="comparison-tab-noise"
        >
          <div className="col-header">
            <div className="col-header-badge red-badge">
              <XCircle size={14} /> TRADITIONAL FEEDS
            </div>
            <h3>Social Media Feeds</h3>
            <p>Clickbait &amp; Algorithmic Noise</p>
          </div>
          <div className="structured-points-list">
            {noisePoints.map((pt, idx) => (
              <div key={idx} className="structured-point-card point-noise">
                <div className="point-icon">{pt.icon}</div>
                <div className="point-body">
                  <h4>{pt.title}</h4>
                  <p>{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          id="comparison-panel-signal"
          className={`comparison-col comparison-signal ${activeTab === "signal" ? "show-mobile" : ""}`}
          role="tabpanel"
          aria-labelledby="comparison-tab-signal"
        >
          <div className="col-header">
            <div className="col-header-badge blue-badge">
              <CheckCircle2 size={14} /> 5-MINUTE DAILY SIGNAL
            </div>
            <h3>Aurikrex Bytes</h3>
            <p>Focused Daily Curation + Falke AI</p>
          </div>
          <div className="structured-points-list">
            {signalPoints.map((pt, idx) => (
              <div key={idx} className="structured-point-card point-signal">
                <div className="point-icon">{pt.icon}</div>
                <div className="point-body">
                  <h4>{pt.title}</h4>
                  <p>{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicTodaysEditionTeaser({ signedIn }: { signedIn: boolean }) {
  const todayQuery = trpc.publicPosts.today.useQuery();
  const carouselQuery = trpc.publicPosts.carousel.useQuery(undefined, {
    enabled: !todayQuery.isLoading && (todayQuery.data?.length ?? 0) === 0,
  });

  const todayPosts = todayQuery.data ?? [];
  const fallbackPosts = (carouselQuery.data?.posts ?? []).slice(0, 4);
  const teaserPosts = (todayPosts.length > 0 ? todayPosts : fallbackPosts).slice(0, 4);
  const isLiveToday = todayPosts.length > 0;

  if (!teaserPosts.length) return null;

  return (
    <section className="section container landing-today-teaser" aria-labelledby="landing-today-teaser-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <span className="live-dot" />{" "}
            {isLiveToday ? `Today's Edition · ${todayPosts.length} Bytes` : "Recent Edition Preview"}
          </span>
          <h2 id="landing-today-teaser-title">
            {isLiveToday ? "Inside today’s 8:00 AM drop" : "What a daily edition looks like"}
          </h2>
          <p className="section-subtitle">
            Every morning at 8:00 AM WAT, we publish 5–10 finite stories with the one-line reason each one matters.
          </p>
        </div>
        <div>
          <Link className="button button-outline" href={signedIn ? "/dashboard" : "/signup"}>
            {signedIn ? "Open your reading desk" : "Get the 8:00 AM drop"} <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="landing-teaser-list">
        {teaserPosts.map((post: any, index: number) => (
          <Link key={post.id} href={`/post/${post.id}`} className="landing-teaser-item">
            <span className="landing-teaser-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="landing-teaser-body">
              <div className="landing-teaser-meta">
                <span className="px-card-topic-pill">{post.category || "Tech"}</span>
                <span>{post.sourcePublisher || "Aurikrex Editorial"}</span>
                <span>·</span>
                <span>{formatDate(post.publishedTime)}</span>
              </div>
              <h3>{post.headline}</h3>
              <p>
                <FormattedInlineText text={excerpt(post.whyItMatters || post.body, 160)} />
              </p>
            </div>
            <span className="landing-teaser-arrow" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FloatingMobileCta({ signedIn }: { signedIn: boolean }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 450 && !dismissed) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed]);

  if (!visible) return null;

  return (
    <div className="floating-mobile-cta">
      <span className="floating-mobile-cta-copy">
        {signedIn ? "Continue today's briefing" : "Get the 8:00 AM drop (Email & Push)"}
      </span>
      <div className="floating-mobile-cta-actions">
        <Link href={signedIn ? "/dashboard" : "/signup"} className="button button-small">
          {signedIn ? "Open Desk" : "Get the Drop"} <ArrowRight size={14} />
        </Link>
        <button
          type="button"
          className="floating-mobile-cta-dismiss"
          aria-label="Dismiss briefing sign-up banner"
          onClick={() => {
            setDismissed(true);
            setVisible(false);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const signedIn = Boolean(session.data);

  return (
    <PublicLayout>
      <main className="landing-page">
        {signedIn && (
          <div className="container landing-continue-banner">
            <div className="landing-continue-banner-inner">
              <span>
                <span className="live-dot" /> Signed in as{" "}
                <strong>{(session.data as any)?.nickname || session.data?.name || session.data?.email}</strong>
              </span>
              <Link href="/dashboard" className="text-link">
                Continue to today&apos;s desk <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
        <section className="hero container landing-hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" />
              The 5-Minute Daily Tech Briefing · 8:00 AM WAT
            </span>
            <h1>
              Aurikrex Bytes —<br />
              <em>what matters.</em>
            </h1>
            <p>
              Five to ten considered technology stories curated with AI context. A finite morning ritual delivered at 8:00 AM via email and web push.
            </p>
            <div className="hero-actions">
              {signedIn ? (
                <Link className="button button-hero" href="/dashboard">
                  Continue to today&apos;s desk <ArrowRight size={16} />
                </Link>
              ) : (
                <Link className="button button-hero" href="/signup">
                  Get the 8:00 AM drop <ArrowRight size={16} />
                </Link>
              )}
              <Link className="text-link" href="/archive">
                Browse archive library <ArrowRight size={15} />
              </Link>
            </div>
            <div className="hero-trust-badges">
              <span><Mail size={13} className="check-icon" /> 8:00 AM Email &amp; Push</span>
              <span><Check size={13} className="check-icon" /> Finite 5–10 story drop</span>
              <span><Check size={13} className="check-icon" /> Free forever</span>
            </div>
          </div>
          <div className="hero-side-showcase">
            <PublishedStoryCarousel featured={true} />
          </div>
        </section>

        <PublicTodaysEditionTeaser signedIn={signedIn} />

        <FeaturePillarsGrid />

        <section className="section container sample-section">
          <div className="sample-copy">
            <span className="eyebrow">A Byte, up close</span>
            <h2>News you can actually use.</h2>
            <p>
              Each card gives you a clear headline, the useful context behind it, and a few quiet minutes to understand what matters.
            </p>
            <ProtectedLink className="text-link" href="/archive">
              See the archive <ArrowRight size={15} />
            </ProtectedLink>
          </div>
          <PublishedStoryCarousel />
        </section>

        <NoiseVsSignalSection />

        <section className="manifesto">
          <div className="container manifesto-inner">
            <Sparkles size={24} />
            <div>
              <span className="eyebrow">The Bytes promise</span>
              <h2>Make room for what matters.</h2>
              <p>
                Get tomorrow’s 8:00 AM WAT edition in your inbox and reading desk, or explore the archive first.
              </p>
            </div>
            <Link className="button" href={signedIn ? "/dashboard" : "/signup"}>
              {signedIn ? "Open today's desk" : "Get the 8:00 AM drop"} <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <FloatingMobileCta signedIn={signedIn} />
      </main>
    </PublicLayout>
  );
}
