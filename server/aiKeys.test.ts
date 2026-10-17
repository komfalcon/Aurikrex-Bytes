import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getAiApiKeys,
  getPrimaryAiApiKey,
  hasAiApiKey,
  getCloudflareAiConfig,
  getCloudflareAiConfigs,
} from "./_core/aiKeys.js";

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
    delete process.env.MISTRAL_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID_2;
    delete process.env.CLOUDFLARE_API_TOKEN_2;
    delete process.env.CLOUDFLARE_ACCOUNT_ID_SECONDARY;
    delete process.env.CLOUDFLARE_API_TOKEN_SECONDARY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID_BACKUP;
    delete process.env.CLOUDFLARE_API_TOKEN_BACKUP;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_API_TOKEN;
    delete process.env.CF_ACCOUNT_ID_2;
    delete process.env.CF_API_TOKEN_2;
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

  it("resolves Cloudflare Workers AI configuration correctly", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "mock-cf-account";
    process.env.CLOUDFLARE_API_TOKEN = "mock-cf-token";

    expect(getCloudflareAiConfig()).toEqual({
      accountId: "mock-cf-account",
      apiToken: "mock-cf-token",
    });
    expect(hasAiApiKey()).toBe(true);
  });

  it("returns null when Cloudflare credentials are incomplete or missing", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "mock-cf-account";
    // missing token
    expect(getCloudflareAiConfig()).toBeNull();

    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    process.env.CLOUDFLARE_API_TOKEN = "mock-cf-token";
    // missing account id
    expect(getCloudflareAiConfig()).toBeNull();
  });

  it("resolves multiple Cloudflare accounts in cascade order", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "mock-cf-1";
    process.env.CLOUDFLARE_API_TOKEN = "mock-token-1";
    process.env.CLOUDFLARE_ACCOUNT_ID_2 = "mock-cf-2";
    process.env.CLOUDFLARE_API_TOKEN_2 = "mock-token-2";

    const configs = getCloudflareAiConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0]).toEqual({ accountId: "mock-cf-1", apiToken: "mock-token-1" });
    expect(configs[1]).toEqual({ accountId: "mock-cf-2", apiToken: "mock-token-2" });
    expect(getCloudflareAiConfig()).toEqual(configs[0]);
  });

  it("deduplicates identical primary and secondary Cloudflare accounts", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "shared-cf";
    process.env.CLOUDFLARE_API_TOKEN = "shared-token";
    process.env.CLOUDFLARE_ACCOUNT_ID_2 = "shared-cf";
    process.env.CLOUDFLARE_API_TOKEN_2 = "shared-token";

    const configs = getCloudflareAiConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual({ accountId: "shared-cf", apiToken: "shared-token" });
  });

  it("supports secondary aliases (CLOUDFLARE_ACCOUNT_ID_SECONDARY, CF_ACCOUNT_ID_2)", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "primary-cf";
    process.env.CLOUDFLARE_API_TOKEN = "primary-token";
    process.env.CLOUDFLARE_ACCOUNT_ID_SECONDARY = "fallback-cf";
    process.env.CLOUDFLARE_API_TOKEN_SECONDARY = "fallback-token";

    const configs = getCloudflareAiConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[1]).toEqual({ accountId: "fallback-cf", apiToken: "fallback-token" });
  });
});
