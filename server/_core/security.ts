import type { NextFunction, Request, Response } from "express";

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS = 30;

type FailedAttemptRecord = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
  resetSent: boolean;
};

const failedAttemptsMap = new Map<string, FailedAttemptRecord>();
export const MAX_FAILED_BEFORE_LOCKOUT = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_FAILED_BEFORE_AUTO_RESET = 8;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://accounts.google.com https://maps.googleapis.com; connect-src 'self' https://maps.googleapis.com https://api.cloudinary.com wss:; frame-src https://accounts.google.com; form-action 'self' https://accounts.google.com");
  if (process.env.NODE_ENV === "production" && process.env.APP_BASE_URL?.startsWith("https://")) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith("/api/trpc/")) return next();
  const route = req.originalUrl.split("?")[0];
  if (!/\/(reader\.(signup|login|requestPasswordReset|resetPassword|verifyEmail)|admin\.login)$/.test(route)) return next();
  const key = `${req.ip || req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "unknown"}:${route}`;
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

export function checkPasswordAttemptLockout(email: string): { locked: boolean; message?: string; autoResetTriggered?: boolean } {
  const normEmail = email.trim().toLowerCase();
  const record = failedAttemptsMap.get(normEmail);
  if (!record) return { locked: false };

  const now = Date.now();

  // Check if lockout active
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    const minutes = Math.ceil(remainingSec / 60);
    return {
      locked: true,
      message: record.resetSent
        ? "Account temporarily locked due to multiple failed login attempts. A password reset link has been sent to your email address."
        : `Too many failed password attempts. Account temporarily locked for ${minutes} minute${minutes > 1 ? "s" : ""}. Please try again later or reset your password.`,
      autoResetTriggered: record.resetSent,
    };
  }

  // Clear if attempt window expired
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || record.lockedUntil <= now)) {
    failedAttemptsMap.delete(normEmail);
    return { locked: false };
  }

  if (record.count >= MAX_FAILED_BEFORE_LOCKOUT) {
    if (!record.lockedUntil || record.lockedUntil <= now) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    const minutes = Math.ceil(remainingSec / 60);
    return {
      locked: true,
      message: record.resetSent
        ? "Account temporarily locked due to multiple failed login attempts. A password reset link has been sent to your email address."
        : `Too many failed password attempts. Account temporarily locked for ${minutes} minute${minutes > 1 ? "s" : ""}. Please try again later or reset your password.`,
      autoResetTriggered: record.resetSent,
    };
  }

  return { locked: false };
}

export function recordFailedPasswordAttempt(email: string): { count: number; locked: boolean; autoResetNeeded: boolean; message: string } {
  const normEmail = email.trim().toLowerCase();
  const now = Date.now();
  let record = failedAttemptsMap.get(normEmail);

  if (!record || now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    record = { count: 1, firstAttemptAt: now, lockedUntil: null, resetSent: false };
  } else {
    record.count += 1;
  }

  let locked = false;
  let autoResetNeeded = false;
  let message = "Invalid email or password";

  if (record.count >= MAX_FAILED_BEFORE_AUTO_RESET) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    locked = true;
    if (!record.resetSent) {
      autoResetNeeded = true;
      record.resetSent = true;
    }
    message = "Account locked due to multiple failed login attempts. A password reset link has been automatically sent to your email address.";
  } else if (record.count >= MAX_FAILED_BEFORE_LOCKOUT) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    locked = true;
    message = "Too many failed password attempts. Account temporarily locked for 15 minutes. Please try again later or reset your password.";
  } else {
    const remaining = MAX_FAILED_BEFORE_LOCKOUT - record.count;
    message = `Invalid email or password. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining before temporary account lock.`;
  }

  failedAttemptsMap.set(normEmail, record);
  return { count: record.count, locked, autoResetNeeded, message };
}

export function resetPasswordAttempts(email: string) {
  failedAttemptsMap.delete(email.trim().toLowerCase());
}

export function clearAllAuthRateLimitStores() {
  authAttempts.clear();
  failedAttemptsMap.clear();
}
