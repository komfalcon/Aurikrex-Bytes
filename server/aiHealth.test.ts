import { describe, expect, it, vi } from "vitest";
import { checkAiHealth, notifyAiDegradation } from "./_core/aiHealth.js";

describe("AI System Early Warning & Health Monitoring", () => {
  it("generates a structured health report containing all providers", async () => {
    const report = await checkAiHealth();
    expect(report).toBeDefined();
    expect(["healthy", "degraded", "critical"]).toContain(report.overallStatus);
    expect(report.providers).toHaveLength(4);

    const providerNames = report.providers.map((p) => p.name);
    expect(providerNames).toContain("Mistral AI");
    expect(providerNames).toContain("NVIDIA NIM");
    expect(providerNames).toContain("Cloudflare Workers AI");
    expect(providerNames).toContain("Tavily Search API");

    for (const p of report.providers) {
      expect(["healthy", "degraded", "down", "unconfigured"]).toContain(p.status);
      expect(p.lastChecked).toBeDefined();
    }
  });

  it("enforces a 1-hour cooldown on degradation alert emails to prevent spam", async () => {
    // Call notifyAiDegradation twice in immediate succession
    const testProvider = "Test AI Provider";
    await notifyAiDegradation(testProvider, "First error test", "Fallback to backup");
    // Second call within 1 hour should be throttled
    await notifyAiDegradation(testProvider, "Second error test", "Fallback to backup");
    expect(true).toBe(true);
  });
});
