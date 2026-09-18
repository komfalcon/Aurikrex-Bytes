import { describe, expect, it } from "vitest";
import { buildDuplicateKey, canonicalizeUrl, getTodayWindow, normalizeHeadline } from "./_core/aiCurator.js";

describe("verified news curation safeguards", () => {
  it("canonicalizes tracking parameters and trailing slashes", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/story/?utm_source=x&ref=home#comments")).toBe("https://example.com/story");
  });

  it("normalizes headlines before identity hashing", () => {
    expect(normalizeHeadline("OpenAI: New Model!")).toBe("openai new model");
    expect(buildDuplicateKey("A story", "https://example.com/a", new Date("2026-09-18T01:00:00Z"))).toBe(buildDuplicateKey("A  story", "https://example.com/a/?utm_medium=x", new Date("2026-09-18T23:00:00Z")));
  });

  it("calculates the complete local calendar day", () => {
    const window = getTodayWindow(new Date("2026-09-18T02:00:00Z"), "Africa/Lagos");
    expect(window.date).toBe("2026-09-18");
    expect(window.start.toISOString()).toBe("2026-09-17T23:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-18T23:00:00.000Z");
  });
});
