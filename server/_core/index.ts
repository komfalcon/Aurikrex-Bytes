import "dotenv/config";
import express from "express";
import { createServer, type Server } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerGoogleAuthRoutes } from "../google-auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSeoRoutes } from "./seoRoutes";
import { authRateLimit, securityHeaders } from "./security";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function setupApp() {
  const app = express();
  let server: Server | undefined;
  if (!process.env.VERCEL) {
    server = createServer(app);
  }
  // Configure body parser with larger size limit for file uploads
  app.use(securityHeaders);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerSeoRoutes(app);
  app.use(authRateLimit);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Skip static serving if on Vercel (Vercel Edge handles it)
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server!);
    } else {
      serveStatic(app);
    }
  }
  return { app, server };
}

let cachedApp: express.Express | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      const { app } = await setupApp();
      cachedApp = app;
    }
    return cachedApp(req, res);
  } catch (error) {
    console.error("Vercel Edge Handler Error:", error);
    res.status(500).json({ error: "Fatal Vercel Handler Error", message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  }
}

async function startServer() {
  const { server } = await setupApp();
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server!.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (!process.env.VERCEL) startServer().catch(console.error);
