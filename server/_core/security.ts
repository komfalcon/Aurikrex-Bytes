import type { NextFunction, Request, Response } from "express";

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS = 30;

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://accounts.google.com https://maps.googleapis.com; connect-src 'self' https: wss:; frame-src https://accounts.google.com; form-action 'self' https://accounts.google.com");
  if (process.env.NODE_ENV === "production" && process.env.APP_BASE_URL?.startsWith("https://")) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith("/api/trpc/")) return next();
  const route = req.originalUrl.split("?")[0];
  if (!/\/(reader\.(signup|login|requestPasswordReset|resetPassword|verifyEmail)|admin\.login)$/.test(route)) return next();
  const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${route}`;
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  else current.count += 1;
  const attempt = authAttempts.get(key)!;
  res.setHeader("RateLimit-Limit", AUTH_MAX_REQUESTS);
  res.setHeader("RateLimit-Remaining", Math.max(0, AUTH_MAX_REQUESTS - attempt.count));
  if (attempt.count > AUTH_MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ error: "Too many authentication requests. Please try again shortly." });
  }
  next();
}
