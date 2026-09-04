import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";

export type SessionPayload = { kind: "admin" | "reader"; id: number; email: string; role?: "admin" | "editor"; verified?: boolean };

const secret = () => ENV.cookieSecret || "development-only-secret";

export function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export function createToken(payload: SessionPayload, remember = false) { return jwt.sign(payload, secret(), { expiresIn: remember ? "30d" : "12h" }); }
export function readToken(token: string): SessionPayload | null {
  try { return jwt.verify(token, secret()) as SessionPayload; } catch { return null; }
}
export function randomToken() { return crypto.randomBytes(32).toString("hex"); }
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function isValidPassword(password: string) { return password.length >= 8; }
