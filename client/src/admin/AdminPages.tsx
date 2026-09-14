import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowUpRight, CalendarClock, Check, FilePlus2, LayoutDashboard, LogOut, Moon, Search, Shield, Sun, Trash2, Send, CheckSquare, Square } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Logo } from "../public/ReaderPages";
import { useTheme } from "../contexts/ThemeContext";
import NotFound from "../pages/NotFound";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="admin-icon-button" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.admin.login.useMutation({
    onSuccess: () => window.location.assign("/admin"),
    onError: () => window.location.assign("/404")
  });

  return (
    <main className="admin-auth">
      <div className="admin-auth-art">
        <Logo />
        <div>
          <span className="eyebrow">Private newsroom</span>
          <h1>Make the<br /><em>signal</em> matter.</h1>
          <p>A focused editorial desk for shaping the next considered brief.</p>
        </div>
        <span className="auth-quote">“Clarity is an editorial choice.”</span>
      </div>
      <section className="admin-auth-form">
        <div className="admin-auth-top">
          <Logo compact />
          <ThemeToggle />
        </div>
        <div className="admin-form-card">
          <span className="eyebrow">Newsroom access</span>
          <h2>Welcome back</h2>
          <p>Sign in to shape the next edition of Aurikrex Bytes.</p>
          <form onSubmit={e => { e.preventDefault(); login.mutate({ email, password, remember: true }); }}>
            <label>Email address
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
            <button className="button button-full" type="submit" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : <>Continue <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export function AdminFrame({ children, title, role, active }: { children: React.ReactNode; title?: string; role: string; active?: "inbox" | "new" | "team" | "analytics" }) {
  const items = [
    { href: "/admin", label: "Inbox", icon: LayoutDashboard, key: "inbox" },
    { href: "/admin/new", label: "New post", icon: FilePlus2, key: "new" },
    { href: "/admin/team", label: "Team", icon: Shield, key: "team" },
    { href: "/admin/analytics", label: "Analytics", icon: CalendarClock, key: "analytics" }
  ] as const;

  return (
    <main className="admin-app">
      <aside className="admin-rail">
        <div className="admin-brand">
          <Logo compact />
          <div className="admin-rail-title">Newsroom<span>Editorial workspace</span></div>
        </div>
        <nav aria-label="Admin navigation">
          {items.filter(item => role === "admin" || !(["team", "analytics"] as string[]).includes(item.key)).map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} className={active === item.key ? "active" : ""} href={item.href}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-rail-bottom">
          <Link href="/" className="public-brief-link">
            <ArrowUpRight size={15} /> <span>Public brief</span>
          </Link>
          <ThemeToggle />
        </div>
      </aside>
      <section className="admin-main">
        {title && (
          <header className="admin-header">
            <div>
              <span className="eyebrow">Editorial desk</span>
              <h1>{title}</h1>
            </div>
            <span className="admin-role-badge">{role}</span>
          </header>
        )}
        {children}
      </section>
    </main>
  );
}

const labels: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  scheduled: "Scheduled",
  published: "Published"
};

