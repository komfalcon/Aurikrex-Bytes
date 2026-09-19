import { describe, expect, it } from "vitest";
import { formatPushContent, StoryCandidateForPush } from "./push.js";

describe("OneSignal push notification content generator", () => {
  const sampleStory: StoryCandidateForPush = {
    id: 42,
    headline: "OpenAI and Anthropic announce new safety evaluation frameworks",
    body: "Major artificial intelligence laboratories have unified their safety and benchmark standards for frontier reasoning models. The joint framework establishes verifiable alignment testing, external red-teaming mandates, and automated risk scoring across high-throughput production clusters before general public deployment.",
    imageUrl: "https://res.cloudinary.com/bytes/image/upload/v1234/story.jpg",
  };

  it("formats morning notification at 8:00 AM WAT with story headline and body snippet", () => {
    // 07:00 UTC is 08:00 WAT
    const morningDate = new Date("2026-09-18T07:00:00Z");
    const content = formatPushContent(sampleStory, morningDate, "Africa/Lagos", "https://www.bytes.aurikrex.tech");

    expect(content.heading).toContain("🌅 Morning Brief:");
    expect(content.heading).toContain("OpenAI and Anthropic");
    expect(content.url).toBe("https://www.bytes.aurikrex.tech/post/42");
    expect(content.imageUrl).toBe(sampleStory.imageUrl);
    expect(content.body.length).toBeLessThanOrEqual(110);
    expect(content.body.endsWith("...")).toBe(true);
    expect(content.body).toContain("Major artificial intelligence laboratories");
  });

  it("formats evening recap at 10:00 PM WAT with story headline and body snippet", () => {
    // 21:00 UTC is 22:00 WAT (10:00 PM)
    const eveningDate = new Date("2026-09-18T21:00:00Z");
    const content = formatPushContent(sampleStory, eveningDate, "Africa/Lagos", "https://www.bytes.aurikrex.tech");

    expect(content.heading).toContain("🌙 Evening Recap:");
    expect(content.heading).toContain("OpenAI and Anthropic");
    expect(content.url).toBe("https://www.bytes.aurikrex.tech/post/42");
    expect(content.imageUrl).toBe(sampleStory.imageUrl);
  });

  it("ignores data: URL images and keeps only HTTP/HTTPS images for push", () => {
    const svgStory: StoryCandidateForPush = {
      id: 99,
      headline: "Quantum algorithm breakthrough",
      body: "Researchers have discovered a new quantum error-mitigation technique.",
      imageUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    };
    const content = formatPushContent(svgStory, new Date(), "Africa/Lagos", "https://www.bytes.aurikrex.tech");
    expect(content.imageUrl).toBeUndefined();
  });

  it("gracefully falls back when no story has been published yet", () => {
    const morningDate = new Date("2026-09-18T07:00:00Z");
    const fallback = formatPushContent(null, morningDate, "Africa/Lagos", "https://www.bytes.aurikrex.tech");

    expect(fallback.heading).toBe("🌅 Today's Tech Briefing is Ready");
    expect(fallback.body).toBe("Catch up on the latest verified tech developments on Aurikrex Bytes.");
    expect(fallback.url).toBe("https://www.bytes.aurikrex.tech/dashboard");
    expect(fallback.imageUrl).toBeUndefined();
  });
});
