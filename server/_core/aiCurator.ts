import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import { posts } from "../../drizzle/schema.js";
import { getAiApiKeys, getMistralApiKey, getNvidiaApiKey } from "./aiKeys.js";
import { generateNvidiaFluxImage } from "./imageGeneration.js";

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


// Kept for backward compatibility with existing callers
export function getHdUnsplashCoverUrl(headline: string, category = "Tech", seedOffset = 0): string {
  // Generate a high-contrast editorial SVG data URL fallback instead of dead source.unsplash.com
  return generateEditorialSvgCard(headline, category);
}

export function isNonNewsHeadline(title: string): boolean {
  const lower = title.toLowerCase().trim();
  if (/^(ask|tell)\s+hn\b/i.test(lower)) return true;
  if (/^poll:\b/i.test(lower)) return true;
  if (/\bwho\s+is\s+hiring\b/i.test(lower)) return true;
  if (/\bwho\s+wants\s+to\s+be\s+hired\b/i.test(lower)) return true;
  if (/\bfreelancer\s+seeking\s+freelancer\b/i.test(lower)) return true;
  if (/\bask\s+hn:\s+/i.test(lower)) return true;
  return false;
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function cleanHeadline(title: string): string {
  let cleaned = decodeHtmlEntities(title.trim());
  // Strip leading Show HN: / Launch HN: / Tell HN:
  cleaned = cleaned.replace(/^(show\s+hn|launch\s+hn|tell\s+hn)\s*:\s*/i, "");
  // Strip tags like [video], [pdf], [audio], [YYYY], (YYYY), etc.
  cleaned = cleaned.replace(/\s*\[(video|pdf|audio|\d{4})\]\s*/gi, " ");
  cleaned = cleaned.replace(/\s*\((video|pdf|audio|\d{4})\)\s*/gi, " ");
  // Strip trailing publisher tags e.g. " - The Verge", " | Ars Technica", " — TechCrunch"
  cleaned = cleaned.replace(
    /\s*[-–—|]\s*(the\s+verge|ars\s+technica|techcrunch|reuters|bloomberg|wired|wsj|nyt|bbc|cnbc|the\s+information|engadget)\s*$/i,
    ""
  );
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

export function generateEditorialSvgCard(headline: string, category = "Tech"): string {
  const safeHeadline = cleanHeadline(headline)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Word-wrap headline into 2-3 lines for clean visual typography
  const words = safeHeadline.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).length > 34) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
      if (lines.length >= 3) break;
    } else {
      currentLine += " " + word;
    }
  }
  if (currentLine && lines.length < 3) lines.push(currentLine.trim());

  const tspans = lines
    .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 54}">${l}</tspan>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="100%" stop-color="#141c2e" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#60a5fa" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="1100" cy="100" r="300" fill="#1e293b" opacity="0.35" />
  <circle cx="1100" cy="100" r="200" fill="#2563eb" opacity="0.08" />
  <g transform="translate(80, 90)">
    <rect x="0" y="0" width="130" height="34" rx="17" fill="url(#accent)" />
    <text x="65" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1">${category.toUpperCase()}</text>
  </g>
  <text x="80" y="240" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, serif" font-size="44" font-weight="700" fill="#f8fafc" letter-spacing="-0.5">
    ${tspans}
  </text>
  <g transform="translate(80, 530)">
    <circle cx="10" cy="-6" r="6" fill="#3b82f6" />
    <text x="28" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#94a3b8" letter-spacing="0.5">AURIKREX BYTES &bull; VERIFIED TECH BRIEFING</text>
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function extractSourceArticleImage(url: string): Promise<string | null> {
  // If URL is not valid HTTP/HTTPS, skip
  if (!url || !url.startsWith("http")) return null;
  // If the URL is Hacker News itself, don't crawl HN discussion pages for images
  if (/news\.ycombinator\.com/i.test(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AurikrexBytesBot/1.0; +https://www.bytes.aurikrex.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;

    // Read only the first 50KB to quickly extract OpenGraph / Twitter meta tags
    const reader = response.body?.getReader();
    if (!reader) return null;

    let html = "";
    const decoder = new TextDecoder();
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});

    // Match og:image or twitter:image
    const ogMatch =
      html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta\s+[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);

    if (!ogMatch || !ogMatch[1]) return null;

    let rawImg = ogMatch[1].trim();
    if (rawImg.startsWith("//")) rawImg = "https:" + rawImg;
    else if (rawImg.startsWith("/")) {
      const parsedBase = new URL(url);
      rawImg = `${parsedBase.origin}${rawImg}`;
    }

    // Filter out obvious junk images (icons, 1x1 pixels, badges, generic logos)
    if (
      /\.(ico|svg)(\?.*)?$/i.test(rawImg) ||
      /(favicon|apple-touch-icon|site-logo|spacer|pixel|1x1|badge)/i.test(rawImg)
    ) {
      return null;
    }

    return rawImg;
  } catch {
    return null;
  }
}

