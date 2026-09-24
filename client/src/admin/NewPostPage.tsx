import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Sparkles, FileText, UploadCloud, CheckCircle2, ArrowRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import NotFound from "../pages/NotFound";
import { AdminFrame } from "./AdminPages";

const HEADLINE_LIMIT = 120;
const BODY_LIMIT = 1200;
type FormErrors = { imageUrl?: string; headline?: string; body?: string; submit?: string };

export function NewPostPage() {
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  const [, editParams] = useRoute("/admin/new/:draftId");
  const editId = editParams?.draftId ? Number(editParams.draftId) : undefined;
  const existing = trpc.admin.post.useQuery({ id: editId || 0 }, { enabled: Boolean(editId) });
  const signature = trpc.admin.cloudinarySignature.useQuery(undefined, { enabled: Boolean(session.data) });
  const createPost = trpc.admin.createPost.useMutation();
  const editPost = trpc.admin.editPost.useMutation();
  const curateNow = trpc.admin.curateNow.useMutation();
  const ingestPdf = trpc.admin.ingestPdf.useMutation();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const [mode, setMode] = useState<"manual" | "pdf" | "ai">("manual");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [fileKey, setFileKey] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // PDF processing states
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfSuccessCount, setPdfSuccessCount] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState("");

  // AI Curation states
  const [aiRunning, setAiRunning] = useState(false);
  const [aiSuccessCount, setAiSuccessCount] = useState<number | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (existing.data && !hydrated) {
      setHeadline(existing.data.headline);
      setBody(existing.data.body);
      setImageUrl(existing.data.imageUrl || "");
      setHydrated(true);
    }
  }, [existing.data, hydrated]);

  if (session.isLoading || (editId && existing.isLoading))
    return <main className="auth-wrap"><p className="muted">Loading newsroom…</p></main>;
  if (!session.data || (editId && !existing.data)) return <NotFound />;

  const currentRole = session.data.role;

  async function uploadImage(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      if (!signature.data?.configured || !("signature" in signature.data)) {
        throw new Error("Cloudinary is not configured yet.");
      }
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signature.data.apiKey);
      form.append("timestamp", String(signature.data.timestamp));
      form.append("folder", signature.data.folder);
      form.append("signature", signature.data.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.data.cloudName}/image/upload`, {
        method: "POST",
        body: form
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Upload failed");
      setImageUrl(result.secure_url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!imageUrl) next.imageUrl = "Upload an image before continuing.";
    if (!headline.trim()) next.headline = "Headline is required.";
    if (!body.trim()) next.body = "Body is required.";
    return next;
  }

  async function saveDraft(destination: "preview" | "draft") {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      let id = editId;
      if (editId) {
        await editPost.mutateAsync({ id: editId, headline: headline.trim(), body: body.trim(), imageUrl });
      } else {
        const result = await createPost.mutateAsync({ headline: headline.trim(), body: body.trim(), imageUrl });
        id = result.id;
      }
      if (destination === "preview" && id) navigate(`/admin/preview/${id}?role=${currentRole}`);
      else setErrors({ submit: "Draft saved. You can find it in the Inbox." });
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Could not save post." });
    }
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadImage(file);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void saveDraft("preview");
  }

  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    setPdfError("");
    setPdfSuccessCount(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const res = await ingestPdf.mutateAsync({ pdfContent: content });
          setPdfSuccessCount(res.count);
          void utils.admin.posts.invalidate();
          setTimeout(() => navigate("/admin"), 1500);
        } catch (err) {
          setPdfError(err instanceof Error ? err.message : "Failed to parse PDF with Gemini AI");
        } finally {
          setPdfUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setPdfError("Error reading PDF file");
      setPdfUploading(false);
    }
  }

  async function handleTriggerCurateNow() {
    setAiRunning(true);
    setAiError("");
    setAiSuccessCount(null);

    try {
      const res = await curateNow.mutateAsync();
      setAiSuccessCount(res.count);
      void utils.admin.posts.invalidate();
      setTimeout(() => navigate("/admin"), 1500);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI Curation failed");
    } finally {
      setAiRunning(false);
    }
  }

  const busy = uploading || createPost.isPending || editPost.isPending;

  return (
    <AdminFrame role={currentRole} active="new">
      <header className="new-post-heading">
        <div>
          <p className="eyebrow">Editorial desk</p>
          <h1>{editId ? "Edit Post" : "New Post & AI Curation"}</h1>
          <p className="muted">Create single news cards manually, upload a multi-story PDF, or trigger Gemini AI auto-curation.</p>
        </div>
      </header>

      {!editId && (
        <section className="table-card mode-selector-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`button ${mode === "manual" ? "" : "button-outline"}`}
              onClick={() => setMode("manual")}
            >
              <FileText size={16} /> Manual Post
            </button>
            <button
              type="button"
              className={`button ${mode === "pdf" ? "" : "button-outline"}`}
              onClick={() => setMode("pdf")}
            >
              <UploadCloud size={16} /> Upload Multi-Story PDF (AI)
            </button>
            <button
              type="button"
              className={`button ${mode === "ai" ? "" : "button-outline"}`}
              onClick={() => setMode("ai")}
            >
              <Sparkles size={16} /> Curate 10 Bytes Now (Gemini AI)
            </button>
          </div>
        </section>
      )}

      {mode === "pdf" && !editId && (
        <section className="table-card image-upload-card" style={{ padding: "2rem" }}>
          <h3>📄 Upload Multi-Story PDF Document</h3>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Gemini AI will scan your document, extract up to 20+ distinct news stories, attach high-resolution cover imagery, and bulk-save them as drafts in your newsroom inbox.
          </p>

          {pdfSuccessCount !== null ? (
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", padding: "1.5rem", borderRadius: "8px", color: "#10b981", display: "flex", alignItems: "center", gap: "1rem" }}>
              <CheckCircle2 size={24} />
              <div>
                <strong>Successfully extracted {pdfSuccessCount} Bytes!</strong>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>Redirecting to Publishing Inbox...</p>
              </div>
            </div>
          ) : (
            <label className="upload-zone" style={{ cursor: pdfUploading ? "wait" : "pointer" }}>
              <input type="file" accept=".pdf,application/pdf" onChange={handlePdfUpload} disabled={pdfUploading} />
              <span className="upload-prompt">
                <UploadCloud size={36} style={{ marginBottom: "0.5rem", color: "var(--color-primary)" }} />
                <strong>{pdfUploading ? "Gemini AI is parsing PDF & extracting stories…" : "Choose a PDF file to upload"}</strong>
                <small>Upload documents containing 20+ news items or reports</small>
              </span>
            </label>
          )}

          {pdfError && <p className="inline-error" style={{ marginTop: "1rem" }}>{pdfError}</p>}
        </section>
      )}

      {mode === "ai" && !editId && (
        <section className="table-card" style={{ padding: "2rem" }}>
          <h3>✦ Gemini AI 10-Byte Daily Curation Drop</h3>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Click below to immediately trigger Gemini AI. It will analyze current technology, AI, science, and world developments to generate 10 fresh Bytes with high-resolution Unsplash photos.
          </p>

          {aiSuccessCount !== null ? (
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", padding: "1.5rem", borderRadius: "8px", color: "#10b981", display: "flex", alignItems: "center", gap: "1rem" }}>
              <CheckCircle2 size={24} />
              <div>
                <strong>Successfully curated {aiSuccessCount} fresh Bytes!</strong>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>Redirecting to Publishing Inbox...</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button-full"
              onClick={handleTriggerCurateNow}
              disabled={aiRunning}
              style={{ padding: "1rem", fontSize: "1.05rem" }}
            >
              <Sparkles size={18} /> {aiRunning ? "Gemini AI is curating 10 Bytes..." : "Run 10-Byte Gemini AI Curation Drop Now"}
            </button>
          )}

          {aiError && <p className="inline-error" style={{ marginTop: "1rem" }}>{aiError}</p>}
        </section>
      )}

      {mode === "manual" && (
        <form className="new-post-form" onSubmit={onSubmit} noValidate>
          <section className="table-card image-upload-card">
            <div className="field-heading">
              <div>
                <label className="field-label" htmlFor="post-image">Image</label>
                <p className="field-help">Upload the image for this news card.</p>
              </div>
              {imageUrl && (
                <button type="button" className="button button-outline button-small" onClick={() => { setImageUrl(""); setFileKey(key => key + 1); }}>
                  Replace image
                </button>
              )}
            </div>
            <label className={`upload-zone ${imageUrl ? "has-image" : ""}`} htmlFor="post-image">
              <input key={fileKey} id="post-image" type="file" accept="image/*" onChange={onImageChange} disabled={busy} />
              {imageUrl ? (
                <img className="new-post-preview" src={imageUrl} alt="Uploaded post preview" />
              ) : (
                <span className="upload-prompt">
                  <strong>{uploading ? "Uploading…" : "Choose an image to upload"}</strong>
                  <small>PNG, JPG, or WEBP up to 10 MB</small>
                </span>
              )}
            </label>
            {(errors.imageUrl || uploadError) && <p className="inline-error">{errors.imageUrl || uploadError}</p>}
          </section>

          <section className="table-card new-post-fields">
            <label className="field-label" htmlFor="headline">Headline</label>
            <input
              id="headline"
              className="text-input"
              value={headline}
              maxLength={HEADLINE_LIMIT}
              onChange={event => setHeadline(event.target.value)}
              placeholder="Write a clear, compelling headline"
            />
            <div className="field-footer">
              <span className="field-help">Maximum {HEADLINE_LIMIT} characters.</span>
              <span className="char-count" aria-live="polite">{headline.length} / {HEADLINE_LIMIT}</span>
            </div>
            {errors.headline && <p className="inline-error">{errors.headline}</p>}

            <label className="field-label body-label" htmlFor="body">Body</label>
            <textarea
              id="body"
              className="body-input"
              value={body}
              maxLength={BODY_LIMIT}
              onChange={event => setBody(event.target.value)}
              placeholder="Tell the story in a concise news card."
              rows={8}
            />
            <div className="field-footer">
              <span className="field-help">Maximum {BODY_LIMIT} characters.</span>
              <span className="char-count" aria-live="polite">{body.length} / {BODY_LIMIT}</span>
            </div>
            {errors.body && <p className="inline-error">{errors.body}</p>}
          </section>

          {errors.submit && <p className="form-message">{errors.submit}</p>}

          <div className="new-post-actions">
            <button className="button preview-button" type="submit" disabled={busy}>
              Preview <ArrowRight size={16} />
            </button>
            <button className="button button-outline save-draft-button" type="button" onClick={() => void saveDraft("draft")} disabled={busy}>
              Save as Draft
            </button>
          </div>
        </form>
      )}
    </AdminFrame>
  );
}

function statusText(status: string, scheduledTime: Date | null) {
  if (status === "pending_review") return "Pending Review";
  if (status === "scheduled")
    return `Scheduled for ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(scheduledTime as Date))}`;
  if (status === "published") return "Published";
  return "Draft";
}

export function PreviewPage() {
  const [, params] = useRoute("/admin/preview/:draftId");
  const [, navigate] = useLocation();
  const session = trpc.admin.session.useQuery(undefined, { retry: false });
  const id = Number(params?.draftId || 0);
  const post = trpc.admin.post.useQuery({ id }, { enabled: Boolean(session.data && id) });
  const utils = trpc.useUtils();

  const submit = trpc.admin.submitPost.useMutation({ onSuccess: () => { void utils.admin.posts.invalidate(); navigate("/admin?message=submitted"); } });
  const publish = trpc.admin.publishPost.useMutation({ onSuccess: () => { void utils.admin.posts.invalidate(); navigate("/admin?message=published"); } });
  const schedule = trpc.admin.schedulePost.useMutation({ onSuccess: () => { void utils.admin.posts.invalidate(); navigate("/admin?message=scheduled"); } });
  const approve = trpc.admin.approvePost.useMutation({ onSuccess: () => { void utils.admin.posts.invalidate(); navigate("/admin?message=approved"); } });
  const reject = trpc.admin.rejectPost.useMutation({ onSuccess: () => { void utils.admin.posts.invalidate(); navigate("/admin?message=rejected"); } });

  const [scheduleTime, setScheduleTime] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [error, setError] = useState("");

  if (session.isLoading || post.isLoading) return <main className="auth-wrap"><p className="muted">Loading preview…</p></main>;
  if (!session.data || !post.data || !params) return <NotFound />;

  const item = post.data;
  const isAdmin = session.data.role === "admin";
  const isReview = isAdmin && item.status === "pending_review";
  const busy = submit.isPending || publish.isPending || schedule.isPending || approve.isPending || reject.isPending;

  function run(action: () => void) {
    setError("");
    try { action(); } catch (err) { setError(err instanceof Error ? err.message : "Action failed"); }
  }

  function schedulePost(approvePending: boolean) {
    if (!scheduleTime) { setError("Choose a specific date and time first."); return; }
    const time = new Date(scheduleTime);
    if (time <= new Date()) { setError("Scheduled time must be in the future."); return; }
    if (approvePending) approve.mutate({ id, scheduledTime: time });
    else schedule.mutate({ id, scheduledTime: time });
  }

  return (
    <AdminFrame role={session.data.role}>
      <div className="preview-topline">
        <div><p className="eyebrow">Editorial preview</p><h1>Review post</h1></div>
        <span className={`status-badge ${item.status}`}>{statusText(item.status, item.scheduledTime)}</span>
      </div>
      <div className="wysiwyg-card">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt=""
            className="wysiwyg-image"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";
            }}
          />
        )}
        <div className="wysiwyg-copy">
          <p className="eyebrow">Aurikrex Bytes</p>
          <h2>{item.headline}</h2>
          <p>{item.body}</p>
        </div>
      </div>
      <div className="preview-controls">
        <Link className="outline-button" href={`/admin/new/${id}`}>Edit</Link>
        {error && <p className="inline-error">{error}</p>}
        {isReview && (
          <div className="review-note">
            <label className="field-label" htmlFor="rejection-note">Rejection note <span className="field-help">optional</span></label>
            <textarea
              id="rejection-note"
              className="body-input"
              value={rejectionNote}
              maxLength={2000}
              onChange={event => setRejectionNote(event.target.value)}
              placeholder="Explain what should be revised before resubmission."
              rows={3}
            />
          </div>
        )}
        {(isAdmin || session.data.role === "editor") && (
          <div className="preview-actions">
            {isReview ? (
              <>
                <label className="schedule-picker">
                  <span>Schedule for</span>
                  <input type="datetime-local" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} />
                </label>
                <button className="button preview-action" disabled={busy} onClick={() => run(() => schedulePost(true))}>Approve &amp; Schedule</button>
                <button className="button preview-action" disabled={busy} onClick={() => run(() => approve.mutate({ id }))}>Approve &amp; Publish Now</button>
                <button className="save-draft-button reject-button" disabled={busy} onClick={() => run(() => reject.mutate({ id, rejectionNote: rejectionNote || undefined }))}>Reject</button>
              </>
            ) : isAdmin ? (
              <>
                <label className="schedule-picker">
                  <span>Schedule for</span>
                  <input type="datetime-local" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} />
                </label>
                <button className="button preview-action" disabled={busy} onClick={() => run(() => schedulePost(false))}>Schedule</button>
                <button className="button preview-action" disabled={busy} onClick={() => run(() => publish.mutate({ id }))}>Publish Now</button>
              </>
            ) : (
              <button className="button preview-action" disabled={busy} onClick={() => run(() => submit.mutate({ id }))}>Submit for Review</button>
            )}
          </div>
        )}
      </div>
    </AdminFrame>
  );
}
