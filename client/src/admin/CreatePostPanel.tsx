import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function CreatePostPanel() {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"draft" | "pending_review" | "scheduled" | "published">("draft");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const signature = trpc.admin.cloudinarySignature.useQuery();
  const createPost = trpc.admin.createPost.useMutation({ onSuccess: () => { setHeadline(""); setBody(""); setImageUrl(""); setMessage("Post saved."); }, onError: e => setMessage(e.message) });
  async function upload(file: File) {
    if (!signature.data?.configured || !("signature" in signature.data)) { setMessage("Cloudinary is not configured yet; add deployment variables to enable image upload."); return; }
    const form = new FormData(); form.append("file", file); form.append("api_key", signature.data.apiKey); form.append("timestamp", String(signature.data.timestamp)); form.append("folder", signature.data.folder); form.append("signature", signature.data.signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.data.cloudName}/image/upload`, { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "Upload failed"); setImageUrl(result.secure_url); setMessage("Image uploaded.");
  }
  return <div className="table-card composer"><h2>Compose a card</h2><form onSubmit={e => { e.preventDefault(); createPost.mutate({ headline, body, imageUrl: imageUrl || undefined, status }); }}><input placeholder="Headline" value={headline} onChange={e => setHeadline(e.target.value)} required /><textarea placeholder="Body" value={body} onChange={e => setBody(e.target.value)} required rows={5} /><select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="draft">Draft</option><option value="pending_review">Pending review</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select><input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) upload(file).catch(error => setMessage(error.message)); }} /><button className="button" type="submit">Save post</button></form><p className="form-message">{message}</p></div>;
}