export function AdminDashboard() {
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  const posts = trpc.admin.posts.useQuery(undefined, { enabled: Boolean(session.data) });
  const utils = trpc.useUtils();

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchScheduleTime, setBatchScheduleTime] = useState("");
  const [showScheduleInput, setShowScheduleInput] = useState(false);

  const remove = trpc.admin.deletePost.useMutation({ onSuccess: () => void utils.admin.posts.invalidate() });
  const unschedule = trpc.admin.unschedulePost.useMutation({ onSuccess: () => void utils.admin.posts.invalidate() });

  const batchDelete = trpc.admin.batchDeletePosts.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      void utils.admin.posts.invalidate();
    }
  });

  const batchPublish = trpc.admin.batchPublishPosts.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      void utils.admin.posts.invalidate();
    }
  });

  const batchSchedule = trpc.admin.batchSchedulePosts.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      setShowScheduleInput(false);
      void utils.admin.posts.invalidate();
    }
  });

  if (session.isLoading) return <div className="admin-loading">Loading newsroom…</div>;
  if (!session.data || session.isError) return <NotFound />;

  const shown = (posts.data || []).filter((p: any) =>
    (filter === "all" || p.status === filter) &&
    (`${p.headline} ${p.body}`.toLowerCase().includes(query.toLowerCase()))
  );

  const allSelected = shown.length > 0 && shown.every((p: any) => selectedIds.includes(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(shown.map((p: any) => p.id));
    }
  }

  function toggleSelectOne(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }

  function handleBatchDelete() {
    if (!selectedIds.length) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected post(s)?`)) {
      batchDelete.mutate({ ids: selectedIds });
    }
  }

  function handleBatchPublish() {
    if (!selectedIds.length) return;
    if (confirm(`Publish ${selectedIds.length} selected post(s) immediately?`)) {
      batchPublish.mutate({ ids: selectedIds });
    }
  }

  function handleBatchScheduleSubmit() {
    if (!selectedIds.length || !batchScheduleTime) return;
    const date = new Date(batchScheduleTime);
    if (date <= new Date()) {
      alert("Please choose a future date and time for scheduling.");
      return;
    }
    batchSchedule.mutate({ ids: selectedIds, scheduledTime: date });
  }

  const busyBatch = batchDelete.isPending || batchPublish.isPending || batchSchedule.isPending;

  return (
    <AdminFrame title="Publishing inbox" role={session.data.role} active="inbox">
      <div className="admin-actions">
        <div className="admin-search">
          <Search size={16} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search posts" />
        </div>
        <Link className="button" href="/admin/new">
          New post <ArrowRight size={15} />
        </Link>
      </div>

      <div className="admin-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["scheduled", "Scheduled"],
            ["pending_review", "Pending review"],
            ["published", "Published"],
            ["draft", "Drafts"]
          ].map(([key, label]) => (
            <button className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>
              {label}
              <span>{key === "all" ? posts.data?.length : (posts.data || []).filter((p: any) => p.status === key).length}</span>
            </button>
          ))}
        </div>

        {shown.length > 0 && (
          <button
            type="button"
            className="button button-outline button-small"
            onClick={toggleSelectAll}
            style={{ fontWeight: 600 }}
          >
            {allSelected ? "Deselect All" : `Select All (${shown.length})`}
          </button>
        )}
      </div>

      {/* Sticky Batch Action Bar with Theme-Aware CSS Variables */}
      {selectedIds.length > 0 && (
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--blue)",
          padding: "0.85rem 1.25rem",
          borderRadius: "10px",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          color: "var(--ink)",
          boxShadow: "var(--shadow)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--ink)" }}>{selectedIds.length} post(s) selected</span>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={toggleSelectAll}
            >
              {allSelected ? "Deselect All" : `Select All (${shown.length})`}
            </button>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {session.data.role === "admin" && (
              <>
                <button
                  type="button"
                  className="button button-small"
                  onClick={handleBatchPublish}
                  disabled={busyBatch}
                >
                  <Send size={14} /> Publish Selected ({selectedIds.length})
                </button>

                {!showScheduleInput ? (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() => setShowScheduleInput(true)}
                    disabled={busyBatch}
                  >
                    <CalendarClock size={14} /> Schedule Selected
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <input
                      type="datetime-local"
                      value={batchScheduleTime}
                      onChange={e => setBatchScheduleTime(e.target.value)}
                      style={{ padding: "0.35rem 0.5rem", borderRadius: "6px", fontSize: "0.85rem", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
                    />
                    <button
                      type="button"
                      className="button button-small"
                      onClick={handleBatchScheduleSubmit}
                      disabled={busyBatch || !batchScheduleTime}
                    >
                      Confirm Schedule
                    </button>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={() => setShowScheduleInput(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}

            {session.data.role === "admin" && (
              <button
                type="button"
                className="danger-button button-small"
                onClick={handleBatchDelete}
                disabled={busyBatch}
              >
                <Trash2 size={14} /> Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      <section className="admin-table-card">
        <div className="admin-table-head" style={{ gridTemplateColumns: "40px 2fr 1fr 1fr 1fr" }}>
          <span style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={toggleSelectAll}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ cursor: "pointer" }}
              aria-label="Select all posts"
            />
          </span>
          <span>Story</span>
          <span>Status</span>
          <span>Updated</span>
          <span>Actions</span>
        </div>

        {shown.length ? (
          shown.map((post: any) => {
            const isSelected = selectedIds.includes(post.id);
            return (
              <div
                className="admin-table-row"
                key={post.id}
                style={{
                  gridTemplateColumns: "40px 2fr 1fr 1fr 1fr",
                  background: isSelected ? "var(--surface-2)" : undefined
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(post.id)}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                <div className="admin-story">
                  <div className="admin-thumb">
                    {post.imageUrl ? <img src={post.imageUrl} alt="" /> : <Spark />}
                  </div>
                  <div>
                    <Link href={`/admin/preview/${post.id}`}>
                      <strong>{post.headline}</strong>
                    </Link>
                    <small>{post.body.slice(0, 90)}{post.body.length > 90 ? "…" : ""}</small>
                  </div>
                </div>

                <span className={`status-badge ${post.status}`}>{labels[post.status]}</span>
                <span className="admin-date">
                  {post.scheduledTime ? new Date(post.scheduledTime).toLocaleString() : new Date(post.updatedAt).toLocaleDateString()}
                </span>

                <div className="row-actions">
                  <Link className="button button-outline button-small" href={`/admin/preview/${post.id}`}>
                    Preview
                  </Link>
                  {post.status === "scheduled" && session.data.role === "admin" && (
                    <button className="button button-outline button-small" onClick={() => unschedule.mutate({ id: post.id })}>
                      Cancel
                    </button>
                  )}
                  {session.data.role === "admin" && (
                    <button className="danger-button" onClick={() => remove.mutate({ id: post.id })} aria-label="Delete post">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="admin-empty">
            <Check size={20} />
            <h2>No posts in this view</h2>
            <p>Try another filter or create a new draft.</p>
          </div>
        )}
      </section>
    </AdminFrame>
  );
}

function Spark() {
  return <span className="spark-mark">✦</span>;
}
