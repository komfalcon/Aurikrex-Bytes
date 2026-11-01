import React, { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Logo, PublicLayout } from "../public/ReaderPages";

export default function SsoCallbackPage() {
  const [error, setError] = useState("");
  const ssoExchange = trpc.auth.ssoExchange.useMutation();

  useEffect(() => {
    async function handleSso() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (!code) {
        setError("Missing authorization code from Identity Provider.");
        return;
      }

      try {
        await ssoExchange.mutateAsync({
          code,
          redirect_uri: window.location.origin + "/sso/callback",
        });
        window.location.href = "/";
      } catch (err: any) {
        setError(err.message || "Single Sign-On authentication failed");
      }
    }

    handleSso();
  }, []);

  return (
    <PublicLayout
      seo={{
        title: "Aurikrex SSO — Aurikrex Bytes",
        description: "Authenticating your Aurikrex ID session.",
        path: "/sso/callback",
        robots: "noindex,nofollow",
      }}
    >
      <main className="container page-main">
        <div className="empty-state px-not-found-card" style={{ maxWidth: "480px", margin: "40px auto" }}>
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
            <Logo compact />
          </div>
          {error ? (
            <>
              <div className="empty-icon" style={{ color: "#ef4444" }}>
                <ShieldAlert size={24} />
              </div>
              <span className="eyebrow">Identity Verification</span>
              <h2>SSO Authentication Failed</h2>
              <p>{error}</p>
              <Link href="/login" className="button" style={{ marginTop: "8px" }}>
                <span>Return to Sign In</span>
                <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <>
              <div className="empty-icon">
                <RefreshCw size={22} className="animate-spin" />
              </div>
              <span className="eyebrow">Aurikrex ID</span>
              <h2>Authenticating your session…</h2>
              <p>Exchanging secure session tokens with the Aurikrex identity provider.</p>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}
