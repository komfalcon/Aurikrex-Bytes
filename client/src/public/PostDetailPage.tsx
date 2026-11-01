import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, Sparkles, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FormattedBody } from "@/components/FormattedBody";
import { FollowUpPanel } from "./FollowUpPanel";
import {
  EngagementActions,
  excerpt,
  formatDate,
  getPostMetaInfo,
  markPostAsReadLocal,
  optimizedImage,
  ProtectedLink,
  PublicLayout,
} from "./SharedLayout";

function ArticleAudioPlayer({ headline, body }: { headline: string; body: string }) {
  const [playing, setPlaying] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const rates = [1, 1.25, 1.5];
  const currentRate = rates[rateIndex];

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [headline]);

  const startSpeech = (rate: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Audio briefing is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = `${headline}. ${body.replace(/\*\*|__|\*|_/g, "")}`;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Audio briefing is not supported in this browser.");
      return;
    }
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
    } else {
      startSpeech(currentRate);
    }
  };

  const cycleRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (rateIndex + 1) % rates.length;
    setRateIndex(nextIdx);
    if (playing) {
      startSpeech(rates[nextIdx]);
    }
  };

  return (
    <div className={`px-audio-player ${playing ? "is-playing" : ""}`}>
      <button
        type="button"
        className="px-audio-btn"
        onClick={togglePlay}
        aria-label={playing ? "Stop audio briefing" : "Listen to audio briefing"}
      >
        {playing ? <Square size={12} fill="currentColor" /> : <Zap size={13} fill="currentColor" />}
        <span>{playing ? "Listening…" : "Listen"}</span>
      </button>
      <button
        type="button"
        className="px-audio-speed"
        onClick={cycleRate}
        title="Change playback speed"
        aria-label={`Playback speed ${currentRate}x`}
      >
        {currentRate}x
      </button>
    </div>
  );
}

const ENTITY_STOP_WORDS = new Set([
  "The", "This", "That", "With", "From", "Into", "Over", "Under", "After", "Before",
  "More", "What", "When", "Where", "Which", "While", "How", "Why", "Who", "New",
  "Now", "First", "Next", "Today", "Tomorrow", "Yesterday", "Their", "They", "Will",
  "Would", "Could", "Should", "Have", "Has", "Had", "For", "And", "But", "Not",
]);

export function buildGroundedPrompts(post: {
  headline?: string;
  body?: string;
  category?: string | null;
  sourcePublisher?: string | null;
  whyItMatters?: string | null;
}): string[] {
  const headline = post?.headline || "this development";
  const body = post?.body || "";
  const category = post?.category || "Tech";

  // Extract capitalized proper nouns / technical terms from headline and body
  const matches = `${headline} ${body}`.match(/\b[A-Z][A-Za-z0-9.-]{2,20}(?:\s+[A-Z][A-Za-z0-9.-]{2,20})?\b/g) || [];
  const entities: string[] = [];
  for (const raw of matches) {
    const clean = raw.trim();
    const firstWord = clean.split(/\s+/)[0];
    if (ENTITY_STOP_WORDS.has(clean) || ENTITY_STOP_WORDS.has(firstWord)) continue;
    if (!entities.some(e => e.toLowerCase() === clean.toLowerCase())) {
      entities.push(clean);
    }
    if (entities.length >= 3) break;
  }

  const primaryEntity = entities[0] || excerpt(headline, 44);
  const secondaryEntity = entities[1] || category;

  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const whyLine = (post?.whyItMatters || paragraphs[1] || paragraphs[0] || "").replace(/\*\*|__/g, "").trim();
  const shortWhy = whyLine ? excerpt(whyLine.split(/(?<=[.!?])\s+/)[0] || whyLine, 70) : "";

  const p1 = `How does ${excerpt(headline, 58)} change ${primaryEntity}'s position in ${category}?`;
  const p2 = shortWhy
    ? `Unpack the core implication: "${shortWhy}" — what are the concrete engineering trade-offs?`
    : `What are the immediate architectural and product trade-offs for teams building around ${primaryEntity}?`;
  const p3 =
    entities.length >= 2
      ? `How will ${secondaryEntity} and competing ecosystems respond to ${primaryEntity} over the next 6–12 months?`
      : `What milestones or benchmarks should we watch next to see if ${primaryEntity} delivers on this?`;

  return [p1, p2, p3];
}

