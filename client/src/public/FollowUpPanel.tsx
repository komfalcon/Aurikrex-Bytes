import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Clock3, Search, Sparkles, Square, Workflow, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FormattedBody } from "@/components/FormattedBody";
import { excerpt } from "./SharedLayout";

const MAX_FOLLOWUP_TURNS = 4;
const FOLLOWUP_COIN_COST = 5;

export interface FollowUpTurn {
  question: string;
  answer: string;
  searchQueries: string[];
  cached?: boolean;
}

export function FollowUpPanel({
  postId,
  postHeadline,
  postCategory,
  postPublisher,
}: {
  postId: number;
  postHeadline: string;
  postCategory?: string | null;
  postPublisher?: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<FollowUpTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [expandedTurnIndex, setExpandedTurnIndex] = useState<number | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const coinsQuery = trpc.auth.coinsBalance.useQuery(undefined, {
    enabled: Boolean(session.data),
    retry: false,
  });
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    if (coinsQuery.data && typeof (coinsQuery.data as any).balance === "number") {
      setLiveBalance(Math.min((coinsQuery.data as any).balance, 2500));
    }
  }, [coinsQuery.data]);

  useEffect(() => {
    setTurns([]);
    setPendingQuestion(null);
    setExpandedTurnIndex(null);
  }, [postId]);

  const remainingBalance = liveBalance ?? (coinsQuery.data ? Math.min((coinsQuery.data as any).balance, 2500) : 2500);
  const isOutOfCoins = Boolean(session.data) && remainingBalance < FOLLOWUP_COIN_COST;
  const reachedTurnLimit = turns.length >= MAX_FOLLOWUP_TURNS;

  const followUp = trpc.publicPosts.askFollowUp.useMutation({
    onSuccess: (data: any, variables) => {
      setTurns(prev => [
        ...prev,
        {
          question: variables.question,
          answer: data.answer,
          searchQueries: data.searchQueries || [],
          cached: Boolean(data.cached),
        },
      ]);
      setPendingQuestion(null);
      if (typeof data.remainingCoins === "number") {
        setLiveBalance(data.remainingCoins);
        window.dispatchEvent(
          new CustomEvent("aurikrex:coins-updated", {
            detail: { remainingCoins: data.remainingCoins, nextResetDate: data.nextResetDate },
          })
        );
      }
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    },
    onError: (err, variables) => {
      setTurns(prev => [
        ...prev,
        {
          question: variables.question,
          answer: `Sorry, could not get response: ${err.message}`,
          searchQueries: [],
        },
      ]);
      setPendingQuestion(null);
    },
  });

  const triggerQuestion = (rawQuestion: string) => {
    const q = rawQuestion.trim();
    if (!q || followUp.isPending || reachedTurnLimit || isOutOfCoins) return;
    const history = turns.slice(-3).map(t => ({
      question: t.question,
      answer: t.answer,
    }));
    setPendingQuestion(q);
    setIsThinkingExpanded(false);
    setIsOpen(true);
    followUp.mutate({
      postId,
      question: q,
      history: history.length > 0 ? history : undefined,
    });
    setQuestion("");
  };

  useEffect(() => {
    const handleExternalTrigger = (event: Event) => {
      const custom = event as CustomEvent<{ postId: number; question: string }>;
      if (custom.detail && custom.detail.postId === postId && custom.detail.question) {
        triggerQuestion(custom.detail.question);
      }
    };
    window.addEventListener("aurikrex:trigger-followup", handleExternalTrigger);
    return () => window.removeEventListener("aurikrex:trigger-followup", handleExternalTrigger);
  }, [postId, followUp.isPending, turns, reachedTurnLimit, isOutOfCoins]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    triggerQuestion(question);
  };

  return (
    <>
      <div className="followup-bottom-bar" role="region" aria-label="Ask follow-up bar">
        <form className="followup-bottom-pill-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="followup-bottom-input"
            placeholder={
              isOutOfCoins
                ? "Monthly Auri Coins exhausted — cached prompts remain free"
                : reachedTurnLimit
                  ? "Thread complete (4 of 4 turns used)"
                  : turns.length > 0
                    ? `Continue thread (${turns.length}/${MAX_FOLLOWUP_TURNS} turns)…`
                    : "Ask Falke AI a follow-up…"
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            disabled={reachedTurnLimit || isOutOfCoins}
            aria-label="Ask follow-up"
          />
          {session.data && (
            <span className="followup-coin-pill" title={`${remainingBalance} Auri Coins remaining (${FOLLOWUP_COIN_COST} coins per uncached turn)`}>
              <Sparkles size={11} />
              <span>{remainingBalance}</span>
            </span>
          )}
          {turns.length > 0 && !isOpen && (
            <button
              type="button"
              className="followup-reopen-btn"
              onClick={() => setIsOpen(true)}
              title="Re-open active follow-up thread"
            >
              {turns.length}/{MAX_FOLLOWUP_TURNS}
            </button>
          )}
          <button
            type="submit"
            className="followup-bottom-send-btn"
            disabled={!question.trim() || followUp.isPending || reachedTurnLimit || isOutOfCoins}
            aria-label="Submit question"
          >
            {followUp.isPending ? <Square size={13} fill="currentColor" /> : <Search size={16} />}
          </button>
        </form>
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div className="followup-fullscreen-view" role="dialog" aria-modal="true" aria-label="Follow-up thread">
          <div className="followup-fullscreen-topbar">
            <button
              type="button"
              className="followup-close-circle-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close follow-up view"
            >
              <X size={20} />
            </button>
            <div className="followup-topbar-meta">
              <span className="followup-turn-badge">
                Turn {Math.min(MAX_FOLLOWUP_TURNS, turns.length + (followUp.isPending ? 1 : 0))} of {MAX_FOLLOWUP_TURNS}
              </span>
              {session.data && (
                <span className="followup-coin-status">
                  <Sparkles size={13} /> {remainingBalance} Auri Coins · {FOLLOWUP_COIN_COST}/turn
                </span>
              )}
            </div>
          </div>

          <div className="followup-fullscreen-content">
            <div className="followup-context-card">
              <div className="followup-context-kicker">
                <Workflow size={15} />
                <span>Pinned Byte Context {postCategory ? `· ${postCategory}` : ""} {postPublisher ? `· ${postPublisher}` : ""}</span>
              </div>
              <p className="followup-context-headline">{postHeadline}</p>
            </div>

            {turns.map((turn, idx) => {
              const isExpanded = expandedTurnIndex === idx;
              return (
                <div key={idx} className="followup-turn-group">
                  <div className="followup-user-bubble-wrap">
                    <div className="followup-user-bubble">
                      <span>{turn.question}</span>
                    </div>
                  </div>

                  <div className="followup-response-block">
                    <div className="followup-thinking-header" style={{ marginBottom: "12px" }}>
                      <Sparkles size={18} className="followup-thinking-icon" />
                      <strong>Falke AI · Turn {idx + 1}</strong>
                    </div>

                    <button
                      type="button"
                      className="followup-summary-bar"
                      onClick={() => setExpandedTurnIndex(isExpanded ? null : idx)}
                      aria-expanded={isExpanded}
                      title="Click to toggle search sources summary"
                    >
                      <div className="followup-summary-bar-left">
                        <Clock3 size={15} className="followup-summary-icon" />
                        <span className="followup-summary-text">
                          {turn.searchQueries.length > 0
                            ? `Searched ${turn.searchQueries.length} web source${turn.searchQueries.length > 1 ? "s" : ""} for "${excerpt(turn.question, 35)}"`
                            : `Synthesized from pinned Byte context for "${excerpt(turn.question, 35)}"`}
                        </span>
                      </div>
                      <ChevronRight size={15} className={`followup-summary-chevron ${isExpanded ? "is-open" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="followup-summary-expanded-card">
                        <div className="followup-summary-card-header">
                          <strong>Synthesis Trail</strong>
                          <button
                            type="button"
                            className="followup-summary-close-btn"
                            onClick={() => setExpandedTurnIndex(null)}
                            aria-label="Collapse summary"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="followup-summary-timeline">
                          <div className="followup-timeline-item">
                            <span className="followup-timeline-dot" />
                            <span className="followup-timeline-text">Pinned Byte: &ldquo;{postHeadline}&rdquo;</span>
                          </div>
                          {turn.searchQueries.map((qStr, qIdx) => (
                            <div key={qIdx} className="followup-timeline-item">
                              <Search size={14} className="followup-timeline-globe" />
                              <span className="followup-timeline-text">Searched for &ldquo;{qStr}&rdquo;</span>
                            </div>
                          ))}
                          <div className="followup-timeline-item">
                            <span className="followup-timeline-dot" />
                            <span className="followup-timeline-text">Synthesized explanation using Falke AI</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="followup-answer-text">
                      <FormattedBody body={turn.answer} className="followup-answer-body" />
                    </div>
                  </div>
                </div>
              );
            })}

            {followUp.isPending && pendingQuestion && (
              <div className="followup-turn-group">
                <div className="followup-user-bubble-wrap">
                  <div className="followup-user-bubble">
                    <span>{pendingQuestion}</span>
                  </div>
                </div>

                <div className="followup-thinking-block">
                  <div className="followup-thinking-header">
                    <Sparkles size={18} className="followup-thinking-icon" />
                    <strong>Falke AI is thinking…</strong>
                  </div>
                  <p className="followup-thinking-sub">Falke AI is cross-checking the Byte and live sources</p>

                  <button
                    type="button"
                    className="followup-summary-bar"
                    onClick={() => setIsThinkingExpanded(prev => !prev)}
                    aria-expanded={isThinkingExpanded}
                  >
                    <div className="followup-summary-bar-left">
                      <Clock3 size={15} className="followup-summary-icon" />
                      <span className="followup-summary-text">
                        Exploring context for &ldquo;{excerpt(pendingQuestion, 36)}&rdquo;
                      </span>
                    </div>
                    <ChevronRight size={15} className={`followup-summary-chevron ${isThinkingExpanded ? "is-open" : ""}`} />
                  </button>
                </div>
              </div>
            )}

            {isOutOfCoins && (
              <div className="followup-calm-notice">
                <strong>You&apos;ve used your Auri Coins for this month</strong>
                <p>
                  Your monthly allowance resets automatically. You can continue reading all daily drops and archive stories without interruption.
                </p>
              </div>
            )}

            {reachedTurnLimit && !followUp.isPending && (
              <div className="followup-calm-notice">
                <strong>Follow-up thread complete (4 of 4 turns)</strong>
                <p>
                  Falke follow-ups are bounded to 4 focused turns so your briefing stays fast and intentional.
                </p>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          <div className="followup-bottom-bar followup-bottom-bar-fullscreen">
            <form className="followup-bottom-pill-form" onSubmit={handleSubmit}>
              <input
                type="text"
                className="followup-bottom-input"
                placeholder={
                  isOutOfCoins
                    ? "Out of Auri Coins for this month"
                    : reachedTurnLimit
                      ? "Thread complete (4 of 4 turns used)"
                      : `Ask follow-up turn ${turns.length + 1} of ${MAX_FOLLOWUP_TURNS}…`
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={300}
                disabled={followUp.isPending || reachedTurnLimit || isOutOfCoins}
                aria-label="Ask follow-up"
              />
              {session.data && (
                <span className="followup-coin-pill">
                  <Sparkles size={11} />
                  <span>{remainingBalance}</span>
                </span>
              )}
              <button
                type="submit"
                className="followup-bottom-send-btn"
                disabled={!question.trim() || followUp.isPending || reachedTurnLimit || isOutOfCoins}
                aria-label="Submit question"
              >
                {followUp.isPending ? <Square size={13} fill="currentColor" /> : <Search size={16} />}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
