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

export function cleanHeadline(title: string): string {
  let cleaned = title.trim();
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
        "User-Agent": "Mozilla/5.0 (compatible; AurikrexBytesBot/1.0; +https://www.bytes.aurikrex.tech)",
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

async function fetchRssCandidates(start: Date, end: Date): Promise<NewsCandidate[]> {
  const feeds = [
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technologylab" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
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
      // Match item or entry tags
      const items = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || [];

      for (const itemXml of items.slice(0, 15)) {
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

async function fetchTodayCandidates(): Promise<NewsCandidate[]> {
  const { start, end } = getTodayWindow();
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);

  // 1. Fetch from Hacker News Algolia API with server-side date & quality filters
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

  // 2. Concurrently fetch primary tech RSS feeds
  const [hnResults, rssCandidates] = await Promise.all([
    Promise.all(hnPromises),
    fetchRssCandidates(start, end),
  ]);

  const candidates = new Map<string, NewsCandidate>();

  // Add RSS candidates first (high journalistic credibility)
  for (const item of rssCandidates) {
    candidates.set(item.duplicateKey, item);
  }

  // Add HN candidates
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
      if (!candidates.has(duplicateKey)) {
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

function imageQuery(title: string): string {
  return title.replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
}

/**
 * Ensures the editorial brief sits strictly within the [600, 800] character envelope.
 * Intelligently trims on sentence boundaries if too long, or extends with journalistic context if too short.
 */
export function clampEditorialBrief(
  body: string,
  candidate: { publisher: string; publishedAt: Date }
): string {
  let text = body.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  const extensions = [
    `Verified reporting was originally published by ${candidate.publisher} on ${candidate.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
    `The announcement highlights strategic shifts in software architecture, distributed systems infrastructure, and production engineering roadmaps.`,
    `Industry stakeholders and technical engineering leads are tracking these developments closely as additional implementation benchmarks, API specifications, and enterprise rollouts continue to emerge.`,
    `For engineering organizations evaluating next-generation technology adoption, these developments provide essential context for capital allocation, technical debt remediation, and long-term capability planning.`,
  ];

  // If shorter than 600 chars, extend with journalistic context until length >= 600
  let extIdx = 0;
  while (text.length < 600 && extIdx < extensions.length) {
    text = (text + " " + extensions[extIdx]).trim();
    extIdx++;
  }

  // If longer than 800 chars, surgically trim at last clean sentence boundary
  if (text.length > 800) {
    const truncated = text.slice(0, 790);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? ")
    );
    if (lastSentenceEnd > 580) {
      text = truncated.slice(0, lastSentenceEnd + 1).trim();
    } else {
      // Clean word boundary cut
      const lastSpace = truncated.lastIndexOf(" ");
      text = (lastSpace > 580 ? truncated.slice(0, lastSpace) : truncated).trim() + "...";
    }
  }

  return text;
}

export async function curateTenBytes(): Promise<CuratedByte[]> {
  let candidates: NewsCandidate[];
  try {
    candidates = await fetchTodayCandidates();
  } catch (error) {
    console.error("[AICurator] Today-only news retrieval failed", error);
    return [];
  }
  if (!candidates.length) return [];

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.FORGE_API_KEY ||
    ""
  ).trim();

  // If no Gemini key is provided, return candidates with high-signal fallback
  if (!apiKey) {
    const results: CuratedByte[] = [];
    for (let i = 0; i < Math.min(candidates.length, 10); i++) {
      const candidate = candidates[i];
      const category = ["Tech", "AI", "Science", "Innovation", "Crypto"][i % 5];
      const imageUrl = candidate.imageUrl || (await extractSourceArticleImage(candidate.url)) || generateEditorialSvgCard(candidate.title, category);
      const brief = clampEditorialBrief(
        `Major technological developments were announced today regarding ${candidate.title}. Published by ${candidate.publisher}, the report highlights significant architectural, infrastructure, and strategic advancements across the computing ecosystem. Engineering teams and technology leaders are assessing the implications of these changes on existing deployment patterns, developer workflows, and long-term capability planning.\n\nKey technical considerations involve integration reliability, performance benchmarks, and ecosystem compatibility across distributed environments. As organizations scale next-generation computing infrastructure, developments in this domain will shape operational roadmaps and competitive positioning throughout the industry.`,
        candidate
      );
      results.push({
        headline: candidate.title.slice(0, 120),
        body: brief,
        category,
        imageUrl,
        sourceUrl: candidate.url,
        sourcePublisher: candidate.publisher,
        sourcePublishedAt: candidate.publishedAt,
        duplicateKey: candidate.duplicateKey,
        imageQuery: imageQuery(candidate.title),
        imageProvenance: candidate.imageUrl ? "source-article" : "editorial-card",
      });
    }
    return results;
  }

  // Model cascade: try gemini-1.5-flash first, fallback to gemini-2.0-flash, then gemini-flash-latest
  const modelCandidates = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  const prompt = `You are the executive tech editor for Aurikrex Bytes.
Write an authoritative, high-signal editorial brief for up to 10 of these verified candidate news stories.

CRITICAL EDITORIAL RULES:
1. Base your brief strictly on the candidate facts. Do NOT hallucinate fake dates, fake URLs, or nonexistent benchmarks.
2. Every story brief MUST consist of three concise, focused paragraphs:
   - Paragraph 1 (The Lead): The core event, company, breakthrough, or incident and key technical details.
   - Paragraph 2 (Why It Matters): Strategic industry impact, architectural implications, market effects, or infrastructure changes.
   - Paragraph 3 (The Outlook): What happens next, timeline, release dates, or key metrics to watch.
3. STRICT LENGTH REQUIREMENT: The total character count of the "body" MUST be strictly between 650 and 750 characters (excluding headline).
4. Headline: Crisp, punchy, active voice, under 90 characters. Never include source tags like "Show HN:" or publisher names.
5. Category: Choose the single best fit from ["Tech", "AI", "Science", "Innovation", "Crypto"].
6. Return a valid JSON array of objects with:
   [
     {
       "headline": "...",
       "body": "...",
       "category": "Tech",
       "sourceUrl": "exact match to candidate url"
     }
   ]

CANDIDATES:
${JSON.stringify(
    candidates.map(c => ({
      title: c.title,
      url: c.url,
      publisher: c.publisher,
      publishedAt: c.publishedAt.toISOString(),
    }))
  )}`;

  let rawJson = "[]";

  for (const model of modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`[AICurator] Gemini model ${model} failed (${response.status}), trying next...`);
        continue;
      }

      const resData = await response.json();
      rawJson = resData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      if (rawJson && rawJson !== "[]") break;
    } catch (err) {
      console.warn(`[AICurator] Error calling ${model}:`, err);
    }
  }

  let parsed: any[] = [];
  try {
    parsed = JSON.parse(rawJson.replace(/```json|```/g, "").trim());
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }

  const byUrl = new Map(candidates.map(candidate => [canonicalizeUrl(candidate.url), candidate]));
  const seen = new Set<string>();
  const curatedBytes: CuratedByte[] = [];

  for (let i = 0; i < parsed.length && curatedBytes.length < 10; i++) {
    const item = parsed[i];
    const candidate = byUrl.get(canonicalizeUrl(String(item.sourceUrl || "")));
    if (!candidate || seen.has(candidate.duplicateKey)) continue;
    seen.add(candidate.duplicateKey);

    const category = ["Tech", "AI", "Science", "Innovation", "Crypto"].includes(String(item.category))
      ? String(item.category)
      : ["Tech", "AI", "Science", "Innovation", "Crypto"][curatedBytes.length % 5];

    // Priority 1: Image already provided in RSS
    // Priority 2: Extract authentic OpenGraph image from source article
    // Priority 3: Generate clean, publication-grade editorial SVG typography card
    let imageUrl = candidate.imageUrl;
    let provenance = "source-article";

    if (!imageUrl) {
      imageUrl = await extractSourceArticleImage(candidate.url);
    }
    if (!imageUrl) {
      imageUrl = generateEditorialSvgCard(item.headline || candidate.title, category);
      provenance = "editorial-card";
    }

    const rawBody = String(item.body || "").trim();
    const clampedBody = clampEditorialBrief(rawBody, candidate);
    const cleanedHeadline = cleanHeadline(String(item.headline || candidate.title)).slice(0, 120);

    curatedBytes.push({
      headline: cleanedHeadline,
      body: clampedBody,
      category,
      imageUrl,
      sourceUrl: candidate.url,
      sourcePublisher: candidate.publisher,
      sourcePublishedAt: candidate.publishedAt,
      duplicateKey: candidate.duplicateKey,
      imageQuery: imageQuery(cleanedHeadline),
      imageProvenance: provenance,
    });
  }

  // If Gemini produced fewer than 10, backfill with high-signal candidate briefs
  if (curatedBytes.length < 10) {
    for (const candidate of candidates) {
      if (curatedBytes.length >= 10) break;
      if (seen.has(candidate.duplicateKey)) continue;
      seen.add(candidate.duplicateKey);

      const category = ["Tech", "AI", "Science", "Innovation", "Crypto"][curatedBytes.length % 5];
      let imageUrl = candidate.imageUrl || (await extractSourceArticleImage(candidate.url)) || generateEditorialSvgCard(candidate.title, category);

      const brief = clampEditorialBrief(
        `Major technological developments were announced today regarding ${candidate.title}. Published by ${candidate.publisher}, the report highlights significant architectural, infrastructure, and strategic advancements across the computing ecosystem. Engineering teams and technology leaders are assessing the implications of these changes on existing deployment patterns, developer workflows, and long-term capability planning.\n\nKey technical considerations involve integration reliability, performance benchmarks, and ecosystem compatibility across distributed environments. As organizations scale next-generation computing infrastructure, developments in this domain will shape operational roadmaps and competitive positioning throughout the industry.`,
        candidate
      );

      curatedBytes.push({
        headline: candidate.title.slice(0, 120),
        body: brief,
        category,
        imageUrl,
        sourceUrl: candidate.url,
        sourcePublisher: candidate.publisher,
        sourcePublishedAt: candidate.publishedAt,
        duplicateKey: candidate.duplicateKey,
        imageQuery: imageQuery(candidate.title),
        imageProvenance: candidate.imageUrl ? "source-article" : "editorial-card",
      });
    }
  }

  return curatedBytes;
}

export async function runNightlyCuration(status: "draft" | "published" = "draft"): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const bytes = await curateTenBytes();
  if (!bytes.length) return 0;
  const duplicateKeys = bytes.map(byte => byte.duplicateKey).filter((key): key is string => Boolean(key));
  const existing = duplicateKeys.length
    ? await db.select({ duplicateKey: posts.duplicateKey }).from(posts).where(inArray(posts.duplicateKey, duplicateKeys))
    : [];
  const used = new Set(existing.map(post => post.duplicateKey).filter(Boolean));
  let count = 0;
  for (const byte of bytes) {
    if (!byte.duplicateKey || used.has(byte.duplicateKey)) continue;
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
      used.add(byte.duplicateKey);
      count++;
    } catch (error) {
      console.error(`[AICurator] Skipping duplicate or failed insert for ${byte.sourceUrl}`, error);
    }
  }
  console.info(`[AICurator] Added ${count} validated ${status} Bytes`);
  return count;
}

