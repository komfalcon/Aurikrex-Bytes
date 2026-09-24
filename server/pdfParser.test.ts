import { describe, expect, it } from "vitest";
import { generateDynamicByteCard, parsePdfToBytes } from "./_core/pdfParser.js";

describe("Multi-Story PDF AI Engine", () => {
  it("generates dynamic domain-branded visual cards for AI stories", () => {
    const card = generateDynamicByteCard("DeepSeek plans massive 160,000-chip Huawei AI cluster", "AI", "NewsBytes");
    expect(card).toContain("data:image/svg+xml;base64,");

    const decoded = Buffer.from(card.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("DEEPSEEK • AI");
    expect(decoded).toContain("AURIKREX BYTES &bull; EDITORIAL REPORT");
    expect(decoded).toContain("VIA NEWSBYTES");
  });

  it("generates hardware-branded visual cards for chip and device stories", () => {
    const card = generateDynamicByteCard("Huawei launches first triple-fold phone with 'US-free' chips", "Tech", "Nikkei Asia");
    const decoded = Buffer.from(card.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("HUAWEI • HARDWARE");
    expect(decoded).toContain("VIA NIKKEI ASIA");
  });

  it("generates space/frontier science visual cards", () => {
    const card = generateDynamicByteCard("China to launch 3D satellite network between Earth and Moon", "Science", "NewsBytes");
    const decoded = Buffer.from(card.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("AEROSPACE • DEEP SPACE");
  });

  it("generates mobility & autonomy visual cards for automotive stories", () => {
    const card = generateDynamicByteCard("Tesla confirms driver-assist system was engaged during crash", "Tech", "Electrek");
    const decoded = Buffer.from(card.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("TESLA • AUTOPILOT");
    expect(decoded).toContain("VIA ELECTREK");
  });

  it("provides graceful fallback response when API key is not configured", async () => {
    const origKeys: Record<string, string | undefined> = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
      GEMINI_API_KEY_SECONDARY: process.env.GEMINI_API_KEY_SECONDARY,
      GEMINI_API_KEY_BACKUP: process.env.GEMINI_API_KEY_BACKUP,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      GOOGLE_API_KEY_2: process.env.GOOGLE_API_KEY_2,
      GOOGLE_API_KEY_SECONDARY: process.env.GOOGLE_API_KEY_SECONDARY,
      BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
      FORGE_API_KEY: process.env.FORGE_API_KEY,
    };

    try {
      for (const k of Object.keys(origKeys)) {
        delete process.env[k];
      }

      const results = await parsePdfToBytes("test plain text");
      expect(results.length).toBe(1);
      expect(results[0].headline).toBe("Gemini API Key Required for PDF Ingestion");
      expect(results[0].imageUrl).toContain("data:image/svg+xml;base64,");
    } finally {
      for (const [k, v] of Object.entries(origKeys)) {
        if (v !== undefined) process.env[k] = v;
      }
    }
  });
});