export function PostDetail() {
  const [, params] = useRoute("/post/:id");
  const id = Number(params?.id);
  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const post = trpc.publicPosts.byId.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );
  const markPostRead = trpc.reader.markPostRead.useMutation({
    onSuccess: () => {
      void utils.reader.dashboard.invalidate();
    },
  });
  const relatedQuery = trpc.publicPosts.carousel.useQuery();

  useEffect(() => {
    if (post.data && Number.isFinite(id)) {
      markPostAsReadLocal(id);
      if (session.data) {
        markPostRead.mutate({ postId: id, timeZone: "Africa/Lagos" });
      }
    }
  }, [id, post.data?.id, Boolean(session.data)]);

  const engagement = trpc.reader.engagement.useQuery({ postId: id }, { enabled: Boolean(session.data) && Number.isFinite(id), retry: false });
  const detailPost = post.data ? { ...post.data, ...(engagement.data || {}) } : null;
  const metaInfo = useMemo(
    () => (post.data ? getPostMetaInfo(post.data) : { topic: "Tech", publisher: "Aurikrex Editorial", domain: "bytes.aurikrex.com", sourceUrl: null, whyItMatters: null, isEditorPick: false, sources: [] }),
    [post.data]
  );
  const relatedPosts = useMemo(
    () => (relatedQuery.data?.posts ?? []).filter((p: any) => p.id !== id).slice(0, 3),
    [relatedQuery.data?.posts, id]
  );
  const suggestedPrompts = useMemo(
    () => (post.data ? buildGroundedPrompts(post.data as any) : []),
    [post.data?.headline, post.data?.body, post.data?.category, (post.data as any)?.whyItMatters]
  );

  const triggerFollowUpPrompt = (promptText: string) => {
    if (!post.data) return;
    window.dispatchEvent(
      new CustomEvent("aurikrex:trigger-followup", {
        detail: { postId: post.data.id, question: promptText },
      })
    );
  };

  const seo = post.data
    ? {
        title: `${post.data.headline} — Aurikrex Bytes`,
        description: excerpt((post.data as any).whyItMatters || post.data.body, 160),
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
          <article className="px-article-shell">
            <div className="px-detail-topbar">
              <button
                type="button"
                className="back-link text-button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = session.data ? "/dashboard" : "/archive";
                  }
                }}
              >
                ← Back to {session.data ? "Today's Desk" : "Archive"}
              </button>
              <div className="px-detail-topbar-actions">
                <ArticleAudioPlayer headline={post.data.headline} body={post.data.body} />
                <EngagementActions post={detailPost || post.data} />
              </div>
            </div>

            <div className="px-detail-grid">
              <div className="px-detail-main" id="sec-overview">
                <div className="detail-meta">
                  <span className="eyebrow">
                    {metaInfo.isEditorPick ? `Editor's Pick · ${metaInfo.topic}` : metaInfo.topic}
                  </span>
                  <span>{formatDate(post.data.publishedTime)} · {metaInfo.publisher}</span>
                </div>
                <h1>{post.data.headline}</h1>

                {metaInfo.whyItMatters && (
                  <div className="detail-why-callout">
                    <strong>Why it matters:</strong> {metaInfo.whyItMatters}
                  </div>
                )}

                <div className="px-sources-strip" aria-label="Verified source provenance">
                  {metaInfo.sources.map((src, idx) => (
                    <div key={idx} className="px-source-card">
                      <div className="px-source-card-top">
                        <span className={`px-source-avatar px-source-avatar-${idx % 3}`}>{src.code}</span>
                        <span className="px-source-domain">{src.domain}</span>
                      </div>
                      <p className="px-source-title">
                        {src.url ? (
                          <a href={src.url} target="_blank" rel="noreferrer">
                            {src.name} · View primary source ↗
                          </a>
                        ) : (
                          <>{src.name} · Primary Signal</>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {post.data.imageUrl && (
                  <img
                    className="detail-image"
                    src={optimizedImage(post.data.imageUrl, 1400)}
                    alt={post.data.headline}
                    loading="eager"
                    fetchPriority="high"
                  />
                )}

                <div id="sec-analysis">
                  <FormattedBody body={post.data.body} className="detail-body" />
                </div>

                <div className="detail-actions">
                  <EngagementActions post={detailPost || post.data} />
                </div>

                <section className="px-keep-exploring" id="sec-falke" aria-label="Keep exploring with Falke AI">
                  <div className="px-keep-exploring-header">
                    <Sparkles size={17} />
                    <h3>Explore a 2–4 Turn Thread with Falke AI</h3>
                  </div>
                  <div className="px-prompt-list">
                    {suggestedPrompts.map((promptText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="px-prompt-row"
                        onClick={() => triggerFollowUpPrompt(promptText)}
                      >
                        <span>{promptText}</span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="px-detail-rail" aria-label="Story context and navigation">
                <div className="px-rail-card">
                  <span className="px-rail-label">On this page</span>
                  <nav className="px-toc-links" aria-label="Table of contents">
                    <a href="#sec-overview" className="active">Overview &amp; Source Provenance</a>
                    <a href="#sec-analysis">Deep Dive &amp; Context</a>
                    <a href="#sec-falke">Falke AI Follow-Up Thread</a>
                  </nav>
                </div>

                {relatedPosts.length > 0 && (
                  <div className="px-rail-card">
                    <span className="px-rail-label">More in Today&apos;s Edition</span>
                    <div className="px-related-list">
                      {relatedPosts.map((rel: any) => (
                        <ProtectedLink key={rel.id} href={`/post/${rel.id}`} className="px-related-item">
                          <span className="px-related-date">{formatDate(rel.publishedTime)} · {rel.category || "Tech"}</span>
                          <h4>{rel.headline}</h4>
                        </ProtectedLink>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <FollowUpPanel
              postId={post.data.id}
              postHeadline={post.data.headline}
              postCategory={post.data.category}
              postPublisher={(post.data as any).sourcePublisher}
            />
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
