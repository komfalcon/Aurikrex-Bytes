import { OAuth2Client } from "google-auth-library";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { readers } from "../drizzle/schema";
import { createToken, randomToken } from "./auth";
import { getDb, getReaderByEmail } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookieValue = (name: string) => (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.split("=")[1] || "";
    const storedState = cookieValue("aurikrex_google_state");
    const storedNonce = cookieValue("aurikrex_google_nonce");
    if (!code || !state || !storedState || state !== decodeURIComponent(storedState) || !storedNonce || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.redirect("/login?error=oauth");
    res.clearCookie("aurikrex_google_state", { ...getSessionCookieOptions(req), maxAge: -1 });
    res.clearCookie("aurikrex_google_nonce", { ...getSessionCookieOptions(req), maxAge: -1 });
    try {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/auth/google/callback`);
      const { tokens } = await client.getToken(code); client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token || "", audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload(); if (!payload?.email || payload.nonce !== decodeURIComponent(storedNonce)) return res.redirect("/login?error=oauth");
      const db = await getDb(); if (!db) return res.redirect("/login?error=database");
      let reader = await getReaderByEmail(payload.email);
      if (!reader) { await db.insert(readers).values({ email: payload.email.toLowerCase(), googleId: payload.sub, emailVerified: true, verificationToken: null, passwordHash: null }); reader = await getReaderByEmail(payload.email); }
      else if (reader.googleId && reader.googleId !== payload.sub) return res.redirect("/login?error=oauth");
      else if (!reader.googleId) { await db.update(readers).set({ googleId: payload.sub, emailVerified: true, verificationToken: null }).where(eq(readers.id, reader.id)); }
      if (!reader) return res.redirect("/login?error=oauth");
      const session = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: true }, true);
      res.cookie("aurikrex_reader_session", session, { ...getSessionCookieOptions(req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      return res.redirect("/");
    } catch (error) { console.error("[Google OAuth] callback failed", error); return res.redirect("/login?error=oauth"); }
  });
}
