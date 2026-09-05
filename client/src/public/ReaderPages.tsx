import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, Check, LockKeyhole, Sparkles } from "lucide-react";
import { trpc } from "../lib/trpc";
import { authRoutes, authTitles, type ReaderAuthMode } from "../shared/authUi";
import { BrandMark, SiteFooter, SiteHeader, ThemeToggle } from "../components/Brand";

function BriefPreview() {
  return <div className="brief-preview" aria-label="Preview of a daily briefing card">
    <div className="preview-topline"><span className="preview-dot" /> <span>Issue 014 · Monday, 08:40</span><span className="preview-rule" /></div>
    <div className="preview-kicker">The signal / 01</div>
    <h3>What deserves your attention today?</h3>
    <p>Three sharp reads, one calm point of view, and just enough context to start the day with a clearer head.</p>
    <div className="preview-bottom"><span>6 min read</span><span className="preview-arrow"><ArrowUpRight size={15} /></span></div>
  </div>;
}

export function Home() {
  const posts = trpc.publicPosts.list.useQuery();
  const published = posts.data?.filter((post) => post.status === "published") ?? [];
  return <main className="public-page">
    <SiteHeader action={<Link className="header-cta" href={authRoutes.login}>Reader access <ArrowUpRight size={15} /></Link>} />
    <section className="hero-shell">
      <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> Independent editorial briefing</p><h1>Better signal.<br /><em>Less noise.</em></h1><p className="hero-lede">A beautifully edited daily briefing for people who want to understand what matters — without giving their whole day to it.</p><div className="hero-actions"><Link className="primary-button" href={authRoutes.signup}>Join the briefing <ArrowUpRight size={16} /></Link><a className="text-link" href="#briefing">See the format <span>↓</span></a></div><div className="hero-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><p>Read by <strong>2,400+</strong> curious people</p></div></div>
      <div className="hero-visual"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><BriefPreview /><div className="visual-note"><Sparkles size={15} /> <span>Thoughtful by design</span></div></div>
    </section>
    <section className="principles-band" id="principles"><div><p className="eyebrow">A different kind of brief</p><h2>Small enough to finish.<br /><em>Rich enough to remember.</em></h2></div><p className="principles-copy">We believe the best briefing is not the loudest one. It is a calm, human edit: the essential context, a useful point of view, and a little room to think.</p></section>
    <section className="stories-section" id="briefing"><div className="section-heading"><div><p className="eyebrow">From the newsroom</p><h2>Recent signals</h2></div><span className="section-count">01 — 03</span></div><div className="story-grid">{published.map((post, index) => <article className="story-card" key={post.id}><div className="story-card-top"><span>0{index + 1}</span><span>{post.status}</span></div><h3>{post.headline}</h3><p>{post.body}</p><a href={authRoutes.signup} className="story-link">Read the brief <ArrowUpRight size={15} /></a></article>)}{!published.length && <article className="story-card story-card--empty"><div className="story-card-top"><span>01</span><span>Coming soon</span></div><h3>The briefing is taking shape.</h3><p>Join the reader list and be first to receive the next considered edit from the newsroom.</p><Link href={authRoutes.signup} className="story-link">Join the reader list <ArrowUpRight size={15} /></Link></article>}<div className="story-aside"><span className="aside-number">03</span><p>One daily email.<br /><em>No doomscrolling.</em></p><span className="aside-mark">Issue 014 / 26</span></div></div></section>
    <SiteFooter />
  </main>;
}

export function ReaderAuth({ mode }: { mode: ReaderAuthMode }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [token] = useState(() => new URLSearchParams(location.search).get("token") || ""); const [message, setMessage] = useState("");
  const login = trpc.reader.login.useMutation({ onSuccess: (result) => setMessage(result.emailVerified ? "Welcome back." : "Please verify your email before accessing all stories."), onError: (e) => setMessage(e.message) });
  const signup = trpc.reader.signup.useMutation({ onSuccess: () => setMessage("Check your inbox for a verification link."), onError: (e) => setMessage(e.message) });
  const forgot = trpc.reader.requestPasswordReset.useMutation({ onSuccess: () => setMessage("If that address exists, a reset link is on its way.") });
  const reset = trpc.reader.resetPassword.useMutation({ onSuccess: () => { setMessage("Password updated. You can sign in now."); navigate("/login"); }, onError: (e) => setMessage(e.message) });
  const verify = trpc.reader.verifyEmail.useMutation({ onSuccess: () => setMessage("Email verified. You can sign in now."), onError: (e) => setMessage(e.message) });
  const google = trpc.reader.googleStart.useQuery(undefined, { enabled: mode === "login" });
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (mode === "login") login.mutate({ email, password, remember: true }); if (mode === "signup") signup.mutate({ email, password }); if (mode === "forgot") forgot.mutate({ email }); if (mode === "reset") reset.mutate({ token, password }); if (mode === "verify") verify.mutate({ token }); };
  const loading = login.isPending || signup.isPending || forgot.isPending || reset.isPending || verify.isPending;
  return <main className="auth-page"><header className="auth-header"><BrandMark /><ThemeToggle /></header><div className="auth-layout"><aside className="auth-story"><p className="eyebrow"><span className="eyebrow-line" /> The Aurikrex edit</p><h2>A calmer way<br />to stay <em>curious.</em></h2><BriefPreview /><p className="auth-aside-note"><LockKeyhole size={15} /> Your inbox, never your attention, is the product.</p></aside><section className="auth-panel"><div className="auth-panel-inner"><p className="eyebrow">{mode === "login" ? "Welcome back" : "Aurikrex Bytes"}</p><h1>{authTitles[mode]}</h1><p className="auth-intro">{mode === "signup" ? "A considered daily read for people who want signal without the noise." : "Pick up where you left off with the daily briefing."}</p>{mode === "verify" ? <button className="primary-button full-width" onClick={() => verify.mutate({ token })} disabled={loading}>Verify email <ArrowUpRight size={16} /></button> : <form className="auth-form" onSubmit={submit}>{mode !== "reset" && <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>}{mode !== "forgot" && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></label>}<button className="primary-button full-width" type="submit" disabled={loading}>{mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : "Sign in"} <ArrowUpRight size={16} /></button></form>}{mode === "login" && <><div className="auth-divider"><span>or</span></div><a className="secondary-button full-width" href={google.data?.url || "/login"}>Continue with Google</a><div className="auth-links"><Link href={authRoutes.signup}>Create an account</Link><Link href={authRoutes.forgotPassword}>Forgot password?</Link></div></>}{mode === "signup" && <div className="auth-links"><Link href={authRoutes.login}>Already a reader? Sign in</Link></div>}<p className="form-message" role="status">{message}</p><p className="auth-legal">By continuing, you agree to receive the Aurikrex Bytes briefing. Unsubscribe anytime.</p></div></section></div></main>;
}
