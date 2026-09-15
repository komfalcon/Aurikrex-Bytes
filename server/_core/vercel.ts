import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { registerStorageProxy } from "./storageProxy.js";
import { registerGoogleAuthRoutes } from "../google-auth.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { registerSeoRoutes } from "./seoRoutes.js";
import { authRateLimit, securityHeaders } from "./security.js";
import { validateProductionEnvironment } from "./env.js";
import { publishDuePosts } from "../db.js";

async function setupApp() {
  const environmentIssues = validateProductionEnvironment();
  if (environmentIssues.length) {
    console.error(`[Environment] Production configuration incomplete: ${environmentIssues.join("; ")}`);
  }
  const app = express();
  app.use(securityHeaders);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerSeoRoutes(app);

  app.get("/api/cron/publish", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      return res.json({ published: await publishDuePosts() });
    } catch (error) {
      console.error("[Cron] publish failed", error);
      return res.status(500).json({ error: "Publish job failed" });
    }
  });

  app.get("/api/cron/notify", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { sendDailyPushNotifications } = await import("../push.js");
      const sent = await sendDailyPushNotifications();
      return res.json({ sent });
    } catch (error) {
      console.error("[Cron] notify failed", error);
      return res.status(500).json({ error: "Notify job failed" });
    }
  });

  app.get("/api/cron/curate", async (req, res) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (cronSecret && authorization !== `Bearer ${cronSecret}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { runNightlyCuration } = await import("./aiCurator.js");
      const curated = await runNightlyCuration();
      return res.json({ curated });
    } catch (error) {
      console.error("[Cron] curate failed", error);
      return res.status(500).json({ error: "Curation job failed" });
    }
  });

  app.use(authRateLimit);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

let cachedApp: express.Express | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) cachedApp = await setupApp();
    return cachedApp(req, res);
  } catch (error) {
    console.error("Vercel Handler Error:", error);
    res.status(500).json({
      error: "Fatal Vercel Handler Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
