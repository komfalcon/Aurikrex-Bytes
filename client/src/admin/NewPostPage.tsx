import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { trpc } from "../lib/trpc";
import NotFound from "../pages/NotFound";

const HEADLINE_LIMIT = 120;
const BODY_LIMIT = 800;

type FormErrors = { imageUrl?: string; headline?: string; body?: string; submit?: string };

function AdminFrame({ role, children }: { role: string; children: React.ReactNode }) {
  return <main className="admin-shell"><aside><p className="eyebrow">Aurikrex Bytes</p><h2>Newsroom</h2><p className="muted admin-role">{role}</p><Link href="/admin">Back to inbox</Link></aside><section className="admin-content new-post-page">{children}</section></main>;
}

export function NewPostPage() {
  const session = trpc.admin.session.useQuery();
  const signature = trpc.admin.cloudinarySignature.useQuery(undefined, { enabled: Boolean(session.data) });
  const createPost = trpc.admin.createPost.useMutation();
  const [, navigate] = useLocation();
  const [headline, setHeadline] = useState(""); const [body, setBody] = useState(""); const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false); const [uploadError, setUploadError] = useState(""); const [errors, setErrors] = useState<FormErrors>({}); const [fileKey, setFileKey] = useState(0);

  if (session.isLoading) return <main className="auth-wrap"><p className="muted">Loading newsroom…</p></main>;
  if (!session.data) return <NotFound />;
  const currentRole = session.data.role;

  async function upload(file: File) {
    setUploadError(""); setUploading(true);
    try {
      if (!signature.data?.configured || !("signature" in signature.data)) throw new Error("Cloudinary is not configured yet.");
      const form = new FormData(); form.append("file", file); form.append("api_key", signature.data.apiKey); form.append("timestamp", String(signature.data.timestamp)); form.append("folder", signature.data.folder); form.append("signature", signature.data.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.data.cloudName}/image/upload`, { method: "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "Upload failed");
      setImageUrl(result.secure_url);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!imageUrl) next.imageUrl = "Upload an image before continuing.";
    if (!headline.trim()) next.headline = "Headline is required.";
    if (!body.trim()) next.body = "Body is required.";
    return next;
  }

  async function saveDraft(destination: "preview" | "draft") {
    const next = validate(); setErrors(next); if (Object.keys(next).length) return;
    try {
      const result = await createPost.mutateAsync({ headline: headline.trim(), body: body.trim(), imageUrl });
      if (destination === "preview") navigate(`/admin/preview/${result.id}?role=${currentRole}`);
      else setErrors({ submit: "Draft saved. You can find it in the Inbox." });
    } catch (error) { setErrors({ submit: error instanceof Error ? error.message : "Could not save post." }); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void upload(file); }
  function onSubmit(event: FormEvent) { event.preventDefault(); void saveDraft("preview"); }

  return <AdminFrame role={session.data.role}><header className="new-post-heading"><div><p className="eyebrow">Editorial desk</p><h1>New Post</h1><p className="muted">Create a story draft, then preview it before its next publishing step.</p></div></header><form className="new-post-form" onSubmit={onSubmit} noValidate>
    <section className="table-card image-upload-card"><div className="field-heading"><div><label className="field-label" htmlFor="post-image">Image</label><p className="field-help">Upload the image for this news card.</p></div>{imageUrl && <button type="button" className="text-button danger" onClick={() => { setImageUrl(""); setFileKey(key => key + 1); }}>Replace image</button>}</div><div className={`upload-zone ${imageUrl ? "has-image" : ""}`}><input key={fileKey} id="post-image" type="file" accept="image/*" onChange={onFileChange} disabled={uploading} />{imageUrl ? <img className="new-post-preview" src={imageUrl} alt="Uploaded post preview" /> : <span>{uploading ? "Uploading…" : "Choose an image to upload"}</span>}</div>{(errors.imageUrl || uploadError) && <p className="inline-error">{errors.imageUrl || uploadError}</p>}</section>
    <section className="table-card new-post-fields"><label className="field-label" htmlFor="headline">Headline</label><input id="headline" className="text-input" value={headline} maxLength={HEADLINE_LIMIT} onChange={event => setHeadline(event.target.value)} placeholder="Write a clear, compelling headline" /> <div className="field-footer"><span className="field-help">Maximum {HEADLINE_LIMIT} characters.</span><span className="char-count">{headline.length}/{HEADLINE_LIMIT}</span></div>{errors.headline && <p className="inline-error">{errors.headline}</p>}<label className="field-label body-label" htmlFor="body">Body</label><textarea id="body" className="body-input" value={body} maxLength={BODY_LIMIT} onChange={event => setBody(event.target.value)} placeholder="Tell the story in a concise news card." rows={8} /><div className="field-footer"><span className="field-help">Maximum {BODY_LIMIT} characters.</span><span className="char-count">{body.length}/{BODY_LIMIT}</span></div>{errors.body && <p className="inline-error">{errors.body}</p>}</section>
    {errors.submit && <p className="form-message">{errors.submit}</p>}<div className="new-post-actions"><button className="button preview-button" type="submit" disabled={uploading || createPost.isPending}>Preview <span aria-hidden="true">→</span></button><button className="save-draft-button" type="button" onClick={() => void saveDraft("draft")} disabled={uploading || createPost.isPending}>Save as Draft</button></div>
  </form></AdminFrame>;
}

export function PreviewPlaceholder() {
  const [, params] = useRoute("/admin/preview/:draftId");
  const [location] = useLocation(); const session = trpc.admin.session.useQuery(); const posts = trpc.admin.posts.useQuery(undefined, { enabled: Boolean(session.data) });
  if (session.isLoading) return <main className="auth-wrap"><p className="muted">Loading preview…</p></main>;
  if (!session.data || !params) return <NotFound />;
  const draft = posts.data?.find(post => post.id === Number(params.draftId)); const role = new URLSearchParams(location.split("?")[1] || "").get("role") || session.data.role;
  return <AdminFrame role={session.data.role}><p className="eyebrow">Preview · {role}</p><h1>Review your post</h1><div className="table-card preview-placeholder"><p className="status">Draft #{params.draftId}</p>{draft?.imageUrl && <img className="preview-image" src={draft.imageUrl} alt="" />}<h2>{draft?.headline || "Preview ready"}</h2><p className="muted">{draft?.body || "The full preview and publishing actions will be completed in Chunk 5."}</p><p className="preview-destination">{role === "editor" ? "Next step: Submit for Review" : "Next step: Schedule or Publish Now"}</p><Link className="outline-button" href="/admin">Return to Inbox</Link></div></AdminFrame>;
}