async function fetchRssCandidates(start: Date, end: Date, excludeKeys = new Set<string>()): Promise<NewsCandidate[]> {
  const feeds = [
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technologylab" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "Wired", url: "https://www.wired.com/feed/rss" },
    { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
    { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
    { name: "MIT Tech Review", url: "https://www.technologyreview.com/topstories.rss" },
  ];

  const results: NewsCandidate[] = [];

  for (const feed of feeds) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(feed.url, {
        signal: controller.signal,
        headers: { "User-Agent": "AurikrexBytesBot/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const xml = await res.text();
      const items = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || [];

      for (const itemXml of items.slice(0, 20)) {
        const titleMatch = itemXml.match(/<title(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch =
          itemXml.match(/<link[^>]+href=["']([^"']+)["']/i) ||
          itemXml.match(/<link(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const dateMatch =
          itemXml.match(/<pubDate(?:\s+[^>]*)?>([\s\S]*?)<\/pubDate>/i) ||
          itemXml.match(/<published(?:\s+[^>]*)?>([\s\S]*?)<\/published>/i) ||
          itemXml.match(/<updated(?:\s+[^>]*)?>([\s\S]*?)<\/updated>/i);
        const mediaMatch =
          itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
          itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i);

        if (!titleMatch || !linkMatch) continue;

        const rawTitle = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const publishedAt = dateMatch ? new Date(dateMatch[1].trim()) : new Date();

        if (
          !rawTitle ||
          rawTitle.length < 15 ||
          isNonNewsHeadline(rawTitle) ||
          !Number.isFinite(publishedAt.getTime()) ||
          publishedAt < start ||
          publishedAt >= end
        ) {
          continue;
        }

        const cleanedTitle = cleanHeadline(rawTitle);
        const duplicateKey = buildDuplicateKey(cleanedTitle, url, publishedAt);
        if (excludeKeys.has(duplicateKey)) continue;

        const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;

        results.push({
          title: cleanedTitle,
          url,
          publisher: feed.name,
          publishedAt,
          duplicateKey,
          imageUrl: mediaUrl,
        });
      }
    } catch (e) {
      console.warn(`[AICurator] Failed to fetch RSS feed from ${feed.name}:`, e);
    }
  }

  return results;
}

async function fetchCandidatesForTimeframe(start: Date, end: Date, excludeKeys = new Set<string>()): Promise<NewsCandidate[]> {
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);

  const hnQueries = [
    `tags=front_page&numericFilters=created_at_i>=${startSec},created_at_i<${endSec},points>=20&hitsPerPage=35`,
    `query=AI%20OR%20LLM&tags=story&numericFilters=created_at_i>=${startSec},created_at_i<${endSec},points>=25&hitsPerPage=25`,
    `query=chip%20OR%20semiconductor%20OR%20security&tags=story&numericFilters=created_at_i>=${startSec},created_at_i<${endSec},points>=25&hitsPerPage=25`,
    `query=cloud%20OR%20database%20OR%20open%20source&tags=story&numericFilters=created_at_i>=${startSec},created_at_i<${endSec},points>=25&hitsPerPage=25`,
  ];

  const hnPromises = hnQueries.map(async queryParams => {
    try {
      const response = await fetch(`https://hn.algolia.com/api/v1/search?${queryParams}`);
      if (!response.ok) return { hits: [] };
      return (await response.json()) as { hits?: any[] };
    } catch {
      return { hits: [] };
    }
  });

  const [hnResults, rssCandidates] = await Promise.all([
    Promise.all(hnPromises),
    fetchRssCandidates(start, end, excludeKeys),
  ]);

  const candidates = new Map<string, NewsCandidate>();

  for (const item of rssCandidates) {
    if (!excludeKeys.has(item.duplicateKey)) {
      candidates.set(item.duplicateKey, item);
    }
  }

  for (const result of hnResults) {
    for (const hit of result.hits || []) {
      const publishedAt = new Date(Number(hit.created_at_i) * 1000);
      const rawTitle = String(hit.title || "").trim();
      const url = String(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID || ""}`);

      if (
        !rawTitle ||
        rawTitle.length < 15 ||
        isNonNewsHeadline(rawTitle) ||
        !Number.isFinite(publishedAt.getTime()) ||
        publishedAt < start ||
        publishedAt >= end
      ) {
        continue;
      }

      const cleanedTitle = cleanHeadline(rawTitle);
      const duplicateKey = buildDuplicateKey(cleanedTitle, url, publishedAt);
      if (!excludeKeys.has(duplicateKey) && !candidates.has(duplicateKey)) {
        candidates.set(duplicateKey, {
          title: cleanedTitle,
          url,
          publisher: publisherFromUrl(url),
          publishedAt,
          duplicateKey,
          imageUrl: null,
        });
      }
    }
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 30);
}

export async function fetchTodayCandidates(excludeKeys = new Set<string>()): Promise<NewsCandidate[]> {
  const now = new Date();
  const { start, end } = getTodayWindow(now);

  // 1. Fetch uncurated candidates for today's window
  let candidates = await fetchCandidatesForTimeframe(start, end, excludeKeys);

  // 2. If fewer than 15 uncurated candidates in today's window, expand search window to 72 hours
  if (candidates.length < 15) {
    const past72h = new Date(now.getTime() - 72 * 3600 * 1000);
    console.info(`[AICurator] Found ${candidates.length} uncurated candidates today. Expanding search window to 72 hours...`);
    candidates = await fetchCandidatesForTimeframe(past72h, now, excludeKeys);
  }

  return candidates;
}

function imageQuery(title: string): string {
  return title.replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
}

/**
 * Ensures the editorial brief sits cleanly within a comfortable character boundary.
 * Surgically trims at clean sentence boundaries if too long.
 * Never appends generic filler or robotic boilerplate.
 */
export function clampEditorialBrief(
  body: string,
  candidate?: { publisher?: string; publishedAt?: Date }
): string {
  let text = body.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  // If longer than 800 chars, surgically trim at last clean sentence boundary
  if (text.length > 800) {
    const truncated = text.slice(0, 790);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? ")
    );
    if (lastSentenceEnd > 550) {
      text = truncated.slice(0, lastSentenceEnd + 1).trim();
    } else {
      // Clean word boundary cut
      const lastSpace = truncated.lastIndexOf(" ");
      text = (lastSpace > 550 ? truncated.slice(0, lastSpace) : truncated).trim() + "...";
    }
  }

  return text;
}

function extractAiHeadline(item: any, fallbackTitle: string): string {
  if (!item || typeof item !== "object") return cleanHeadline(fallbackTitle).slice(0, 120);
  const h =
    item.headline ||
    item.title ||
    item.brief?.headline ||
    item.metadata?.headline ||
    item.metadata?.title ||
    fallbackTitle;
  return cleanHeadline(String(h || fallbackTitle)).slice(0, 120);
}

export function extractAiBody(item: any): string {
  if (!item) return "";
  if (typeof item === "string" && item.length > 30) return item;
  if (typeof item.body === "string" && item.body.trim().length > 30) return item.body.trim();

  if (item.body && typeof item.body === "object" && !Array.isArray(item.body)) {
    const parts = Object.values(item.body)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length > 5);
    if (parts.length > 0) return parts.join("\n\n");
  }

  if (typeof item.summary === "string" && item.summary.trim().length > 30) return item.summary.trim();
  if (item.summary && typeof item.summary === "object" && !Array.isArray(item.summary)) {
    const parts = Object.values(item.summary)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length > 5);
    if (parts.length > 0) return parts.join("\n\n");
  }

  if (typeof item.text === "string" && item.text.trim().length > 30) return item.text.trim();
  if (typeof item.content === "string" && item.content.trim().length > 30) return item.content.trim();

  if (typeof item.brief?.summary?.lead?.text === "string") {
    const lead = item.brief.summary.lead.text;
    const bg = item.brief?.summary?.context?.background?.text || "";
    return `${lead}\n\n${bg}`.trim();
  }
  if (typeof item.brief?.summary === "string" && item.brief.summary.length > 30) return item.brief.summary.trim();
  if (typeof item.brief === "string" && item.brief.length > 30) return item.brief.trim();

  return "";
}

function extractArrayFromObject(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && parsed !== null) {
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrayKey) return parsed[arrayKey];
  }
  return [];
}

export function parseAiJsonResponse(rawJson: string): any[] {
  if (!rawJson || typeof rawJson !== "string") return [];

  // Step 1: Strip markdown code block fences and whitespace
  let cleaned = rawJson.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Step 2: Slice from first '{' or '['
  const firstBracket = cleaned.search(/[\[\{]/);
  if (firstBracket !== -1) {
    cleaned = cleaned.slice(firstBracket);
  }

  // Step 3: Try standard JSON.parse first
  try {
    const parsed = JSON.parse(cleaned);
    const arr = extractArrayFromObject(parsed);
    if (arr.length > 0) return arr;
  } catch {
    // Continue to repair attempts
  }

  // Step 4: Repair unescaped literal control characters (\r \n \t) inside double-quoted string values
  try {
    const sanitized = cleaned.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
      return match.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
    });
    const parsed = JSON.parse(sanitized);
    const arr = extractArrayFromObject(parsed);
    if (arr.length > 0) return arr;
  } catch {
    // Continue to truncated recovery
  }

  // Step 5: Handle truncated JSON arrays (when response hit max_tokens mid-stream)
  try {
    const lastClosingBrace = cleaned.lastIndexOf("}");
    if (lastClosingBrace > 0) {
      const truncatedCandidate = cleaned.slice(0, lastClosingBrace + 1);
      const autoClosed = truncatedCandidate.endsWith("]") ? truncatedCandidate : truncatedCandidate + "]";
      const sanitized = autoClosed.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
        return match.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
      });
      const parsed = JSON.parse(sanitized);
      const arr = extractArrayFromObject(parsed);
      if (arr.length > 0) {
        console.info(`[AICurator] Recovered ${arr.length} complete story objects from truncated JSON output.`);
        return arr;
      }
    }
  } catch {
    // Continue to regex block extraction
  }

  // Step 6: Fallback multiline object extraction for any valid story block
  const objects: any[] = [];
  const objectMatches = cleaned.match(/\{[\s\S]*?(?:"headline"|"title"|"body"|"summary"|"text")[\s\S]*?\}/gi) || [];
  for (const block of objectMatches) {
    try {
      const safeBlock = block.replace(/("(?:[^"\\]|\\.)*")/g, (m) => m.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t"));
      const obj = JSON.parse(safeBlock);
      if (obj && typeof obj === "object" && (obj.headline || obj.title || obj.body)) {
        objects.push(obj);
      }
    } catch {
      // Ignore individual corrupted snippet
    }
  }

  if (objects.length > 0) {
    console.info(`[AICurator] Recovered ${objects.length} story objects via multiline regex block parsing.`);
  }

  return objects;
}

async function generateSingleCandidateBrief(
  candidate: NewsCandidate,
  mistralKey: string,
  nvidiaKey: string
): Promise<{ headline: string; body: string; category: string } | null> {
  const prompt = `You are the executive tech editor for Aurikrex Bytes.
Write an authoritative, high-signal 3-paragraph editorial brief for this verified news story.

STORY DETAILS:
- Title: "${candidate.title}"
- Publisher: "${candidate.publisher}"
- URL: "${candidate.url}"

EDITORIAL RULES:
1. Base your brief strictly on the candidate facts. Do NOT hallucinate fake dates or fake benchmarks.
2. Structure into three concise, focused paragraphs:
   - Paragraph 1 (The Lead): The core event, company, breakthrough, or incident and key technical details.
   - Paragraph 2 (Why It Matters): Strategic industry impact, architectural implications, market effects, or infrastructure changes.
   - Paragraph 3 (The Outlook): What happens next, timeline, release dates, or key metrics to watch.
3. STRICT LENGTH REQUIREMENT: The total character count of the "body" MUST be strictly between 550 and 750 characters.
4. Headline: Crisp, punchy, active voice, under 90 characters. Never include publisher names or tags like "Show HN:".
5. Category: Choose the single best fit from ["Tech", "AI", "Science", "Innovation", "Crypto"].
6. Return a valid JSON object ONLY:
   {
     "headline": "Crisp Headline under 90 chars",
     "body": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...",
     "category": "Tech"
   }`;

  // 1. Primary LLM Provider: Mistral AI (mistral-small-latest -> open-mixtral-8x7b -> open-mistral-7b)
  if (mistralKey) {
    const mistralModels = ["mistral-small-latest", "open-mixtral-8x7b", "open-mistral-7b"];
    for (const model of mistralModels) {
      try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You are an executive tech editor for Aurikrex Bytes. Output valid JSON only." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const content = resData.choices?.[0]?.message?.content || "";
          const parsed = parseAiJsonResponse(content);
          if (parsed && parsed.length > 0) {
            const item = parsed[0];
            const headline = extractAiHeadline(item, candidate.title);
            const rawBody = extractAiBody(item);
            const body = rawBody ? clampEditorialBrief(rawBody, candidate) : "";
            const category = ["Tech", "AI", "Science", "Innovation", "Crypto"].includes(String(item.category))
              ? String(item.category)
              : "Tech";

            if (headline && body && body.length > 100) {
              return { headline, body, category };
            }
          }
        } else if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        // Fall through to next model
      }
    }
  }

  // 2. Fallback LLM Provider: NVIDIA AI NIM (Developer Credits)
  if (nvidiaKey) {
    const nvidiaModels = ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "mistralai/mistral-7b-instruct-v0.3"];
    const nvidiaEndpoints = [
      "https://integrate.api.nvidia.com/v1/chat/completions",
      "https://ai.api.nvidia.com/v1/chat/completions",
    ];

    for (const endpoint of nvidiaEndpoints) {
      for (const model of nvidiaModels) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${nvidiaKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "You are an executive tech editor for Aurikrex Bytes. Output valid JSON only." },
                { role: "user", content: prompt },
              ],
              temperature: 0.3,
              max_tokens: 1000,
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            const content = resData.choices?.[0]?.message?.content || "";
            const parsed = parseAiJsonResponse(content);
            if (parsed && parsed.length > 0) {
              const item = parsed[0];
              const headline = extractAiHeadline(item, candidate.title);
              const rawBody = extractAiBody(item);
              const body = rawBody ? clampEditorialBrief(rawBody, candidate) : "";
              const category = ["Tech", "AI", "Science", "Innovation", "Crypto"].includes(String(item.category))
                ? String(item.category)
                : "Tech";

              if (headline && body && body.length > 100) {
                return { headline, body, category };
              }
            }
          }
        } catch {
          // Fall through to next model
        }
      }
    }
  }

  return null;
}

export async function curateTenBytes(excludeKeys = new Set<string>()): Promise<CuratedByte[]> {
  let candidates: NewsCandidate[];
  try {
    candidates = await fetchTodayCandidates(excludeKeys);
  } catch (error) {
    console.error("[AICurator] News candidate retrieval failed", error);
    return [];
  }
  if (!candidates.length) return [];

  // S2S Coin Deduction (AI Curator costs 5 coins)
  const { deductCoins } = await import("./central.js");
  const deductionSuccessful = await deductCoins(0, 5); // Using 0 or a generic system ID
  if (!deductionSuccessful) {
    console.error("[AICurator] Insufficient coins or deduction failed. Skipping curation.");
    return [];
  }

  const mistralKey = getMistralApiKey();
  const nvidiaKey = getNvidiaApiKey();

  if (!mistralKey && !nvidiaKey) {
    console.warn(
      "[AICurator] No AI API key (MISTRAL_API_KEY, NVIDIA_API_KEY) configured. Skipping curation."
    );
    return [];
  }

  const seen = new Set<string>();

  interface DraftStoryItem {
    candidate: NewsCandidate;
    headline: string;
    body: string;
    category: string;
  }

  const draftItems: DraftStoryItem[] = [];

  // Generate AI briefs for candidates ONE BY ONE in small parallel chunks of 3 for max performance & zero rate limits
  const chunkSize = 3;
  for (let i = 0; i < candidates.length && draftItems.length < 10; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (candidate) => {
        if (seen.has(candidate.duplicateKey)) return null;
        seen.add(candidate.duplicateKey);
        const brief = await generateSingleCandidateBrief(candidate, mistralKey, nvidiaKey);
        if (!brief) return null;
        return {
          candidate,
          headline: brief.headline,
          body: brief.body,
          category: brief.category,
        };
      })
    );

    for (const res of chunkResults) {
      if (res && draftItems.length < 10) {
        draftItems.push(res);
      }
    }
  }

  console.info(`[AICurator] Successfully generated ${draftItems.length} authentic AI candidate briefs. Resolving cover images in parallel...`);

  // Resolve cover images for all 10 stories in parallel
  const curatedBytes: CuratedByte[] = await Promise.all(
    draftItems.map(async (draft) => {
      let imageUrl = draft.candidate.imageUrl;
      let provenance = "source-article";

      if (!imageUrl) {
        imageUrl = await extractSourceArticleImage(draft.candidate.url);
      }

      if (!imageUrl && getNvidiaApiKey()) {
        const fluxImg = await generateNvidiaFluxImage(draft.headline);
        if (fluxImg) {
          imageUrl = fluxImg;
          provenance = "nvidia-flux";
        }
      }

      if (!imageUrl) {
        imageUrl = generateEditorialSvgCard(draft.headline, draft.category);
        provenance = "editorial-card";
      }

      return {
        headline: draft.headline,
        body: draft.body,
        category: draft.category,
        imageUrl,
        sourceUrl: draft.candidate.url,
        sourcePublisher: draft.candidate.publisher,
        sourcePublishedAt: draft.candidate.publishedAt,
        duplicateKey: draft.candidate.duplicateKey,
        imageQuery: imageQuery(draft.headline),
        imageProvenance: provenance,
      };
    })
  );

  console.info(`[AICurator] Successfully curated ${curatedBytes.length} authentic Bytes.`);
  return curatedBytes;
}

export async function runNightlyCuration(status: "draft" | "published" = "draft"): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // 1. Fetch all existing duplicate keys from database to exclude prior curated stories
  const existingPosts = await db.select({ duplicateKey: posts.duplicateKey }).from(posts);
  const excludeKeys = new Set(existingPosts.map(p => p.duplicateKey).filter((k): k is string => Boolean(k)));

  // 2. Curate 10 uncurated Bytes
  const bytes = await curateTenBytes(excludeKeys);
  if (!bytes.length) return 0;

  let count = 0;
  for (const byte of bytes) {
    if (!byte.duplicateKey || excludeKeys.has(byte.duplicateKey)) continue;
    try {
      await db.insert(posts).values({
        headline: byte.headline,
        body: byte.body,
        category: byte.category || "Tech",
        imageUrl: byte.imageUrl,
        status,
        createdBy: 1,
        updatedAt: new Date(),
        sourceUrl: byte.sourceUrl,
        sourcePublisher: byte.sourcePublisher,
        sourcePublishedAt: byte.sourcePublishedAt,
        duplicateKey: byte.duplicateKey,
        imageQuery: byte.imageQuery,
        imageProvenance: byte.imageProvenance,
      });
      excludeKeys.add(byte.duplicateKey);
      count++;
    } catch (error) {
      console.error(`[AICurator] Skipping duplicate or failed insert for ${byte.sourceUrl}`, error);
    }
  }
  console.info(`[AICurator] Added ${count} validated ${status} Bytes`);
  return count;
}

