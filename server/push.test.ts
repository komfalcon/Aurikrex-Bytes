import { describe, expect, it } from "vitest";
import { formatPushNotificationContent } from "./push.js";

describe("push notification dynamic formatting", () => {
  const sampleStory = {
    id: 42,
    headline: "OpenAI releases new reasoning model architecture",
    body: "OpenAI today unveiled their latest frontier reasoning architecture designed to automate complex multi-step technical workflows with lower latency and enhanced tool verification across enterprise deployments. The release introduces new quantization options.",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  };

  it("formats morning briefing notification with headline, body snippet, and canonical URL", () => {
    // 08:00 AM in Africa/Lagos (07:00 UTC)
    const morningTime = new Date("2026-09-19T07:00:00.000Z");
    const result = formatPushNotificationContent(sampleStory, "Africa/Lagos", morningTime);

    expect(result.heading).toBe("🌅 Morning Brief: OpenAI releases new reasoning model architecture");
    expect(result.content.length).toBeLessThanOrEqual(110);
    expect(result.content.endsWith("...")).toBe(true);
    expect(result.url).toContain("/post/42");
    expect(result.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/sample.jpg");
  });

  it("formats evening recap notification during nighttime hours", () => {
    // 10:00 PM in Africa/Lagos (21:00 UTC)
    const eveningTime = new Date("2026-09-19T21:00:00.000Z");
    const result = formatPushNotificationContent(sampleStory, "Africa/Lagos", eveningTime);

    expect(result.heading).toBe("🌙 Evening Recap: OpenAI releases new reasoning model architecture");
    expect(result.content.length).toBeLessThanOrEqual(110);
    expect(result.url).toContain("/post/42");
  });

  it("cleans source tags from notification headline", () => {
    const taggedStory = {
      id: 99,
      headline: "Show HN: FastKV – In-memory distributed store",
      body: "FastKV is a new in-memory distributed key-value store optimized for high-throughput microservices.",
      imageUrl: null,
    };
    const morningTime = new Date("2026-09-19T07:00:00.000Z");
    const result = formatPushNotificationContent(taggedStory, "Africa/Lagos", morningTime);

    expect(result.heading).toBe("🌅 Morning Brief: FastKV – In-memory distributed store");
    expect(result.heading).not.toContain("Show HN:");
    expect(result.imageUrl).toBeNull();
  });

  it("provides clean fallback copy when no story is provided", () => {
    const morningTime = new Date("2026-09-19T07:00:00.000Z");
    const morningResult = formatPushNotificationContent(null, "Africa/Lagos", morningTime);
    expect(morningResult.heading).toBe("🌅 Daily Tech Briefing is Ready");
    expect(morningResult.url).toContain("/dashboard");

    const eveningTime = new Date("2026-09-19T21:00:00.000Z");
    const eveningResult = formatPushNotificationContent(null, "Africa/Lagos", eveningTime);
    expect(eveningResult.heading).toBe("🌙 Evening Tech Roundup");
    expect(eveningResult.url).toContain("/dashboard");
  });
});
