import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { registerStorageProxy } from "./storageProxy.js";
import { registerGoogleAuthRoutes } from "../google-auth.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { registerSeoRoutes } from "./seoRoutes.js";
import { authRateLimit, safeCompareSecrets, securityHeaders } from "./security.js";
import { validateProductionEnvironment } from "./env.js";
import { publishDuePosts } from "../db.js";

async function setupApp() {
  const environmentIssues = validateProductionEnvironment();
  if (environmentIssues.length) {
    console.error(`[Environment] Production configuration incomplete: ${environmentIssues.join("; ")}`);
  }
  const app = express();
  app.set("trust proxy", 1);
  app.use((req, _res, next) => {
    const matchedPath = req.headers["x-matched-path"] as string | undefined;
    if (matchedPath && (matchedPath === "/sitemap.xml" || matchedPath === "/robots.txt" || matchedPath.endsWith("/sitemap.xml"))) {
      req.url = matchedPath;
    }
    next();
  });
  app.use(securityHeaders);
  app.use(cors({
    origin: ["https://bytes.aurikrex.com", "https://www.bytes.aurikrex.com", "https://cbt.aurikrex.com", "https://aurikrex.com", "https://aurikrex-central.pxxl.click", "https://bytes.pxxl.click"],
    credentials: true,
  }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerSeoRoutes(app);

  const isCronAuthorized = (req: express.Request) => {
    const authorization = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !authorization) return false;
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
    return Boolean(token && safeCompareSecrets(token, cronSecret));
  };

  app.get("/api/cron/publish", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isCronAuthorized(req)) {
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
    res.setHeader("Cache-Control", "no-store");
    if (!isCronAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const requestedSlot =
      typeof req.query.slot === "string" ? req.query.slot : undefined;
    const dryRun = req.query.dryRun === "1";
    const testOnly = req.query.testOnly === "1";
    const triggerSource =
      (req.headers["x-trigger-source"] as string) ||
      (req.query.triggerSource as string) ||
      "vercel";

    try {
      const { processPushTrigger } = await import("../push.js");
      const result = await processPushTrigger({
        requestedSlot,
        triggerSource,
        dryRun,
        testOnly,
      });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[Cron] notify failed", error);
      return res.status(500).json({
        error: "Notify job failed",
        message: error?.message || String(error),
      });
    }
  });

  app.get("/api/cron/curate", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isCronAuthorized(req)) {
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
      error: "Internal Server Error",
    });
  }
}
