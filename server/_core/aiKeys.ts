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
  return getAiApiKeys().length > 0;
}
