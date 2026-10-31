import { getMistralApiKey, getNvidiaApiKey, getCloudflareAiConfigs } from "./aiKeys.js";
import { sendAdminAlertEmail } from "../push.js";

export interface ProviderHealth {
  name: string;
  status: "healthy" | "degraded" | "down" | "unconfigured";
  model: string;
  latencyMs?: number;
  error?: string;
  rateLimited?: boolean;
  quotaExhausted?: boolean;
  lastChecked: string;
}

export interface AiHealthReport {
  overallStatus: "healthy" | "degraded" | "critical";
  activeProvider: string;
  providers: ProviderHealth[];
  summary: string;
  timestamp: string;
}

// In-memory cache for recent probe results to avoid burning rate limits
let cachedHealthReport: AiHealthReport | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Email alert cooldown tracker (provider -> timestamp of last alert)
const alertCooldowns = new Map<string, number>();
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per provider

/**
 * Sends a throttled early-warning email alert to ADMIN_ALERT_EMAIL
 * when an AI provider degrades or hits a limit.
 */
export async function notifyAiDegradation(
  provider: string,
  reason: string,
  fallbackAction?: string
) {
  const now = Date.now();
  const lastAlert = alertCooldowns.get(provider) || 0;
  if (now - lastAlert < ALERT_COOLDOWN_MS) {
    console.info(`[AIHealth] Alert cooldown active for ${provider}, skipping email.`);
    return;
  }

  alertCooldowns.set(provider, now);

  const subject = `[Aurikrex Alert] AI Provider Degraded — ${provider}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <h2 style="color: #e11d48; margin: 0 0 8px 0; font-size: 18px;">⚠️ Aurikrex AI Early Warning Alert</h2>
        <p style="margin: 0; color: #475569; font-size: 14px;">An AI provider used by Aurikrex Bytes is about to stop working or is operating on fallback.</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Provider:</strong></td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${provider}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;"><strong>Issue Detected:</strong></td>
          <td style="padding: 8px 0; color: #e11d48; font-weight: 600;">${reason}</td>
        </tr>
        ${fallbackAction ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b;"><strong>Fallback Action:</strong></td>
          <td style="padding: 8px 0; color: #2563eb;">${fallbackAction}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 8px 0; color: #64748b;"><strong>Detected At:</strong></td>
          <td style="padding: 8px 0; color: #0f172a;">${new Date().toISOString()}</td>
        </tr>
      </table>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
        <strong style="color: #0f172a;">Recommended Action:</strong>
        <p style="margin: 4px 0 0 0; color: #475569;">
          Log in to the provider's developer console (e.g. Mistral AI, NVIDIA NIM, or Cloudflare) to verify billing status, refresh API keys, or upgrade tier limits to prevent service interruption.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        This automated diagnostic alert was sent from the Aurikrex Bytes Newsroom System.
      </p>
    </div>
  `;

  try {
    await sendAdminAlertEmail(subject, html);
    console.info(`[AIHealth] Sent degradation alert email for ${provider}: ${reason}`);
  } catch (err) {
    console.error(`[AIHealth] Failed to send degradation alert email:`, err);
  }
}

/**
 * Runs a 1-token diagnostic ping against Mistral AI.
 */
