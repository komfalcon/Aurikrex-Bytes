import { describe, expect, it } from "vitest";
import {
  formatPushNotificationContent,
  formatPushBody,
  decodeHtmlEntities,
  stripSourcePrefixes,
  stripEmoji,
  fixAllCaps,
  truncateHeadline,
  transformPushImage,
} from "./push.js";

describe("Push Notification Content & Payload Design", () => {
  const sampleStory = {
    id: 42,
    headline: "OpenAI releases new reasoning model architecture",
    body: "Full body content of the article...",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  };

  it("formats morning title: plural and singular, strictly under 40 characters", () => {
    // 08:00 AM in Africa/Lagos (07:00 UTC)
    const morningTime = new Date("2026-10-26T07:00:00.000Z");

    const singular = formatPushNotificationContent(sampleStory, {
      postsCount: 1,
      timeZone: "Africa/Lagos",
      now: morningTime,
    });
    expect(singular.heading).toBe("Morning Brief · 1 new Byte");
    expect(singular.heading.length).toBeLessThan(40);

    const plural = formatPushNotificationContent(sampleStory, {
      postsCount: 8,
      timeZone: "Africa/Lagos",
      now: morningTime,
    });
    expect(plural.heading).toBe("Morning Brief · 8 new Bytes");
    expect(plural.heading.length).toBeLessThan(40);
  });

  it("formats evening title: plural and singular, strictly under 40 characters", () => {
    // 10:00 PM in Africa/Lagos (21:00 UTC)
    const eveningTime = new Date("2026-10-26T21:00:00.000Z");

    const singular = formatPushNotificationContent(sampleStory, {
      postsCount: 1,
      timeZone: "Africa/Lagos",
      now: eveningTime,
    });
    expect(singular.heading).toBe("Evening Recap · 1 Byte today");
    expect(singular.heading.length).toBeLessThan(40);

    const plural = formatPushNotificationContent(sampleStory, {
      postsCount: 14,
      timeZone: "Africa/Lagos",
      now: eveningTime,
    });
    expect(plural.heading).toBe("Evening Recap · 14 Bytes today");
    expect(plural.heading.length).toBeLessThan(40);
  });

  it("formats body as the lead headline, max 90 chars, cut at word boundary with '…'", () => {
    const longHeadline =
      "Anthropic launches Claude 3.5 Sonnet with state of the art coding and vision capabilities across enterprise applications";
    const body = formatPushBody(longHeadline);

    expect(body.length).toBeLessThanOrEqual(90);
    expect(body.endsWith("…")).toBe(true);
    // Cut must be at a word boundary (e.g. no mid-word cuts)
    expect(body).not.toContain("capabil…");
  });

  it("does NOT add '…' if headline is <= 90 characters", () => {
    const shortHeadline = "Google DeepMind reveals AlphaFold 3 biomolecular breakthrough";
    const body = formatPushBody(shortHeadline);

    expect(body).toBe("Google DeepMind reveals AlphaFold 3 biomolecular breakthrough");
    expect(body.endsWith("…")).toBe(false);
  });

  it("strips 'Show HN:' and similar prefixes", () => {
    expect(stripSourcePrefixes("Show HN: New Rust Web Framework")).toBe(
      "New Rust Web Framework"
    );
    expect(stripSourcePrefixes("Ask HN: How do you scale?")).toBe(
      "How do you scale?"
    );
    expect(stripSourcePrefixes("Launch HN: Acme (YC W26)")).toBe(
      "Acme (YC W26)"
    );
    expect(stripSourcePrefixes("[D] Discussion on Transformers")).toBe(
      "Discussion on Transformers"
    );
  });

  it("decodes HTML entities so none are cut mid-entity", () => {
    const entityHeadline = "AT&amp;T &quot;Mega&quot; Deal &lt;Approved&gt; by FCC";
    expect(decodeHtmlEntities(entityHeadline)).toBe('AT&T "Mega" Deal <Approved> by FCC');
  });

  it("strips emoji from push body", () => {
    const emojiHeadline = "🚀 Breakthrough in Quantum Computing! ⚛️🔬";
    expect(stripEmoji(emojiHeadline)).toBe("Breakthrough in Quantum Computing!");
  });

  it("converts ALL CAPS headlines while preserving standard tech acronyms", () => {
    const allCaps = "NVIDIA RELEASES NEW AI CHIP WITH ENHANCED GPU PERFORMANCE";
    const fixed = fixAllCaps(allCaps);
    expect(fixed).toContain("AI");
    expect(fixed).toContain("GPU");
    expect(fixed).not.toBe(allCaps);
  });

  it("transforms Cloudinary images to 2:1 aspect ratio with f_auto,q_auto", () => {
    const raw = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    const transformed = transformPushImage(raw, "https://bytes.aurikrex.com");
    expect(transformed).toContain("/upload/c_fill,ar_2:1,w_1200,g_auto,f_auto,q_auto/");
  });

  it("uses branded fallback banner if story has no image", () => {
    const transformed = transformPushImage(null, "https://bytes.aurikrex.com");
    expect(transformed).toBe("https://bytes.aurikrex.com/images/briefing-banner-2x1.png");
  });

  it("includes action buttons 'Read now' and 'All Bytes'", () => {
    const result = formatPushNotificationContent(sampleStory);
    expect(result.buttons).toBeDefined();
    expect(result.buttons).toHaveLength(2);
    expect(result.buttons?.[0].id).toBe("read-now");
    expect(result.buttons?.[0].text).toBe("Read now");
    expect(result.buttons?.[0].url).toContain("/post/42");
    expect(result.buttons?.[1].id).toBe("all-bytes");
    expect(result.buttons?.[1].text).toBe("All Bytes");
    expect(result.buttons?.[1].url.endsWith("/")).toBe(true);
  });

  it("never falls back to /dashboard for unauthenticated readers", () => {
    const fallbackResult = formatPushNotificationContent(null);
    expect(fallbackResult.url).not.toContain("/dashboard");
    expect(fallbackResult.url.endsWith("/")).toBe(true);
  });
});
