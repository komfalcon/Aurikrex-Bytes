import { OAuth2Client } from "google-auth-library";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { readers } from "../drizzle/schema.js";
import { createToken, randomToken, verifyOAuthState } from "./auth.js";
import { getDb, getReaderByEmail } from "./db.js";
import { getFirstPartyCookieOptions, getSessionCookieOptions } from "./_core/cookies.js";
import { appBaseUrl } from "./_core/env.js";

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/callback", async (req, res) => {
    const errorParam = typeof req.query.error === "string" ? req.query.error : "";
    const errorDesc = typeof req.query.error_description === "string" ? req.query.error_description : "";
    if (errorParam) {
      console.error("[Google OAuth] Google returned error callback:", errorParam, errorDesc);
      return res.redirect(`/login?error=oauth&reason=${encodeURIComponent(errorParam + (errorDesc ? `: ${errorDesc}` : ""))}`);
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    if (!code) {
      console.error("[Google OAuth] missing authorization code");
      return res.redirect("/login?error=oauth&reason=Missing+authorization+code+from+Google");
    }

    if (!state) {
      console.error("[Google OAuth] missing state parameter");
      return res.redirect("/login?error=oauth&reason=Missing+OAuth+state+parameter");
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("[Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured on the server");
      return res.redirect("/login?error=oauth&reason=Google+OAuth+credentials+not+configured+on+server");
    }

    // Verify state token statelessly (JWT signed by our server) or fallback to cookie
    const cookieValue = (name: string) => (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.split("=")[1] || "";
    const storedState = cookieValue("aurikrex_google_state");
    const storedNonce = cookieValue("aurikrex_google_nonce");

    res.clearCookie("aurikrex_google_state", { ...getSessionCookieOptions(req), maxAge: -1 });
    res.clearCookie("aurikrex_google_nonce", { ...getSessionCookieOptions(req), maxAge: -1 });

    const verifiedState = verifyOAuthState(state);
    let expectedNonce = verifiedState?.nonce;

    if (!expectedNonce && storedState && storedNonce && state === decodeURIComponent(storedState)) {
      expectedNonce = decodeURIComponent(storedNonce);
    }

    if (!expectedNonce) {
      console.error("[Google OAuth] state verification failed - token invalid/expired and no matching cookie");
      return res.redirect("/login?error=oauth&reason=OAuth+session+expired+or+invalid.+Please+try+again.");
    }

    try {
      const redirectUri = `${appBaseUrl()}/api/auth/google/callback`;
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token || "", audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();

      if (!payload?.email) {
        console.error("[Google OAuth] ID token payload missing email");
        return res.redirect("/login?error=oauth&reason=Google+account+did+not+provide+an+email+address");
      }

      if (payload.nonce && payload.nonce !== expectedNonce) {
        console.error("[Google OAuth] nonce mismatch");
        return res.redirect("/login?error=oauth&reason=Security+nonce+mismatch.+Please+try+again.");
      }

      const db = await getDb();
      if (!db) {
        console.error("[Google OAuth] database unavailable");
        return res.redirect("/login?error=database&reason=Database+unavailable");
      }

      const googleName = payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ");
      const googlePicture = payload.picture || null;
      let reader = await getReaderByEmail(payload.email);
      if (!reader) {
        await db.insert(readers).values({
          name: googleName,
          email: payload.email.toLowerCase(),
          googleId: payload.sub,
          avatarUrl: googlePicture,
          emailVerified: true,
          verificationToken: null,
          passwordHash: null,
        });
        reader = await getReaderByEmail(payload.email);
      } else if (reader.googleId && reader.googleId !== payload.sub) {
        console.error("[Google OAuth] reader googleId mismatch with email", reader.email);
        return res.redirect("/login?error=oauth&reason=Email+is+already+associated+with+a+different+Google+account");
      } else {
        await db.update(readers).set({
          googleId: payload.sub,
          name: reader.name?.trim() ? reader.name : googleName,
          avatarUrl: reader.avatarUrl || googlePicture,
          emailVerified: true,
          verificationToken: null,
        }).where(eq(readers.id, reader.id));
      }

      if (!reader) {
        return res.redirect("/login?error=oauth&reason=Failed+to+create+reader+account");
      }

      const session = createToken({ kind: "reader", id: reader.id, email: reader.email, verified: true }, true);
      res.cookie("aurikrex_reader_session", session, { ...getFirstPartyCookieOptions(req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      return res.redirect("/dashboard");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Google OAuth] callback failed:", errMsg);
      return res.redirect(`/login?error=oauth&reason=${encodeURIComponent(errMsg)}`);
    }
  });
}
