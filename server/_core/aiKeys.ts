/**
 * Centralized AI API Key Resolution & Multi-Key Fallback Management
 *
 * Supports multiple Gemini / AI API keys for resilient fallback:
 * 1. Primary: GEMINI_API_KEY (single key or comma/semicolon-separated list)
 * 2. Secondary / Backup: GEMINI_API_KEY_2, GEMINI_API_KEY_SECONDARY, GEMINI_API_KEY_BACKUP
 * 3. Google aliases: GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_SECONDARY
 * 4. Forge aliases: BUILT_IN_FORGE_API_KEY, FORGE_API_KEY
 */

export function getAiApiKeys(): string[] {
  const keys: string[] = [];

  const candidateSources = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_2,
    process.env.GOOGLE_API_KEY_SECONDARY,
    process.env.BUILT_IN_FORGE_API_KEY,
    process.env.FORGE_API_KEY,
  ];

  for (const source of candidateSources) {
    if (!source || typeof source !== "string") continue;
    // Allow comma- or semicolon-separated keys within a single variable
    const parts = source.split(/[,;]/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  }

  return keys;
}

export function getPrimaryAiApiKey(): string {
  const keys = getAiApiKeys();
  return keys[0] || "";
}

export function hasAiApiKey(): boolean {
  return (
    getAiApiKeys().length > 0 ||
    Boolean(getMistralApiKey()) ||
    Boolean(getNvidiaApiKey()) ||
    getCloudflareAiConfigs().length > 0
  );
}

export function getMistralApiKey(): string {
  return (process.env.MISTRAL_API_KEY || process.env.MISTRAL_KEY || "").trim();
}

export function getNvidiaApiKey(): string {
  return (process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY || "").trim();
}

export interface CloudflareAiConfig {
  accountId: string;
  apiToken: string;
}

export function getCloudflareAiConfigs(): CloudflareAiConfig[] {
  const configs: CloudflareAiConfig[] = [];

  // Account 1 (Primary)
  const id1 = (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "").trim();
  const token1 = (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || "").trim();
  if (id1 && token1) {
    configs.push({ accountId: id1, apiToken: token1 });
  }

  // Account 2 (Secondary / Backup Fallback)
  const id2 = (
    process.env.CLOUDFLARE_ACCOUNT_ID_2 ||
    process.env.CLOUDFLARE_ACCOUNT_ID_SECONDARY ||
    process.env.CLOUDFLARE_ACCOUNT_ID_BACKUP ||
    process.env.CF_ACCOUNT_ID_2 ||
    ""
  ).trim();
  const token2 = (
    process.env.CLOUDFLARE_API_TOKEN_2 ||
    process.env.CLOUDFLARE_API_TOKEN_SECONDARY ||
    process.env.CLOUDFLARE_API_TOKEN_BACKUP ||
    process.env.CF_API_TOKEN_2 ||
    ""
  ).trim();
  if (id2 && token2 && (id2 !== id1 || token2 !== token1)) {
    configs.push({ accountId: id2, apiToken: token2 });
  }

  return configs;
}

export function getCloudflareAiConfig(): CloudflareAiConfig | null {
  const configs = getCloudflareAiConfigs();
  return configs[0] || null;
}

