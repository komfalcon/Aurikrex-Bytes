import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import NotFound from "../pages/NotFound";
import { AdminFrame } from "./AdminPages";
import { Bell, BellRing, RefreshCw, Send, Mail, CheckCircle2, AlertCircle, Clock, Smartphone, Layers, Check } from "lucide-react";
import { toast } from "sonner";
import { getOneSignal, waitForSubscriptionId } from "../lib/pushClient";

function ManagementFrame({ children, title, active }: { children: React.ReactNode; title: string; active: "team" | "analytics" | "notifications" }) {
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  if (session.isLoading) return <main className="auth-wrap"><p className="muted">Loading newsroom…</p></main>;
  if (!session.data || session.data.role !== "admin") return <NotFound />;
  return <AdminFrame role={session.data.role} title={title} active={active}>{children}</AdminFrame>;
}

export function TeamManagement() {
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const members = trpc.admin.users.list.useQuery(undefined, { enabled: session.data?.role === "admin" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [message, setMessage] = useState("");
  const create = trpc.admin.users.create.useMutation({ onSuccess: () => { setEmail(""); setPassword(""); setMessage("Team member created."); void utils.admin.users.list.invalidate(); }, onError: error => setMessage(error.message) });
  const changeRole = trpc.admin.users.changeRole.useMutation({ onSuccess: () => void utils.admin.users.list.invalidate(), onError: error => setMessage(error.message) });
  const revoke = trpc.admin.users.revoke.useMutation({ onSuccess: () => { setMessage("Access revoked. Existing sessions are invalid immediately."); void utils.admin.users.list.invalidate(); }, onError: error => setMessage(error.message) });

  return (
    <ManagementFrame title="Team" active="team">
      <div className="management-grid">
        <section className="table-card">
          <h2>Add team member</h2>
          <form className="team-form" onSubmit={event => { event.preventDefault(); create.mutate({ email, password, role }); }}>
            <label className="field-label" htmlFor="team-email">Email<input id="team-email" className="text-input" type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
            <label className="field-label" htmlFor="team-password">Temporary password<input id="team-password" className="text-input" type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>
            <label className="field-label" htmlFor="team-role">Role<select id="team-role" className="text-input" value={role} onChange={event => setRole(event.target.value as "admin" | "editor")}><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
            <button className="button" type="submit" disabled={create.isPending}>Create account</button>
          </form>
          {message && <p className="form-message">{message}</p>}
        </section>
        <section className="table-card team-list-card">
          <h2>Accounts</h2>
          {members.isLoading ? (
            <p className="muted">Loading accounts…</p>
          ) : (
            <div className="team-list">
              {members.data?.map(member => (
                <div className="team-row" key={member.id}>
                  <div>
                    <strong>{member.email}</strong>
                    <p className="muted">Created {new Date(member.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="team-row-actions">
                    <span className={`account-status ${member.isActive ? "active" : "revoked"}`}>{member.isActive ? "Active" : "Revoked"}</span>
                    <select aria-label={`Change role for ${member.email}`} value={member.role} disabled={!member.isActive || changeRole.isPending} onChange={event => changeRole.mutate({ id: member.id, role: event.target.value as "admin" | "editor" })}><option value="editor">Editor</option><option value="admin">Admin</option></select>
                    <button className="text-button danger" disabled={!member.isActive || revoke.isPending} onClick={() => { if (window.confirm(`Revoke access for ${member.email}?`)) revoke.mutate({ id: member.id }); }}>Revoke</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ManagementFrame>
  );
}

export function AnalyticsDashboard() {
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  const analytics = trpc.admin.analytics.useQuery(undefined, { enabled: session.data?.role === "admin" });
  const maxViews = Math.max(1, ...(analytics.data?.viewsByHour.map(item => item.views) || [1]));
  const empty = (icon: string, title: string, hint: string) => <div className="analytics-empty"><span className="analytics-empty-icon" aria-hidden="true">{icon}</span><strong>{title}</strong><p>{hint}</p></div>;

  return (
    <ManagementFrame title="Analytics" active="analytics">
      <div className="analytics-metrics">
        <div className="metric-card"><strong>{analytics.data?.totalViews ?? "—"}</strong><span>Total post views</span></div>
        <div className="metric-card"><strong>{analytics.data?.totalReaders ?? "—"}</strong><span>Registered readers</span></div>
        <div className="metric-card"><strong>{analytics.data?.totalReactions ?? "—"}</strong><span>Total signal reactions</span></div>
        <div className="metric-card"><strong>{analytics.data?.mostRead.length ?? "—"}</strong><span>Posts with views</span></div>
      </div>
      <div className="analytics-columns">
        <section className="table-card"><h2>Most read</h2>{analytics.data?.mostRead.length ? analytics.data.mostRead.map(post => <div className="analytics-row" key={post.id}><span>{post.headline}</span><strong>{post.viewCount}</strong></div>) : empty("↗", "No published post views yet", "Views will appear here once readers open a published story.")}</section>
        <section className="table-card"><h2>Most reacted</h2>{analytics.data?.mostReacted.length ? analytics.data.mostReacted.map(post => <div className="analytics-row" key={post.id}><span>{post.headline}</span><strong>{post.reactionCount}</strong></div>) : empty("♨", "No post reactions yet", "Signal reactions will appear here as readers respond to published stories.")}</section>
        <section className="table-card"><h2>Top searches</h2>{analytics.data?.topSearches.length ? analytics.data.topSearches.map(item => <div className="analytics-row" key={item.query}><span>“{item.query}”</span><strong>{item.count}</strong></div>) : empty("⌕", "No archive searches yet", "Search activity will populate this panel as readers explore the archive.")}</section>
      </div>
      <section className="table-card hour-chart">
        <h2>Views by hour</h2>
        <p className="muted">All-time view timestamps, with the 8 AM drop highlighted.</p>
        {analytics.data?.viewsByHour?.some(item => item.views) ? (
          <div className="bars">{analytics.data.viewsByHour.map(item => <div className={`bar-column ${item.hour === 8 ? "drop-hour" : ""}`} key={item.hour}><div className="bar" style={{ height: `${Math.max(item.views ? 8 : 2, item.views / maxViews * 150)}px` }} title={`${item.views} views at ${item.hour}:00`} /><span>{item.hour}</span></div>)}</div>
        ) : empty("◷", "No hourly view data yet", "This chart will take shape as published stories receive their first views.")}
      </section>
    </ManagementFrame>
  );
}

export function NotificationsDashboard() {
  const [previewSlot, setPreviewSlot] = useState<"morning" | "evening">("morning");
  const [testSending, setTestSending] = useState(false);
  const [alertSending, setAlertSending] = useState(false);
  const [resendConfirmTarget, setResendConfirmTarget] = useState<{
    id: number;
    editionDate: string;
    slot: "morning" | "evening";
    recipientsCount: number;
  } | null>(null);

  const utils = trpc.useUtils();
  const appIdQuery = trpc.reader.oneSignalAppId.useQuery();
  const previewQuery = trpc.admin.previewPushNotification.useQuery({ slot: previewSlot });
  const pushSendsQuery = trpc.admin.listPushSends.useQuery(undefined, { refetchInterval: 12000 });
  const sendTestMutation = trpc.reader.sendTestPush.useMutation();
  const testAlertMutation = trpc.admin.testAlertEmail.useMutation();
  const resendMutation = trpc.admin.resendPushSend.useMutation({
    onSuccess: () => {
      toast.success("Resend initiated successfully!");
      setResendConfirmTarget(null);
      void utils.admin.listPushSends.invalidate();
    },
    onError: err => {
      toast.error(`Resend failed: ${err.message}`);
    },
  });

  const handleSendTestToMe = async () => {
    if (!appIdQuery.data) {
      toast.error("OneSignal App ID not configured.");
      return;
    }
    try {
      setTestSending(true);
      const OneSignal = await getOneSignal(appIdQuery.data);
      await OneSignal.Notifications.requestPermission();
      let subId = OneSignal.User?.PushSubscription?.id;
      if (!subId) {
        await OneSignal.User?.PushSubscription?.optIn?.();
        subId = (await waitForSubscriptionId(OneSignal)) || undefined;
      }
      if (!subId) {
        throw new Error("Could not acquire device subscription ID. Allow notifications in browser.");
      }
      await sendTestMutation.mutateAsync({ subscriptionId: subId });
      toast.success("Test notification dispatched to this device!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test notification");
    } finally {
      setTestSending(false);
    }
  };

  const handleSendTestAlert = async () => {
    try {
      setAlertSending(true);
      const res = await testAlertMutation.mutateAsync();
      if (res.adminAlertEmailConfigured) {
        toast.success("Test alert email dispatched to ADMIN_ALERT_EMAIL!");
      } else {
        toast.info("Alert dispatched (Note: ADMIN_ALERT_EMAIL env var is not set, check logs).");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test alert email");
    } finally {
      setAlertSending(false);
    }
  };

  const preview = previewQuery.data?.formatted;

  return (
    <ManagementFrame title="Push Notifications" active="notifications">
      <div className="notifications-management-grid">
        {/* Section 1: Live Preview Card */}
        <section className="table-card notification-preview-section">
          <div className="section-header-row">
            <div>
              <h2>Push Notification Preview</h2>
              <p className="muted">Simulated appearance of the lock-screen & tray drop.</p>
            </div>
            <div className="preview-slot-toggles">
              <button
                type="button"
                className={`slot-toggle-btn ${previewSlot === "morning" ? "active" : ""}`}
                onClick={() => setPreviewSlot("morning")}
              >
                🌅 Morning (8 AM)
              </button>
              <button
                type="button"
                className={`slot-toggle-btn ${previewSlot === "evening" ? "active" : ""}`}
                onClick={() => setPreviewSlot("evening")}
              >
                🌙 Evening (10 PM)
              </button>
            </div>
          </div>

          <div className="push-device-mockup">
            <div className="push-notification-card">
              <div className="push-card-header">
                <img src="/logo-192.png" alt="Aurikrex Bytes" className="push-card-app-icon" />
                <div className="push-card-meta">
                  <span className="app-name">Aurikrex Bytes</span>
                  <span className="time-ago">· Just now</span>
                </div>
                <img src="/badge-96.png" alt="Badge" className="push-card-badge-icon" title="Monochrome Android Status Badge" />
              </div>

              <div className="push-card-body">
                <strong className="push-title">{preview?.heading || "Morning Brief · 1 new Byte"}</strong>
                <p className="push-text">
                  {preview?.content || "Latest high-signal tech briefing from the editorial desk."}
                </p>
              </div>

              {preview?.imageUrl && (
                <div className="push-card-image-wrap">
                  <img src={preview.imageUrl} alt="Notification big picture" className="push-card-image" />
                </div>
              )}

              <div className="push-card-actions">
                <button type="button" className="push-action-btn">Read now</button>
                <button type="button" className="push-action-btn">All Bytes</button>
              </div>
            </div>
          </div>

          <div className="preview-action-bar">
            <button
              type="button"
              className="button"
              onClick={handleSendTestToMe}
              disabled={testSending || sendTestMutation.isPending}
            >
              <BellRing size={16} />
              <span>{testSending ? "Dispatching..." : "Send test notification to me"}</span>
            </button>
            <button
              type="button"
              className="btn outline"
              onClick={handleSendTestAlert}
              disabled={alertSending || testAlertMutation.isPending}
            >
              <Mail size={16} />
              <span>{alertSending ? "Sending..." : "Test alert email"}</span>
            </button>
          </div>
        </section>

        {/* Section 2: Delivery Config & Schedule Info */}
        <section className="table-card notification-schedule-card">
          <h2>Delivery Schedule & Policy</h2>
          <div className="schedule-info-grid">
            <div className="schedule-info-item">
              <span className="item-label">Morning Slot</span>
              <strong>08:00 WAT (07:00 UTC)</strong>
              <p className="muted">Window: 08:00 – 11:00 WAT</p>
            </div>
            <div className="schedule-info-item">
              <span className="item-label">Evening Slot</span>
              <strong>22:00 WAT (21:00 UTC)</strong>
              <p className="muted">Window: 22:00 – 01:00 WAT</p>
            </div>
            <div className="schedule-info-item">
              <span className="item-label">Tray Replacement</span>
              <strong>collapse_id: aurikrex-briefing</strong>
              <p className="muted">Next edition replaces previous tray entry</p>
            </div>
            <div className="schedule-info-item">
              <span className="item-label">Android Badge</span>
              <strong>badge-96.png (Monochrome)</strong>
              <p className="muted">Crisp white glyph on transparent background</p>
            </div>
          </div>
        </section>

        {/* Section 3: Ledger History Table */}
        <section className="table-card push-history-card">
          <div className="section-header-row">
            <div>
              <h2>Push Sends Ledger (`push_sends`)</h2>
              <p className="muted">Recorded history, scheduling accuracy, and recipient delivery.</p>
            </div>
            <button
              type="button"
              className="btn outline sm"
              onClick={() => void utils.admin.listPushSends.invalidate()}
              title="Refresh ledger"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {pushSendsQuery.isLoading ? (
            <p className="muted">Loading push ledger…</p>
          ) : !pushSendsQuery.data || pushSendsQuery.data.length === 0 ? (
            <p className="muted">No push notifications recorded yet. Scheduled notifications will log here automatically.</p>
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Slot</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Scheduled vs Started</th>
                    <th>Recipients</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pushSendsQuery.data.map((row: any) => {
                    const scheduled = new Date(row.scheduledFor);
                    const started = new Date(row.startedAt);
                    const deltaSec = Math.round((started.getTime() - scheduled.getTime()) / 1000);
                    const deltaStr = deltaSec >= 0 ? `+${deltaSec}s` : `${deltaSec}s`;

                    return (
                      <tr key={row.id}>
                        <td><strong>{row.editionDate}</strong></td>
                        <td>
                          <span className={`slot-pill ${row.slot}`}>
                            {row.slot === "morning" ? "Morning" : "Evening"}
                          </span>
                        </td>
                        <td>
                          <span className={`ledger-status-badge ${row.status}`}>
                            {row.status}
                          </span>
                        </td>
                        <td><code>{row.triggerSource}</code></td>
                        <td>
                          <div className="time-delta-cell">
                            <span>{scheduled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="delta-tag" title={`Trigger latency: ${deltaStr}`}>
                              {deltaStr}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span>{row.recipientsCount ?? "—"}</span>
                          {row.invalidRemovedCount ? (
                            <span className="pruned-tag" title="Invalid subscriptions pruned">
                              (-{row.invalidRemovedCount})
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn outline xs resend-btn"
                            onClick={() =>
                              setResendConfirmTarget({
                                id: row.id,
                                editionDate: row.editionDate,
                                slot: row.slot,
                                recipientsCount: row.recipientsCount || 0,
                              })
                            }
                            disabled={resendMutation.isPending}
                          >
                            Resend
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Resend Confirmation Modal Dialog */}
      {resendConfirmTarget && (
        <div className="push-sheet-backdrop" onClick={() => setResendConfirmTarget(null)} role="dialog" aria-modal="true">
          <div className="push-sheet-container confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="push-sheet-header">
              <div className="push-sheet-badge warning">
                <AlertCircle size={24} className="text-warning" />
              </div>
              <div className="push-sheet-title-group">
                <h2 className="push-sheet-title">Confirm Notification Resend</h2>
              </div>
            </div>

            <p className="push-sheet-desc">
              Are you sure you want to resend the <strong>{resendConfirmTarget.slot}</strong> notification
              for edition <strong>{resendConfirmTarget.editionDate}</strong>?
            </p>
            <p className="resend-warning-note">
              This will bypass the time window and broadcast the live push to approximately{" "}
              <strong>{resendConfirmTarget.recipientsCount || "all"} subscribers</strong>.
            </p>

            <div className="push-sheet-actions">
              <button
                type="button"
                className="push-btn-primary danger"
                disabled={resendMutation.isPending}
                onClick={() =>
                  resendMutation.mutate({
                    slot: resendConfirmTarget.slot,
                    editionDate: resendConfirmTarget.editionDate,
                  })
                }
              >
                {resendMutation.isPending ? "Resending..." : "Yes, Resend Notification"}
              </button>
              <button
                type="button"
                className="push-btn-secondary"
                disabled={resendMutation.isPending}
                onClick={() => setResendConfirmTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagementFrame>
  );
}
