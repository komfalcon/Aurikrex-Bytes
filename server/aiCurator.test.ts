import { describe, expect, it } from "vitest";
import {
  buildDuplicateKey,
  canonicalizeUrl,
  clampEditorialBrief,
  cleanHeadline,
  generateEditorialSvgCard,
  getTodayWindow,
  isNonNewsHeadline,
  normalizeHeadline,
} from "./_core/aiCurator.js";

describe("verified news curation safeguards", () => {
  it("canonicalizes tracking parameters and trailing slashes", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/story/?utm_source=x&ref=home#comments")).toBe(
      "https://example.com/story"
    );
  });

  it("normalizes headlines before identity hashing", () => {
    expect(normalizeHeadline("OpenAI: New Model!")).toBe("openai new model");
    expect(
      buildDuplicateKey("A story", "https://example.com/a", new Date("2026-09-18T01:00:00Z"))
    ).toBe(
      buildDuplicateKey("A  story", "https://example.com/a/?utm_medium=x", new Date("2026-09-18T23:00:00Z"))
    );
  });

  it("calculates the complete local calendar day", () => {
    const window = getTodayWindow(new Date("2026-09-18T02:00:00Z"), "Africa/Lagos");
    expect(window.date).toBe("2026-09-18");
    expect(window.start.toISOString()).toBe("2026-09-17T23:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-18T23:00:00.000Z");
  });

  it("cleans headlines by removing source tags and brackets", () => {
    expect(cleanHeadline("Show HN: SuperDB – A fast database [video]")).toBe("SuperDB – A fast database");
    expect(cleanHeadline("Launch HN: NextGen AI (YC W26) [pdf]")).toBe("NextGen AI (YC W26)");
    expect(cleanHeadline("Apple releases M5 processor - The Verge")).toBe("Apple releases M5 processor");
    expect(cleanHeadline("Linux 6.14 Released | Ars Technica")).toBe("Linux 6.14 Released");
  });

  it("identifies and filters non-news discussions", () => {
    expect(isNonNewsHeadline("Ask HN: What is your favorite code editor?")).toBe(true);
    expect(isNonNewsHeadline("Tell HN: Thank you community")).toBe(true);
    expect(isNonNewsHeadline("Ask HN: Is anyone else experiencing latency?")).toBe(true);
    expect(isNonNewsHeadline("Who is hiring? (September 2026)")).toBe(true);
    expect(isNonNewsHeadline("Nvidia launches new Blackwell Ultra AI accelerators")).toBe(false);
    expect(isNonNewsHeadline("Google DeepMind publishes new frontier reasoning architecture")).toBe(false);
  });

  it("guarantees editorial briefs strictly within the [600, 800] character envelope", () => {
    const candidate = {
      title: "Google announces Gemini 2.5",
      url: "https://example.com/gemini-2-5",
      publisher: "Ars Technica",
      publishedAt: new Date("2026-09-18T10:00:00Z"),
      duplicateKey: "test-key-123",
      imageUrl: null,
    };

    // Case 1: Overly long brief (> 800 characters)
    const longText = "Google today unveiled Gemini 2.5, introducing significant enhancements to multimodal reasoning, context retrieval, and real-time agent execution across distributed enterprise clusters. This release marks an important milestone in production AI deployment, demonstrating measurable efficiency gains and lower latency across high-throughput inference pipelines. Technical teams report substantial improvements in zero-shot coding benchmarks and tool coordination. Furthermore, infrastructure teams will appreciate the reduced memory footprint and optimized quantization workflows that simplify integration with existing Kubernetes clusters and cloud providers. Industry analysts emphasize that competitive pressures are accelerating model development cycles worldwide, compelling organizations to rethink their foundational stack investments. Production deployments will commence immediately across enterprise accounts, with general availability slated for next month.".repeat(2);
    const clampedLong = clampEditorialBrief(longText, candidate);
    expect(clampedLong.length).toBeGreaterThanOrEqual(600);
    expect(clampedLong.length).toBeLessThanOrEqual(800);
    expect(clampedLong.endsWith(".") || clampedLong.endsWith("...")).toBe(true);

    // Case 2: Short brief (< 600 characters)
    const shortText = "Anthropic released Claude 4 with enhanced code interpretation and deeper agent capabilities for developer automation pipelines.";
    const clampedShort = clampEditorialBrief(shortText, candidate);
    expect(clampedShort.length).toBeGreaterThanOrEqual(600);
    expect(clampedShort.length).toBeLessThanOrEqual(800);
    expect(clampedShort).toContain("Anthropic released Claude 4");
    expect(clampedShort).toContain("Ars Technica");
  });

  it("generates a valid high-contrast SVG data URL for editorial cards", () => {
    const card = generateEditorialSvgCard("Quantum processors achieve breakthrough coherence times", "Science");
    expect(card.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(card.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("SCIENCE");
    expect(decoded).toContain("AURIKREX BYTES");
  });
});