async function checkMistral(): Promise<ProviderHealth> {
  const key = getMistralApiKey();
  if (!key) {
    return {
      name: "Mistral AI",
      status: "unconfigured",
      model: "mistral-small-latest",
      error: "MISTRAL_API_KEY is not set",
      lastChecked: new Date().toISOString(),
    };
  }

  // Probe primary model
  const models = ["mistral-small-latest", "open-mistral-7b"];
  let lastErr = "";
  let rateLimited = false;

  for (const model of models) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          name: "Mistral AI",
          status: rateLimited ? "degraded" : "healthy",
          model,
          latencyMs,
          error: rateLimited ? "mistral-small-latest hit 429, fell back to open-mistral-7b" : undefined,
          lastChecked: new Date().toISOString(),
        };
      } else if (res.status === 429) {
        rateLimited = true;
        lastErr = "HTTP 429 Rate limit exceeded";
        // Continue to check open-mistral-7b
      } else {
        lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 100)}`;
      }
    } catch (e: any) {
      lastErr = e.message || "Timeout / connection error";
    }
  }

  return {
    name: "Mistral AI",
    status: rateLimited ? "degraded" : "down",
    model: "mistral-small-latest",
    error: lastErr,
    rateLimited,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Runs a 1-token diagnostic ping against NVIDIA NIM.
 */
async function checkNvidia(): Promise<ProviderHealth> {
  const key = getNvidiaApiKey();
  if (!key) {
    return {
      name: "NVIDIA NIM",
      status: "unconfigured",
      model: "nvidia-nim",
      error: "NVIDIA_API_KEY is not set",
      lastChecked: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    // Ping models list to verify auth and account credit status
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return {
        name: "NVIDIA NIM",
        status: "healthy",
        model: "integrate.api.nvidia.com",
        latencyMs,
        lastChecked: new Date().toISOString(),
      };
    } else {
      const errText = (await res.text()).slice(0, 120);
      return {
        name: "NVIDIA NIM",
        status: "down",
        model: "integrate.api.nvidia.com",
        error: `HTTP ${res.status}: ${errText}`,
        quotaExhausted: res.status === 402 || res.status === 403,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (e: any) {
    return {
      name: "NVIDIA NIM",
      status: "down",
      model: "integrate.api.nvidia.com",
      error: e.message || "Timeout / connection error",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Runs a 1-token diagnostic ping against Cloudflare Workers AI.
 */
async function checkCloudflare(): Promise<ProviderHealth> {
  const configs = getCloudflareAiConfigs();
  if (configs.length === 0) {
    return {
      name: "Cloudflare Workers AI",
      status: "unconfigured",
      model: "@cf/meta/llama-3.1-70b-instruct",
      error: "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set",
      lastChecked: new Date().toISOString(),
    };
  }

  const cf = configs[0];
  const model = "@cf/meta/llama-3.1-70b-instruct";
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/${model}`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cf.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return {
        name: "Cloudflare Workers AI",
        status: "healthy",
        model,
        latencyMs,
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        name: "Cloudflare Workers AI",
        status: "down",
        model,
        error: `HTTP ${res.status}: ${(await res.text()).slice(0, 100)}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (e: any) {
    return {
      name: "Cloudflare Workers AI",
      status: "down",
      model,
      error: e.message || "Timeout / connection error",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Runs a minimal query probe against Tavily Search API.
 */
async function checkTavily(): Promise<ProviderHealth> {
  const key = (process.env.TAVILY_API_KEY || "").trim();
  if (!key) {
    return {
      name: "Tavily Search API",
      status: "unconfigured",
      model: "api.tavily.com",
      error: "TAVILY_API_KEY is not set",
      lastChecked: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: "technology news",
        max_results: 1,
        search_depth: "basic",
      }),
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return {
        name: "Tavily Search API",
        status: "healthy",
        model: "api.tavily.com",
        latencyMs,
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        name: "Tavily Search API",
        status: "down",
        model: "api.tavily.com",
        error: `HTTP ${res.status}: ${(await res.text()).slice(0, 100)}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (e: any) {
    return {
      name: "Tavily Search API",
      status: "down",
      model: "api.tavily.com",
      error: e.message || "Timeout / connection error",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Runs a comprehensive health probe across all AI services.
 * Uses cached result if within CACHE_TTL_MS unless forceLiveCheck is true.
 */
export async function checkAiHealth(options?: { forceLiveCheck?: boolean }): Promise<AiHealthReport> {
  const now = Date.now();
  if (!options?.forceLiveCheck && cachedHealthReport && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedHealthReport;
  }

  const [mistral, nvidia, cloudflare, tavily] = await Promise.all([
    checkMistral(),
    checkNvidia(),
    checkCloudflare(),
    checkTavily(),
  ]);

  const providers = [mistral, nvidia, cloudflare, tavily];

  // Determine active primary provider
  let activeProvider = "None";
  if (mistral.status === "healthy" || mistral.status === "degraded") {
    activeProvider = `Mistral AI (${mistral.model})`;
  } else if (nvidia.status === "healthy") {
    activeProvider = "NVIDIA NIM";
  } else if (cloudflare.status === "healthy") {
    activeProvider = "Cloudflare Workers AI";
  } else if (tavily.status === "healthy") {
    activeProvider = "Tavily Direct";
  }

  // Determine overall status
  const workingLlm = [mistral, nvidia, cloudflare].filter((p) => p.status === "healthy" || p.status === "degraded");
  let overallStatus: "healthy" | "degraded" | "critical" = "healthy";

  if (workingLlm.length === 0) {
    overallStatus = "critical";
  } else if (mistral.status === "degraded" || mistral.status === "down" || workingLlm.length === 1) {
    overallStatus = "degraded";
  }

  let summary = "All AI and search systems operational.";
  if (overallStatus === "critical") {
    summary = "CRITICAL: No AI LLM providers are currently responding. News generation and follow-up AI are offline.";
  } else if (overallStatus === "degraded") {
    const degradedNames = providers.filter((p) => p.status === "degraded" || p.status === "down").map((p) => p.name);
    summary = `Degraded: ${degradedNames.join(", ")} experiencing issues; requests are operating on fallback provider (${activeProvider}).`;
  }

  cachedHealthReport = {
    overallStatus,
    activeProvider,
    providers,
    summary,
    timestamp: new Date().toISOString(),
  };
  lastCheckTime = now;

  // Trigger alert if status degraded or critical
  if (overallStatus === "critical") {
    void notifyAiDegradation("All AI Providers", summary, "Check API keys on Vercel immediately");
  } else if (mistral.rateLimited) {
    void notifyAiDegradation("Mistral AI", "Rate limit exceeded (HTTP 429)", "Switched to open-mistral-7b / Cloudflare fallback");
  }

  return cachedHealthReport;
}
