import { describe, expect, it } from "vitest";
import {
  evaluateStreakDisplay,
  getTimeAwareEmptyTodayState,
  updateDailyStreak,
} from "./streak.js";
import { computeFollowUpContentHash } from "./aiCache.js";
import { dailyDigestEmailHtml, extractWhyItMattersLine } from "./services.js";
import { buildStreakShareSvg } from "./_core/seoRoutes.js";
import { buildGroundedPrompts } from "../client/src/public/PostDetailPage.js";

describe("daily reader streaks", () => {
  it("starts a streak for a reader with no previous activity", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
        "2026-09-07"
      )
    ).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: "2026-09-07",
      increased: true,
    });
  });
  it("does not count multiple visits on the same day", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-09-07" },
        "2026-09-07"
      ).increased
    ).toBe(false);
  });
  it("increments on the next calendar day and records a new best", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-09-07" },
        "2026-09-08"
      )
    ).toMatchObject({ currentStreak: 5, longestStreak: 5, increased: true });
  });
  it("resets after a missed day while preserving the record", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 8, longestStreak: 8, lastActiveDate: "2026-09-07" },
        "2026-09-09"
      )
    ).toMatchObject({ currentStreak: 1, longestStreak: 8, increased: true });
  });

  it("evaluates streak display without prematurely awarding today's streak on dashboard load", () => {
    expect(
      evaluateStreakDisplay(
        { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
        "2026-09-08"
      )
    ).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      increased: false,
    });

    expect(
      evaluateStreakDisplay(
        { currentStreak: 5, longestStreak: 5, lastActiveDate: "2026-09-07" },
        "2026-09-08"
      )
    ).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: "2026-09-07",
      increased: false,
    });

    expect(
      evaluateStreakDisplay(
        { currentStreak: 5, longestStreak: 8, lastActiveDate: "2026-09-05" },
        "2026-09-08"
      )
    ).toEqual({
      currentStreak: 0,
      longestStreak: 8,
      lastActiveDate: "2026-09-05",
      increased: false,
    });
  });

  it("returns time-aware empty state copy in Africa/Lagos (WAT)", () => {
    // 06:30 UTC = 07:30 WAT (before 8:00 AM WAT)
    const preDrop = getTimeAwareEmptyTodayState(
      new Date("2026-09-08T06:30:00Z"),
      "Africa/Lagos"
    );
    expect(preDrop.phase).toBe("pre_drop");
    expect(preDrop.heading).toBe("Today’s drop lands at 8:00 AM WAT");

    // 11:00 UTC = 12:00 WAT (between 8:00 AM and 6:00 PM WAT)
    const inReview = getTimeAwareEmptyTodayState(
      new Date("2026-09-08T11:00:00Z"),
      "Africa/Lagos"
    );
    expect(inReview.phase).toBe("in_review");
    expect(inReview.heading).toBe("Today’s edition is being finished");

    // 18:30 UTC = 19:30 WAT (evening >= 6:00 PM WAT)
    const eveningWrap = getTimeAwareEmptyTodayState(
      new Date("2026-09-08T18:30:00Z"),
      "Africa/Lagos"
    );
    expect(eveningWrap.phase).toBe("evening_wrap");
    expect(eveningWrap.heading).toBe("Yesterday’s Bytes are in the archive");
  });
});

describe("P2/P3 morning digest, share card, and grounded Falke thread helpers", () => {
  it("extracts why-it-matters line and renders morning digest HTML", () => {
    const why = extractWhyItMattersLine(
      {
        body: "First sentence of the brief. Second sentence explains why this shifts cloud unit economics.",
        whyItMatters: "Direct impact on enterprise GPU cluster pricing.",
      },
      120
    );
    expect(why).toBe("Direct impact on enterprise GPU cluster pricing.");

    const html = dailyDigestEmailHtml({
      readerName: "Ada",
      editionDate: "2026-09-08",
      posts: [
        {
          id: 42,
          headline: "TSMC expands CoWoS packaging capacity",
          body: "TSMC announced a major packaging expansion.",
          category: "Hardware",
          sourcePublisher: "Reuters",
          whyItMatters: "Relieves the primary bottleneck for AI accelerator supply.",
          isEditorPick: true,
        },
      ],
      unsubscribeUrl: "https://www.bytes.aurikrex.com/api/email/unsubscribe?token=abc",
      baseUrl: "https://www.bytes.aurikrex.com",
    });
    expect(html).toContain("TSMC expands CoWoS packaging capacity");
    expect(html).toContain("Relieves the primary bottleneck for AI accelerator supply.");
    expect(html).toContain("Lead Pick");
    expect(html).toContain("Unsubscribe from the 8:00 AM email briefing");
  });

  it("renders a valid SVG streak share card with streak count and lead headline", () => {
    const svg = buildStreakShareSvg(
      12,
      "Anthropic introduces new constitutional verification layer",
      "2026-09-08"
    ).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("12-DAY STREAK");
    expect(svg).toContain("Anthropic introduces new constitutional");
  });

  it("keeps Turn 1 follow-up content hash backward-compatible and differentiates multi-turn history", () => {
    const turn1WithoutHistory = computeFollowUpContentHash({
      postId: 10,
      headline: "Nvidia Blackwell Ultra Announced",
      body: "Nvidia revealed Blackwell Ultra at GTC.",
      question: "What changed in memory bandwidth?",
    });
    const turn1EmptyHistory = computeFollowUpContentHash({
      postId: 10,
      headline: "Nvidia Blackwell Ultra Announced",
      body: "Nvidia revealed Blackwell Ultra at GTC.",
      question: "What changed in memory bandwidth?",
      history: [],
    });
    const turn2WithHistory = computeFollowUpContentHash({
      postId: 10,
      headline: "Nvidia Blackwell Ultra Announced",
      body: "Nvidia revealed Blackwell Ultra at GTC.",
      question: "How does that compare to MI350?",
      history: [
        {
          question: "What changed in memory bandwidth?",
          answer: "Blackwell Ultra increases HBM3e capacity to 288GB.",
        },
      ],
    });

    expect(turn1WithoutHistory).toBe(turn1EmptyHistory);
    expect(turn2WithHistory).not.toBe(turn1WithoutHistory);
  });

  it("grounds suggested prompts in the specific Byte entities and whyItMatters", () => {
    const prompts = buildGroundedPrompts({
      headline: "Cloudflare launches post-quantum zero-trust tunnels across global edge",
      body: "Cloudflare and NIST researchers detailed how Kyber key exchange is now active by default.",
      category: "Cybersecurity",
      sourcePublisher: "Ars Technica",
      whyItMatters: "Enterprise TLS traffic is now protected against harvest-now-decrypt-later attacks.",
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.join(" ")).toContain("Cloudflare");
    expect(prompts[1]).toContain("Enterprise TLS traffic");
  });
});
