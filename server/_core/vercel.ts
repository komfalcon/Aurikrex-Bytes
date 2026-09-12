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
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
    try {
      return res.json({ published: await publishDuePosts() });
    } catch (error) {
      console.error("[Cron] publish failed", error);
      return res.status(500).json({ error: "Publish job failed" });
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
