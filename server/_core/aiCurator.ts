import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import { posts } from "../../drizzle/schema.js";

export interface CuratedByte {
  headline: string;
  body: string;
  category: string;
  imageUrl: string | null;
  sourceUrl?: string;
  sourcePublisher?: string;
  sourcePublishedAt?: Date;
  duplicateKey?: string;
  imageQuery?: string;
  imageProvenance?: string;
}

interface NewsCandidate {
  title: string;
  url: string;
  publisher: string;
  publishedAt: Date;
  duplicateKey: string;
  imageUrl: string | null;
}

const TOPIC_POOL = [
  "Generative AI and agentic workflows", "Quantum hardware and supercomputing", "Semiconductors and lithography", "Biotech and CRISPR therapies", "Fusion energy and power grids", "Robotics and spatial vision", "Cybersecurity and post-quantum cryptography", "Blockchain infrastructure", "Electric vehicles and solid-state batteries", "Neuromorphic computing", "Optical computing and silicon photonics", "Synthetic biology", "Aerospace and satellite constellations", "Databases and WebAssembly", "Privacy-preserving machine learning"
];

export function normalizeHeadline(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of Array.from(url.searchParams.keys())) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch { return value.trim().toLowerCase(); }
}

export function buildDuplicateKey(title: string, url: string, publishedAt: Date): string {
  // The URL is retained as provenance, but not used in identity: syndicated copies
  // of one story often have different URLs and must still collapse to one Byte.
  void url;
  return createHash("sha256").update(`${normalizeHeadline(title)}|${publishedAt.toISOString().slice(0, 10)}`).digest("hex");
}

function localDate(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function zonedMidnight(date: string, timeZone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(guess);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()));
}

export function getTodayWindow(now = new Date(), timeZone = process.env.APP_TIMEZONE || "Africa/Lagos") {
  const date = localDate(timeZone, now);
  const start = zonedMidnight(date, timeZone);
  return { date, start, end: new Date(start.getTime() + 86_400_000) };
}

function publisherFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Hacker News"; }
}

async function fetchTodayCandidates(): Promise<NewsCandidate[]> {
  const { start, end } = getTodayWindow();
  const queries = TOPIC_POOL.slice(0, 5).map(topic => topic.split(" ")[0]);
  const results = await Promise.all(queries.map(async query => {
    const response = await fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`);
    if (!response.ok) throw new Error(`Hacker News API returned ${response.status}`);
    return response.json() as Promise<{ hits?: any[] }>;
  }));
  const candidates = new Map<string, NewsCandidate>();
  for (const result of results) for (const hit of result.hits || []) {
    const publishedAt = new Date(Number(hit.created_at_i) * 1000);
    const title = String(hit.title || "").trim();
    const url = String(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID || ""}`);
    if (!title || title.length < 15 || !Number.isFinite(publishedAt.getTime()) || publishedAt < start || publishedAt >= end) continue;
    const duplicateKey = buildDuplicateKey(title, url, publishedAt);
    candidates.set(duplicateKey, { title, url, publisher: publisherFromUrl(url), publishedAt, duplicateKey, imageUrl: null });
  }
  return Array.from(candidates.values()).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 30);
}

function imageQuery(title: string): string { return title.replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" "); }

function directByte(candidate: NewsCandidate, index: number): CuratedByte {
  const body = `According to ${candidate.publisher}, ${candidate.title}. The report was published on ${candidate.publishedAt.toISOString()} and is included because it falls within today's verified news window. The underlying development is relevant to technology leaders because it may affect product strategy, infrastructure planning, research priorities, or competitive positioning.\n\nReaders should consult the original report for the complete context, technical evidence, and qualifications that cannot be established from a headline alone. This Byte preserves the source trail so editors can validate the story before publication.`;
  return { headline: candidate.title.slice(0, 120), body: body.slice(0, 800), category: ["Tech", "AI", "Science", "Innovation", "Crypto"][index % 5], imageUrl: candidate.imageUrl, sourceUrl: candidate.url, sourcePublisher: candidate.publisher, sourcePublishedAt: candidate.publishedAt, duplicateKey: candidate.duplicateKey, imageQuery: imageQuery(candidate.title), imageProvenance: candidate.imageUrl ? "source-article" : "source-image-unavailable" };
}

export async function curateTenBytes(): Promise<CuratedByte[]> {
  let candidates: NewsCandidate[];
  try { candidates = await fetchTodayCandidates(); } catch (error) { console.error("[AICurator] Today-only news retrieval failed", error); return []; }
  if (!candidates.length) return [];
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY || "").trim();
  if (!apiKey) return candidates.slice(0, 10).map(directByte);
  const prompt = `Write editorial briefs from ONLY these verified candidates. Do not invent facts, URLs, publishers, or dates. Return JSON array with headline, body, category, sourceUrl, sourcePublishedAt. Every sourceUrl must exactly match a candidate.\n${JSON.stringify(candidates)}`;
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }) });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const raw = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const byUrl = new Map(candidates.map(candidate => [canonicalizeUrl(candidate.url), candidate]));
    const seen = new Set<string>();
    return (Array.isArray(parsed) ? parsed : []).map((item: any, index: number) => {
      const candidate = byUrl.get(canonicalizeUrl(String(item.sourceUrl || "")));
      if (!candidate || seen.has(candidate.duplicateKey)) return null;
      seen.add(candidate.duplicateKey);
      const byte = directByte(candidate, index);
      const body = String(item.body || "").trim();
      const category = ["Tech", "AI", "Science", "Innovation", "Crypto"].includes(String(item.category)) ? String(item.category) : byte.category;
      return { ...byte, headline: String(item.headline || byte.headline).slice(0, 120), body: body.length >= 600 && body.length <= 800 ? body : byte.body, category };
    }).filter(Boolean).slice(0, 10) as CuratedByte[];
  } catch (error) { console.error("[AICurator] Editorial generation failed; using verified headlines", error); return candidates.slice(0, 10).map(directByte); }
}

export async function runNightlyCuration(status: "draft" | "published" = "draft"): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const bytes = await curateTenBytes();
  if (!bytes.length) return 0;
  const duplicateKeys = bytes.map(byte => byte.duplicateKey).filter((key): key is string => Boolean(key));
  const existing = duplicateKeys.length ? await db.select({ duplicateKey: posts.duplicateKey }).from(posts).where(inArray(posts.duplicateKey, duplicateKeys)) : [];
  const used = new Set(existing.map(post => post.duplicateKey).filter(Boolean));
  let count = 0;
  for (const byte of bytes) {
    if (!byte.duplicateKey || used.has(byte.duplicateKey)) continue;
    try {
      await db.insert(posts).values({ headline: byte.headline, body: byte.body, imageUrl: byte.imageUrl, status, createdBy: 1, updatedAt: new Date(), sourceUrl: byte.sourceUrl, sourcePublisher: byte.sourcePublisher, sourcePublishedAt: byte.sourcePublishedAt, duplicateKey: byte.duplicateKey, imageQuery: byte.imageQuery, imageProvenance: byte.imageProvenance });
      used.add(byte.duplicateKey);
      count++;
    } catch (error) { console.error(`[AICurator] Skipping duplicate or failed insert for ${byte.sourceUrl}`, error); }
  }
  console.info(`[AICurator] Added ${count} validated ${status} Bytes`);
  return count;
}

// Kept for legacy PDF imports; automated news curation never calls it.
export function getHdUnsplashCoverUrl(headline: string, category = "Tech", seedOffset = 0): string {
  return `https://source.unsplash.com/1200x800/?${encodeURIComponent(`${headline} ${category}`)}&sig=${seedOffset}`;
}
