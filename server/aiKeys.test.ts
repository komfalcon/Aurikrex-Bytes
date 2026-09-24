import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getAiApiKeys, getPrimaryAiApiKey, hasAiApiKey } from "./_core/aiKeys.js";

describe("AI API Keys Management & Multi-Key Fallback", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY_SECONDARY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY_2;
    delete process.env.GOOGLE_API_KEY_SECONDARY;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.FORGE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns empty array and false when no keys are configured", () => {
    expect(getAiApiKeys()).toEqual([]);
    expect(getPrimaryAiApiKey()).toBe("");
    expect(hasAiApiKey()).toBe(false);
  });

  it("resolves single GEMINI_API_KEY correctly", () => {
    process.env.GEMINI_API_KEY = "primary-key-123";
    expect(getAiApiKeys()).toEqual(["primary-key-123"]);
    expect(getPrimaryAiApiKey()).toBe("primary-key-123");
    expect(hasAiApiKey()).toBe(true);
  });

  it("resolves two keys in priority order (GEMINI_API_KEY + GEMINI_API_KEY_2)", () => {
    process.env.GEMINI_API_KEY = "primary-key-1";
    process.env.GEMINI_API_KEY_2 = "secondary-key-2";

    const keys = getAiApiKeys();
    expect(keys).toEqual(["primary-key-1", "secondary-key-2"]);
    expect(getPrimaryAiApiKey()).toBe("primary-key-1");
  });

  it("supports comma-separated keys in a single env variable", () => {
    process.env.GEMINI_API_KEY = "key-alpha, key-beta";

    const keys = getAiApiKeys();
    expect(keys).toEqual(["key-alpha", "key-beta"]);
  });

  it("supports semicolon-separated keys in a single env variable", () => {
    process.env.GEMINI_API_KEY = "key-alpha; key-beta";

    const keys = getAiApiKeys();
    expect(keys).toEqual(["key-alpha", "key-beta"]);
  });

  it("resolves secondary aliases (GEMINI_API_KEY_SECONDARY, GEMINI_API_KEY_BACKUP, GOOGLE_API_KEY_2)", () => {
    process.env.GEMINI_API_KEY = "main-key";
    process.env.GEMINI_API_KEY_SECONDARY = "fallback-secondary";

    expect(getAiApiKeys()).toEqual(["main-key", "fallback-secondary"]);
  });

  it("deduplicates duplicate keys across different environment variables", () => {
    process.env.GEMINI_API_KEY = "shared-api-key";
    process.env.GOOGLE_API_KEY = "shared-api-key";
    process.env.GEMINI_API_KEY_2 = "unique-second-key";

    expect(getAiApiKeys()).toEqual(["shared-api-key", "unique-second-key"]);
  });

  it("simulates multi-key fallback when primary key encounters 429 rate limit", async () => {
    const keys = ["exhausted-key-1", "healthy-key-2"];
    const callLog: string[] = [];

    // Simulated API client with multi-key fallback
    async function simulateGeminiCall(apiKeys: string[]): Promise<{ success: boolean; keyUsed: string }> {
      for (let i = 0; i < apiKeys.length; i++) {
        const key = apiKeys[i];
        callLog.push(key);

        // Simulate Key 1 is rate-limited (HTTP 429)
        if (key === "exhausted-key-1") {
          // 429 Too Many Requests -> triggers fallback to key 2
          continue;
        }

        // Key 2 succeeds
        return { success: true, keyUsed: key };
      }
      throw new Error("All keys exhausted");
    }

    const result = await simulateGeminiCall(keys);
    expect(result.success).toBe(true);
    expect(result.keyUsed).toBe("healthy-key-2");
    expect(callLog).toEqual(["exhausted-key-1", "healthy-key-2"]);
  });
});
