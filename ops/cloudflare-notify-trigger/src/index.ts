export interface Env {
  CRON_SECRET: string;
  NOTIFY_URL?: string;
}

const DEFAULT_NOTIFY_URL = "https://www.bytes.aurikrex.com/api/cron/notify";

async function triggerNotify(env: Env, attempt = 1): Promise<Response> {
  const url = env.NOTIFY_URL || DEFAULT_NOTIFY_URL;
  return await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "X-Trigger-Source": "cloudflare",
      Accept: "application/json",
      "User-Agent": `Aurikrex-Cloudflare-Cron/1.0 (attempt=${attempt})`,
    },
  });
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[Cloudflare Cron] Triggered for schedule: ${controller.cron}`);

    try {
      let res = await triggerNotify(env, 1);
      console.log(`[Cloudflare Cron] Initial attempt status: ${res.status}`);

      // Retry once after 30s on non-2xx
      if (!res.ok) {
        console.warn(
          `[Cloudflare Cron] Non-2xx status (${res.status}). Retrying once after 30 seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        res = await triggerNotify(env, 2);
        console.log(`[Cloudflare Cron] Retry attempt status: ${res.status}`);
      }

      const body = await res.text();
      console.log(`[Cloudflare Cron] Response body: ${body}`);

      if (!res.ok) {
        throw new Error(`Notify API returned HTTP ${res.status}: ${body}`);
      }
    } catch (err) {
      console.error("[Cloudflare Cron] Execution failed:", err);
      throw err;
    }
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "POST" || req.method === "GET") {
      const res = await triggerNotify(env);
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Method not allowed", { status: 405 });
  },
};
