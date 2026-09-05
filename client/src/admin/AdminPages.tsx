import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import NotFound from "../pages/NotFound";

const filters = ["today", "scheduled", "pending_review", "published", "draft", "all"] as const;
type Filter = typeof filters[number];
const filterLabels: Record<Filter, string> = { today: "Today", scheduled: "Scheduled", pending_review: "Pending Review", published: "Published", draft: "Drafts", all: "All" };
const statusLabels: Record<string, string> = { draft: "Draft", pending_review: "Pending Review", scheduled: "Scheduled", published: "Published" };

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function isToday(value: Date | string | null | undefined) {
  if (!value) return false;
  const date = new Date(value); const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function AdminLogin() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const login = trpc.admin.login.useMutation({ onSuccess: () => location.assign("/admin"), onError: () => location.assign("/404") });
  return <main className="auth-wrap"><section className="auth-panel newsroom"><p className="eyebrow">Newsroom</p><h1>Editorial access</h1><form onSubmit={e => { e.preventDefault(); login.mutate({ email, password, remember: true }); }}><label>Email<input type="email" onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" onChange={e => setPassword(e.target.value)} required /></label><label className="check"><input type="checkbox" defaultChecked /> Remember this device</label><button className="button" type="submit">Continue</button></form></section></main>;
}

function PostActions({ post, isAdmin, onError }: { post: any; isAdmin: boolean; onError: (message: string) => void }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.admin.posts.invalidate();
  const remove = trpc.admin.deletePost.useMutation({ onSuccess: invalidate, onError: error => onError(error.message) });
  const unschedule = trpc.admin.unschedulePost.useMutation({ onSuccess: invalidate, onError: error => onError(error.message) });
  const reject = trpc.admin.rejectPost.useMutation({ onSuccess: invalidate, onError: error => onError(error.message) });
  if (!isAdmin) return null;
  return <div className="inbox-actions">
    {post.status === "scheduled" && <button className="text-button" onClick={() => unschedule.mutate({ id: post.id })}>Cancel schedule</button>}
    {post.status === "pending_review" && <><Link className="text-button approve" href={`/admin/preview/${post.id}?role=admin`}>Review &amp; approve</Link><button className="text-button" onClick={() => { const note = window.prompt("Optional rejection note", ""); if (note !== null) reject.mutate({ id: post.id, rejectionNote: note || undefined }); }}>Reject</button></>}
    <button className="text-button danger" onClick={() => { if (window.confirm(`Delete “${post.headline}”? This cannot be undone.`)) remove.mutate({ id: post.id }); }}>Delete</button>
  </div>;
}

export function AdminDashboard() {
  const session = trpc.admin.session.useQuery();
  const posts = trpc.admin.posts.useQuery(undefined, { enabled: Boolean(session.data) });
  const [filter, setFilter] = useState<Filter>("all"); const [error, setError] = useState("");
  const message = new URLSearchParams(location.search).get("message");
  const postList = posts.data ?? [];
  const pendingCount = postList.filter(post => post.status === "pending_review").length;
  const visiblePosts = useMemo(() => postList.filter(post => {
    if (filter === "all") return true;
    if (filter === "today") return isToday(post.updatedAt) || isToday(post.scheduledTime) || isToday(post.publishedTime);
    return post.status === filter;
  }), [filter, postList]);
  if (session.isLoading) return <main className="auth-wrap"><p className="muted">Loading newsroom…</p></main>;
  if (!session.data) return <NotFound />;
  const isAdmin = session.data.role === "admin";
  return <main className="admin-shell"><aside><p className="eyebrow">Aurikrex Bytes</p><h2>Newsroom</h2><p className="muted admin-role">{session.data.role}</p><Link href="/">View public brief</Link></aside><section className="admin-content inbox-page">
    <header className="inbox-header"><div><p className="eyebrow">Editorial desk</p><h1>Inbox</h1><p className="muted">Every story in the newsroom, ready for its next move.</p></div><Link className="new-post-button" href="/admin/new">+ New Post</Link></header>
    {(error || message) && <div className="inbox-error success-message" role="status">{error || ({ submitted: "Post submitted for review.", published: "Post published.", scheduled: "Post scheduled.", approved: "Post approved and published.", rejected: "Post rejected and returned to drafts." } as Record<string, string>)[message || ""]}<button onClick={() => setError("")} aria-label="Dismiss message">×</button></div>}
    <nav className="inbox-filters" aria-label="Post filters">{filters.map(item => <button key={item} className={`filter-chip ${filter === item ? "active" : ""} ${item === "pending_review" && pendingCount > 0 ? "needs-review" : ""}`} onClick={() => setFilter(item)}>{filterLabels[item]}{item === "pending_review" && pendingCount > 0 && <span className="filter-count">{pendingCount}</span>}</button>)}</nav>
    <div className="inbox-summary"><span>{visiblePosts.length} {visiblePosts.length === 1 ? "post" : "posts"}</span>{filter !== "all" && <button className="clear-filter" onClick={() => setFilter("all")}>Clear filter</button>}</div>
    <section className="inbox-list" aria-live="polite">{posts.isLoading ? <div className="table-card inbox-empty">Loading posts…</div> : visiblePosts.length === 0 ? <div className="table-card inbox-empty"><h2>No posts here yet</h2><p className="muted">Try another filter or create a new draft.</p></div> : visiblePosts.map(post => <article className="inbox-row" key={post.id}><div className="post-thumb">{post.imageUrl ? <img src={post.imageUrl} alt="" /> : <span aria-hidden="true">AB</span>}</div><div className="post-main"><h2>{post.headline}</h2><div className="post-meta"><span className={`status-badge ${post.status}`}>{statusLabels[post.status]}</span>{post.status === "scheduled" && post.scheduledTime && <span className="scheduled-time">Scheduled {formatDate(post.scheduledTime)}</span>}</div></div><PostActions post={post} isAdmin={isAdmin} onError={setError} /></article>)}</section>
  </section></main>;
}

export function NewPostPlaceholder() {
  const session = trpc.admin.session.useQuery();
  if (session.isLoading) return <main className="auth-wrap"><p className="muted">Loading newsroom…</p></main>;
  if (!session.data) return <NotFound />;
  return <main className="admin-shell"><aside><p className="eyebrow">Aurikrex Bytes</p><h2>Newsroom</h2><p className="muted admin-role">{session.data.role}</p><Link href="/admin">Back to inbox</Link></aside><section className="admin-content"><p className="eyebrow">Editorial desk</p><h1>New Post</h1><div className="table-card"><h2>Post editor coming next</h2><p className="muted">The full publishing form will be available in Chunk 4.</p><Link className="outline-button" href="/admin">Return to inbox</Link></div></section></main>;
}
