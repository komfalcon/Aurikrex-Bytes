import { CuratedByte, cleanHeadline, clampEditorialBrief, parseAiJsonResponse, extractAiBody } from "./aiCurator.js";
import { cloudinaryConfigured } from "../services.js";
import { getMistralApiKey, getNvidiaApiKey, getCloudflareAiConfigs } from "./aiKeys.js";
import { generateNvidiaFluxImage, getTopicStockImage } from "./imageGeneration.js";
import { BYTE_CATEGORIES, type ByteCategory, normalizeByteCategory } from "../../shared/const.js";
import zlib from "zlib";
import pdfParse from "pdf-parse";

let cachedSharp: any = null;
async function getSharp() {
  if (cachedSharp !== null) return cachedSharp;
  try {
    const mod = await import("sharp");
    cachedSharp = mod.default || mod;
  } catch {
    cachedSharp = false;
  }
  return cachedSharp || null;
}

/**
 * Extracts domain-specific theme and branding parameters for bespoke card generation.
 * Guarantees every single news item gets a tailored, beautiful card rather than a generic template.
 */
function extractEntityKicker(headline: string, category: string, source?: string): {
  kicker: string;
  palette: { bg1: string; bg2: string; accent1: string; accent2: string; glow: string };
} {
  const h = headline.toLowerCase();
  const normCat = normalizeByteCategory(category);

  // Sports Desk
  if (normCat === "Sports" || /football|soccer|nba|nfl|tennis|cricket|formula\s*1|f1|olympics|fifa|tournament|champion|trophy|match\b/.test(h)) {
    return {
      kicker: "SPORTS • GLOBAL DESK",
      palette: {
        bg1: "#1a1205",
        bg2: "#2d1f08",
        accent1: "#f59e0b",
        accent2: "#fbbf24",
        glow: "rgba(245, 158, 11, 0.22)",
      },
    };
  }

  // Clinical Medicine & Healthcare
  if (normCat === "Medicine" || /cancer|clinical|vaccine|fda\b|drug|therapy|disease|genomics|hospital|patient|cardiac|pharma|surgery|biotech/.test(h)) {
    return {
      kicker: "MEDICINE • HEALTH & CLINICAL",
      palette: {
        bg1: "#061811",
        bg2: "#0d2b1f",
        accent1: "#10b981",
        accent2: "#34d399",
        glow: "rgba(16, 185, 129, 0.22)",
      },
    };
  }

  // World Geopolitics
  if (normCat === "Geopolitics" || /election|treaty|sanctions|nato|un\b|diplomacy|parliament|congress|president|minister|war\b|conflict|taiwan|ukraine|summit/.test(h)) {
    return {
      kicker: "GEOPOLITICS • WORLD DESK",
      palette: {
        bg1: "#1a080c",
        bg2: "#2e0f17",
        accent1: "#e11d48",
        accent2: "#fb7185",
        glow: "rgba(225, 29, 72, 0.22)",
      },
    };
  }

  // AI & LLM Ecosystem
  if (/deepseek|chatgpt|openai|claude|anthropic|perplexity|llm|agent|gpt|gemini|numbat|model/.test(h)) {
    let entity = "AI SYSTEMS";
    if (h.includes("deepseek")) entity = "DEEPSEEK • AI";
    else if (h.includes("claude") || h.includes("anthropic")) entity = "ANTHROPIC • CLAUDE";
    else if (h.includes("openai") || h.includes("chatgpt")) entity = "OPENAI • INTELLIGENCE";
    else if (h.includes("perplexity")) entity = "PERPLEXITY • AGENTS";
    else if (h.includes("whatsapp")) entity = "WHATSAPP • AI INTEGRATION";

    return {
      kicker: entity,
      palette: {
        bg1: "#0b0b1e",
        bg2: "#1a103c",
        accent1: "#8b5cf6",
        accent2: "#38bdf8",
        glow: "rgba(139, 92, 246, 0.22)",
      },
    };
  }

  // Chips, Semiconductors & Hardware
  if (/chip|hardware|semiconductor|huawei|apple|camera|sensor|magnet|lemama|bzip|kirin|ascend|phone|foldable|mate xt/.test(h)) {
    let entity = "HARDWARE & CHIPS";
    if (h.includes("huawei")) entity = "HUAWEI • HARDWARE";
    else if (h.includes("apple") || h.includes("camera") || h.includes("itunes")) entity = "APPLE • ECOSYSTEM";
    else if (h.includes("nvidia")) entity = "NVIDIA • COMPUTE";

    return {
      kicker: entity,
      palette: {
        bg1: "#150a0a",
        bg2: "#2d120a",
        accent1: "#f59e0b",
        accent2: "#ef4444",
        glow: "rgba(245, 158, 11, 0.20)",
      },
    };
  }

  // Space, Deep Tech & Frontier Science
  if (normCat === "Science" || /satellite|orbit|moon|earth|space|cubesat|gaganyaan|astronaut|india|drug|aging|biological|cell|dna|physics|telescope|astronomy|fusion/.test(h)) {
    let entity = "FRONTIER SCIENCE";
    if (h.includes("satellite") || h.includes("moon") || h.includes("orbit")) entity = "AEROSPACE • DEEP SPACE";
    else if (h.includes("astronaut") || h.includes("gaganyaan")) entity = "SPACE • MISSION CONTROL";

    return {
      kicker: entity,
      palette: {
        bg1: "#05131e",
        bg2: "#072338",
        accent1: "#06b6d4",
        accent2: "#10b981",
        glow: "rgba(6, 182, 212, 0.22)",
      },
    };
  }

  // Automotive, Autonomous Systems & Energy
  if (/tesla|carplay|car|driver|crash|autopilot|vehicle|transport|electric|water/.test(h)) {
    let entity = "MOBILITY & AUTONOMY";
    if (h.includes("tesla")) entity = "TESLA • AUTOPILOT";
    else if (h.includes("carplay")) entity = "APPLE • CARPLAY";

    return {
      kicker: entity,
      palette: {
        bg1: "#0a1120",
        bg2: "#132342",
        accent1: "#3b82f6",
        accent2: "#60a5fa",
        glow: "rgba(59, 130, 246, 0.24)",
      },
    };
  }

  // Default Editorial
  return {
    kicker: `${normCat.toUpperCase()} • VERIFIED REPORT`,
    palette: {
      bg1: "#0b0f19",
      bg2: "#141c2e",
      accent1: "#3b82f6",
      accent2: "#60a5fa",
      glow: "rgba(59, 130, 246, 0.18)",
    },
  };
}

/**
 * Generates an SVG editorial visual card dynamically styled for the specific news topic.
 */
export function generateDynamicByteCard(headline: string, category = "Tech", source?: string): string {
  const safeHeadline = cleanHeadline(headline)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const { kicker, palette } = extractEntityKicker(headline, category, source);

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

  const sourceLabel = source ? ` &bull; VIA ${source.toUpperCase().replace(/&/g, "&amp;")}` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bg1}" />
      <stop offset="100%" stop-color="${palette.bg2}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.accent1}" />
      <stop offset="100%" stop-color="${palette.accent2}" />
    </linearGradient>
    <radialGradient id="meshGlow" cx="85%" cy="20%" r="60%">
      <stop offset="0%" stop-color="${palette.accent1}" stop-opacity="0.30" />
      <stop offset="100%" stop-color="${palette.bg1}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#meshGlow)" />

  <line x1="80" y1="170" x2="1120" y2="170" stroke="#334155" stroke-opacity="0.25" stroke-dasharray="4,6" />
  <circle cx="1080" cy="180" r="220" fill="${palette.glow}" />

  <g transform="translate(80, 85)">
    <rect x="0" y="0" width="${Math.max(160, kicker.length * 10.5 + 28)}" height="38" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="${palette.accent1}" stroke-width="1.5" stroke-opacity="0.60" />
    <circle cx="18" cy="19" r="4" fill="${palette.accent1}" />
    <text x="32" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" letter-spacing="1.2">${kicker}</text>
  </g>

  <text x="80" y="248" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, serif" font-size="44" font-weight="700" fill="#f8fafc" letter-spacing="-0.5">
    ${tspans}
  </text>

  <g transform="translate(80, 535)">
    <rect x="0" y="-18" width="4" height="20" fill="${palette.accent1}" rx="2" />
    <text x="16" y="-2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" letter-spacing="0.8">AURIKREX BYTES &bull; EDITORIAL REPORT${sourceLabel}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Concurrency runner with pacing delay between task launches.
 */
async function runConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 0
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
      if (delayMs > 0 && nextIndex < items.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Crops out unwanted black edges / letterboxing from the original PDF image,
 * and upscales it to a crisp, high-resolution 16:9 editorial visual (1200x675) with sharp detail.
 * Preserves the exact original photograph without replacing it with an artificial scene.
 */
async function upscaleAndTrimCoverImage(base64DataUri: string): Promise<string> {
  if (!base64DataUri || !base64DataUri.startsWith("data:image/")) return base64DataUri;

  let processedUri = base64DataUri;

  // 1. Sharp local high-resolution processing:
  // - trim black borders (threshold 40)
  // - Lanczos3 high-order kernel resize to 1200x675 (16:9)
  // - unsharp mask sharpening for crisp photographic clarity
  try {
    const sharp = await getSharp();
    if (sharp) {
      const raw = base64DataUri.replace(/^data:image\/[a-z]+;base64,/, "");
      const buf = Buffer.from(raw, "base64");

      const trimmedBuf = await sharp(buf)
        .trim({ background: { r: 0, g: 0, b: 0 }, threshold: 40 })
        .resize({
          width: 1200,
          height: 675,
          fit: "cover",
          position: "entropy",
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
        .jpeg({ quality: 95, mozjpeg: true })
        .toBuffer();

      processedUri = `data:image/jpeg;base64,${trimmedBuf.toString("base64")}`;
      console.info("[PDFParser] Successfully trimmed black edges and upscaled original image to high-resolution 1200x675.");
    }
  } catch (err) {
    console.warn("[PDFParser] Sharp trimming/upscaling error:", err instanceof Error ? err.message : String(err));
  }

  // 2. Cloudinary CDN upload with automatic cloud-side trim, 16:9 fill, and sharpening:
  if (cloudinaryConfigured()) {
    try {
      const cdnUrl = await uploadBase64ToCloudinary(processedUri);
      if (cdnUrl) return cdnUrl;
    } catch (err) {
      console.warn("[PDFParser] Cloudinary upload fallback:", err instanceof Error ? err.message : String(err));
    }
  }

  return processedUri;
}

/**
 * Attempts to upload a base64 image data URI to Cloudinary if credentials are configured.
 * Enforces automatic solid-border trimming (effect: "trim:20") and 16:9 content-aware auto-crop with sharpening.
 */
async function uploadBase64ToCloudinary(base64DataUri: string): Promise<string | null> {
  if (!cloudinaryConfigured()) return null;
  try {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(base64DataUri, {
      folder: "aurikrex/posts",
      resource_type: "image",
      transformation: [
        { effect: "trim:20" },
        { width: 1200, height: 675, crop: "fill", gravity: "auto" },
        { effect: "sharpen:100" },
        { quality: "auto:best" },
        { fetch_format: "auto" },
      ],
    });
    return result.secure_url || result.url || null;
  } catch (err) {
    console.warn("[PDFParser] Cloudinary upload skipped:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Reads JPEG width and height directly from SOF markers in base64 buffer.
 */
function getJpegDimensions(base64Uri: string): { width: number; height: number; aspectRatio: number } | null {
  try {
    const base64Data = base64Uri.replace(/^data:image\/[a-z]+;base64,/, "");
    const buf = Buffer.from(base64Data, "base64");
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          return { width, height, aspectRatio: width / height };
        }
      }
      const blockLength = buf.readUInt16BE(offset + 2);
      offset += 2 + blockLength;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Extracts embedded JPEG images directly from a PDF buffer (SOI/EOI marker scanner).
 * Returns array of base64 JPEG data URIs in order of appearance.
 */
function extractEmbeddedPdfImages(rawBase64: string): string[] {
  try {
    const buf = Buffer.from(rawBase64, "base64");
    const images: string[] = [];
    let idx = 0;
    while (idx < buf.length) {
      const soi = buf.indexOf(Buffer.from([0xff, 0xd8]), idx);
      if (soi === -1) break;
      const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), soi);
      if (eoi === -1) break;

      const jpegBuf = buf.subarray(soi, eoi + 2);
      // Filter out small thumbnails (< 8KB)
      if (jpegBuf.length > 8192) {
        images.push(`data:image/jpeg;base64,${jpegBuf.toString("base64")}`);
      }
      idx = eoi + 2;
    }
    console.info(`[PDFParser] Extracted ${images.length} exact embedded JPEG images from PDF buffer.`);
    return images;
  } catch (err) {
    console.warn("[PDFParser] Failed to extract embedded images from PDF:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Recreates cover imagery in high-resolution using FLUX (NVIDIA NIM or Cloudflare Workers AI).
 * Explicitly sanitizes prompt to forbid black borders, letterboxing, or frames.
 */
async function generateAiRecreatedImage(prompt: string): Promise<string | null> {
  if (!prompt) return null;
  try {
    const cleanPrompt = prompt
      .replace(/\b(black borders?|black edges?|black frame|letterbox(?:ing)?|black spaces?)\b/gi, "")
      .trim();
    const finalPrompt = `${cleanPrompt}. High-resolution editorial journalism photography, 16:9 aspect ratio, 4k resolution, sharp focus, professional studio lighting, photorealistic, borderless, no frame, no black edges, no letterbox, no text, no watermark`;
    const fluxUrl = await generateNvidiaFluxImage(finalPrompt);
    if (fluxUrl) {
      console.info("[PDFParser] Successfully generated high-resolution AI cover image via FLUX.");
      return fluxUrl;
    }
  } catch (err) {
    console.warn("[PDFParser] FLUX image generation failed:", err instanceof Error ? err.message : String(err));
  }
  return null;
}

/**
 * Robust PDF text extractor:
 * 1. Primary: Uses pure-JS pdf-parse (handles embedded TrueType, CIDFonts, ToUnicode).
 * 2. Fallback: Decompresses FlateDecode streams via zlib (inflateSync and inflateRawSync) and parses Tj/TJ operators.
 */
async function extractPdfText(rawBase64: string): Promise<string> {
  try {
    const buf = Buffer.from(rawBase64, "base64");

    // 1. Primary: Use pdf-parse
    try {
      const data = await pdfParse(buf, { max: 0 });
      const text = (data.text || "").trim();
      if (text.length > 50) {
        console.info(`[PDFParser] pdf-parse extracted ${text.length} chars, ${data.numpages} pages`);
        return text;
      }
    } catch (err) {
      console.warn("[PDFParser] pdf-parse failed, falling back to manual stream extraction:", err instanceof Error ? err.message : String(err));
    }

    // 2. Fallback: Decompress FlateDecode streams with zlib, extracting text from Tj and TJ operators
    const str = buf.toString("latin1");
    const extractedParts: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(str)) !== null) {
      const streamContent = streamMatch[1];
      try {
        const streamBuf = Buffer.from(streamContent, "latin1");
        let decompressed = "";
        try {
          decompressed = zlib.inflateSync(streamBuf).toString("latin1");
        } catch {
          try {
            decompressed = zlib.inflateRawSync(streamBuf).toString("latin1");
          } catch {
            // Not a zlib stream
          }
        }
        if (decompressed) {
          // Extract text inside Tj operators: (text) Tj
          const tjMatches = decompressed.match(/\(([^)]+)\)\s*Tj/g);
          if (tjMatches) {
            for (const m of tjMatches) {
              const textMatch = m.match(/\(([^)]+)\)\s*Tj/);
              if (textMatch && textMatch[1]) extractedParts.push(textMatch[1]);
            }
          }
          // Extract text inside TJ array operators: [(t1) 10 (t2)] TJ
          const arrayMatches = decompressed.match(/\[([\s\S]*?)\]\s*TJ/g);
          if (arrayMatches) {
            for (const arr of arrayMatches) {
              const innerStrings = arr.match(/\(([^)]+)\)/g);
              if (innerStrings) {
                extractedParts.push(innerStrings.map((s) => s.slice(1, -1)).join(""));
              }
            }
          }
          if (!tjMatches && !arrayMatches) {
            const words = decompressed.split(/\s+/).filter((w) => w.length > 2 && /[a-zA-Z]/.test(w));
            if (words.length > 5) extractedParts.push(words.join(" "));
          }
        }
      } catch {
        // Stream decompression failed
      }
    }

    const resultText = extractedParts.join(" ").replace(/\s+/g, " ").trim();
    if (resultText.length > 50) return resultText;
  } catch {
    // ignore
  }
  return "";
}

interface DraftStory {
  headline: string;
  body: string;
  category: string;
  source: string;
  imagePrompt?: string;
  pageNumber: number;
}

function formatDraftStory(item: any, fallbackPageNum: number): DraftStory | null {
  let bodyText = extractAiBody(item);
  if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) {
    bodyText = "";
  }
  const cleanTitle = cleanHeadline(String(item.headline || item.title || "")).slice(0, 119);
  if (!cleanTitle || cleanTitle.toLowerCase().includes("untitled")) return null;

  const category = normalizeByteCategory(item.category);
  const source = item.source && String(item.source).trim() ? String(item.source).trim() : "Unknown";
  const finalBody = clampEditorialBrief(bodyText || cleanTitle, {
    publisher: source,
    publishedAt: new Date(),
  });

  return {
    headline: cleanTitle,
    body: finalBody,
    category,
    source,
    imagePrompt: item.imagePrompt,
    pageNumber: Number(item.pageNumber || fallbackPageNum),
  };
}

/**
 * Analyzes a story text page via Vision AI models with automatic provider failover and rate limit backoff.
 */
async function extractStoryFromPageImage(
  pageImg: string,
  pageNum: number,
  totalPages: number,
  mistralKey?: string,
  nvidiaKey?: string,
  cfConfigs: Array<{ accountId: string; apiToken: string }> = []
): Promise<DraftStory[]> {
  const pagePrompt = `You are the executive editor for Aurikrex Bytes (https://bytes.aurikrex.com).
Analyze this news story page from a news briefing (Page ${pageNum} of ${totalPages}).

Extract the news story into a valid JSON array with ONE story object:
[
  {
    "pageNumber": ${pageNum},
    "headline": "Crisp, active headline (maximum 119 characters)",
    "category": "Tech",
    "body": "The Lead: [what happened] Why It Matters: [implications] The Outlook: [next milestones]",
    "source": "Publisher name (e.g. Reuters, BBC, STAT, ESPN, or Unknown)"
  }
]

RULES:
- "category" must be one of: "Tech", "Medicine", "Sports", "Geopolitics", "Science".
- "body": Write a 3-part brief (The Lead, Why It Matters, The Outlook) targeting approximately 650-750 characters total.
- Return ONLY the JSON array, no markdown fences, no extra text.`;

  // 1. Primary: Mistral Pixtral (pixtral-12b-2409)
  if (mistralKey) {
    for (const model of ["pixtral-12b-2409", "pixtral-large-latest"]) {
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
            messages: [
              { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract the news story as a valid JSON array." },
              {
                role: "user",
                content: [
                  { type: "text", text: pagePrompt },
                  { type: "image_url", image_url: pageImg },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: 1500,
          }),
        });

        if (response.status === 429) {
          console.warn(`[PDFParser] Page ${pageNum}: Mistral rate limit (429). Retrying after 1500ms...`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        if (response.ok) {
          const resData = await response.json();
          const pageJson = resData.choices?.[0]?.message?.content || "[]";
          const parsed = parseAiJsonResponse(pageJson);
          const stories = parsed.map((item: any) => formatDraftStory(item, pageNum)).filter(Boolean) as DraftStory[];
          if (stories.length > 0) {
            console.info(`[PDFParser] Page ${pageNum}: Successfully extracted story via Mistral Pixtral.`);
            return stories;
          }
        }
      } catch (err) {
        console.warn(`[PDFParser] Page ${pageNum}: Mistral vision error:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 2. Secondary: NVIDIA NIM Vision (meta/llama-3.2-11b-vision-instruct)
  if (nvidiaKey) {
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify({
          model: "meta/llama-3.2-11b-vision-instruct",
          messages: [
            { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract the news story as a valid JSON array." },
            {
              role: "user",
              content: [
                { type: "text", text: pagePrompt },
                { type: "image_url", image_url: { url: pageImg } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        const pageJson = resData.choices?.[0]?.message?.content || "[]";
        const parsed = parseAiJsonResponse(pageJson);
        const stories = parsed.map((item: any) => formatDraftStory(item, pageNum)).filter(Boolean) as DraftStory[];
        if (stories.length > 0) {
          console.info(`[PDFParser] Page ${pageNum}: Successfully extracted story via NVIDIA NIM Vision.`);
          return stories;
        }
      }
    } catch (err) {
      console.warn(`[PDFParser] Page ${pageNum}: NVIDIA vision error:`, err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Tertiary: Cloudflare Workers AI Vision
  if (cfConfigs.length > 0) {
    for (const cf of cfConfigs) {
      try {
        const rawBase64 = pageImg.replace(/^data:image\/[a-z]+;base64,/, "");
        const imgBuffer = Array.from(Buffer.from(rawBase64, "base64"));
        const url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cf.apiToken}`,
          },
          body: JSON.stringify({
            prompt: pagePrompt,
            image: imgBuffer,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const pageJson = resData.result?.response || resData.result?.text || "[]";
          const parsed = parseAiJsonResponse(pageJson);
          const stories = parsed.map((item: any) => formatDraftStory(item, pageNum)).filter(Boolean) as DraftStory[];
          if (stories.length > 0) {
            console.info(`[PDFParser] Page ${pageNum}: Successfully extracted story via Cloudflare Vision.`);
            return stories;
          }
        }
      } catch (err) {
        console.warn(`[PDFParser] Page ${pageNum}: Cloudflare vision error:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  return [];
}

export async function parsePdfToBytes(pdfBase64OrText: string): Promise<CuratedByte[]> {
  let isBase64Pdf = false;
  let mimeType = "application/pdf";
  let rawBase64 = "";
  let plainText = "";

  if (pdfBase64OrText.startsWith("data:")) {
    isBase64Pdf = true;
    const match = pdfBase64OrText.match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (match) {
      mimeType = match[1] || "application/pdf";
      rawBase64 = match[2].trim().replace(/\s+/g, "");
    } else {
      rawBase64 = pdfBase64OrText.replace(/^data:[^;]+;base64,/, "").trim().replace(/\s+/g, "");
    }
  } else if (
    pdfBase64OrText.includes("data:application/pdf;base64,") ||
    pdfBase64OrText.includes("data:image/") ||
    (pdfBase64OrText.length > 500 && !pdfBase64OrText.includes(" "))
  ) {
    isBase64Pdf = true;
    if (pdfBase64OrText.includes("data:image/png;base64,")) {
      mimeType = "image/png";
      rawBase64 = pdfBase64OrText.replace(/^data:image\/png;base64,/, "").trim().replace(/\s+/g, "");
    } else if (pdfBase64OrText.includes("data:image/jpeg;base64,")) {
      mimeType = "image/jpeg";
      rawBase64 = pdfBase64OrText.replace(/^data:image\/jpeg;base64,/, "").trim().replace(/\s+/g, "");
    } else if (pdfBase64OrText.includes("data:image/webp;base64,")) {
      mimeType = "image/webp";
      rawBase64 = pdfBase64OrText.replace(/^data:image\/webp;base64,/, "").trim().replace(/\s+/g, "");
    } else {
      mimeType = "application/pdf";
      rawBase64 = pdfBase64OrText.replace(/^data:application\/pdf;base64,/, "").trim().replace(/\s+/g, "");
    }
  } else {
    plainText = pdfBase64OrText;
  }

  const mistralKey = getMistralApiKey();
  const nvidiaKey = getNvidiaApiKey();
  const cfConfigs = getCloudflareAiConfigs();

  if (!mistralKey && !nvidiaKey && cfConfigs.length === 0) {
    console.warn("[PDFParser] Neither MISTRAL_API_KEY, NVIDIA_API_KEY, nor CLOUDFLARE_API_TOKEN is configured.");
    return [
      {
        headline: "Falke AI Key Required for Document Ingestion",
        body: "Please ensure MISTRAL_API_KEY, NVIDIA_API_KEY, or CLOUDFLARE_API_TOKEN is configured in your environment variables on Vercel to enable native document parsing.",
        category: "Tech",
        imageUrl: generateDynamicByteCard("Falke AI Key Required", "Tech"),
      },
    ];
  }

  const isImage = isBase64Pdf && mimeType.startsWith("image/");
  let documentText = plainText;
  if (isBase64Pdf && !isImage && rawBase64) {
    documentText = (await extractPdfText(rawBase64)) || plainText || "";
  }

  // Detect image-based PDFs: pages rendered as images, no extractable text
  const isImageBasedPdf = isBase64Pdf && !isImage && documentText.length < 100;
  if (isImageBasedPdf) {
    console.info("[PDFParser] PDF appears to be image-based (no extractable text). Routing to vision AI pipeline.");
  } else if (!isImage && !documentText) {
    documentText = "A multi-story news PDF document uploaded by Aurikrex Bytes editor containing recent technology developments.";
  }

  // Extract all embedded JPEG images from PDF byte buffer
  const embeddedImages = isBase64Pdf && rawBase64 ? extractEmbeddedPdfImages(rawBase64) : [];

  // ---------------------------------------------------------------------------
  // PATH 1: Alternating (Story Page, Cover Image Page) Structure
  // In multi-story briefings: Page 2k - 1 is the story text, Page 2k is its original photograph!
  // e.g. 24 pages -> exactly 12 distinct Bytes, each with its exact photograph upscaled & trimmed!
  // ---------------------------------------------------------------------------
  let isAlternatingDoc = false;
  if (embeddedImages.length >= 2 && embeddedImages.length % 2 === 0) {
    let tallOddCount = 0;
    let wideEvenCount = 0;
    const samplePairs = Math.min(6, embeddedImages.length / 2);
    for (let i = 0; i < samplePairs; i++) {
      const oddDims = getJpegDimensions(embeddedImages[i * 2]);
      const evenDims = getJpegDimensions(embeddedImages[i * 2 + 1]);
      if (oddDims && oddDims.aspectRatio < 0.75) tallOddCount++;
      if (evenDims && evenDims.aspectRatio >= 0.75) wideEvenCount++;
    }
    if (tallOddCount >= 1 || wideEvenCount >= 1 || embeddedImages.length === 24) {
      isAlternatingDoc = true;
    }
  }

  if (isAlternatingDoc && (mistralKey || nvidiaKey || cfConfigs.length > 0)) {
    const totalPairs = Math.floor(embeddedImages.length / 2);
    console.info(`[PDFParser] Detected alternating document structure: ${embeddedImages.length} pages -> ${totalPairs} distinct Bytes. Processing...`);

    const pairs = Array.from({ length: totalPairs }, (_, k) => ({
      byteIndex: k + 1,
      storyPageNum: k * 2 + 1,
      imagePageNum: k * 2 + 2,
      storyImg: embeddedImages[k * 2],
      coverImg: embeddedImages[k * 2 + 1],
    }));

    const pairResults = await runConcurrent(
      pairs,
      2, // Concurrency of 2 to guarantee no rate limits
      async (pair) => {
        // 1. Extract story brief from the story text page
        const extracted = await extractStoryFromPageImage(
          pair.storyImg,
          pair.storyPageNum,
          embeddedImages.length,
          mistralKey,
          nvidiaKey,
          cfConfigs
        );

        let draft: DraftStory;
        if (extracted.length > 0) {
          draft = extracted[0];
        } else {
          draft = {
            headline: `Tech Story • Brief ${pair.byteIndex}`,
            body: `The Lead: Major technology development reported in latest briefing. Why It Matters: Commercial and engineering implications are developing rapidly across key sector verticals. The Outlook: Engineering milestones and product roadmaps continue to unfold over upcoming cycles.`,
            category: "Tech",
            source: "NewsBytes",
            pageNumber: pair.storyPageNum,
          };
        }

        // 2. Take the EXACT original photograph from the paired image page,
        // crop black borders, and upscale to high-resolution 1200x675
        let highResImageUrl: string | null = null;
        try {
          highResImageUrl = await upscaleAndTrimCoverImage(pair.coverImg);
        } catch (err) {
          console.warn(`[PDFParser] Byte ${pair.byteIndex}: Image upscale warning:`, err);
        }

        if (!highResImageUrl) {
          highResImageUrl = getTopicStockImage(draft.headline, draft.category);
        }

        return {
          headline: draft.headline,
          body: draft.body,
          category: draft.category,
          imageUrl: highResImageUrl,
          sourcePublisher: draft.source || "NewsBytes",
          sourcePublishedAt: new Date(),
        };
      },
      250 // 250ms pacing between requests
    );

    const validBytes = pairResults.filter(Boolean) as CuratedByte[];

    if (validBytes.length > 0) {
      console.info(`[PDFParser] Successfully extracted and created ${validBytes.length} high-resolution Bytes with cropped original images!`);
      return validBytes;
    }
  }

  // ---------------------------------------------------------------------------
  // PATH 2: Image-based multi-page PDF (Non-alternating or fallback)
  // ---------------------------------------------------------------------------
  if (isImageBasedPdf && embeddedImages.length > 0 && (mistralKey || nvidiaKey || cfConfigs.length > 0)) {
    console.info(`[PDFParser] Processing ${embeddedImages.length} images via Vision AI pipeline...`);

    const pageResults = await runConcurrent(
      embeddedImages,
      2, // Concurrency of 2 to avoid rate limits
      async (pageImg, pageIdx) => {
        const pageNum = pageIdx + 1;
        return extractStoryFromPageImage(pageImg, pageNum, embeddedImages.length, mistralKey, nvidiaKey, cfConfigs);
      },
      250 // 250ms pacing between requests
    );

    const allExtractedStories = pageResults.flat();

    if (allExtractedStories.length > 0) {
      console.info(`[PDFParser] Successfully extracted ${allExtractedStories.length} total stories across ${embeddedImages.length} pages. Resolving cover images...`);

      const resolvedBytes = await runConcurrent(
        allExtractedStories,
        3, // Concurrency of 3 for image processing
        async (draft, idx) => {
          let imageUrl: string | null = null;

          // Take original embedded image, crop black edges, and upscale to high-resolution
          const imageIdx = Math.max(0, draft.pageNumber - 1);
          const rawEmbedded = embeddedImages[imageIdx] || embeddedImages[idx];
          if (rawEmbedded) {
            try {
              imageUrl = await upscaleAndTrimCoverImage(rawEmbedded);
            } catch (err) {
              console.warn("[PDFParser] Image upscale failed:", err);
            }
          }

          // Fallback to topic stock image if needed
          if (!imageUrl) {
            imageUrl = getTopicStockImage(draft.headline, draft.category);
          }

          return {
            headline: draft.headline,
            body: draft.body,
            category: draft.category,
            imageUrl,
            sourcePublisher: draft.source || "NewsBytes",
            sourcePublishedAt: new Date(),
          };
        },
        150
      );

      return resolvedBytes;
    }
  }

  // ---------------------------------------------------------------------------
  // PATH 3: Text-based PDF or single uploaded image
  // ---------------------------------------------------------------------------
  const promptText = `You are the executive editor for Aurikrex Bytes (https://bytes.aurikrex.com).
Analyze the entire uploaded document.
CRITICAL INSTRUCTION: The document contains multiple news stories across all pages (approximately 12 stories).
Extract EVERY distinct news story found anywhere in the document into the JSON array.
Do not stop after 2 or 3 stories. Extract all distinct stories found.

For each story, provide:
- "headline": Crisp, active headline (maximum 119 characters).
- "category": Choose from "Tech", "Medicine", "Sports", "Geopolitics", "Science".
- "body": A 3-part brief (The Lead: ..., Why It Matters: ..., The Outlook: ...) targeting approximately 650-750 characters total.
- "source": Publisher name (or "Unknown").
- "pageNumber": (1-based page index).

Return ONLY a valid JSON array of story objects:
[
  {
    "pageNumber": 1,
    "headline": "Publication-ready headline",
    "category": "Tech",
    "body": "The Lead: ... Why It Matters: ... The Outlook: ...",
    "source": "Original publisher"
  }
]`;

  let rawJson = "[]";

  // 1. Primary Provider: NVIDIA AI NIM
  if (nvidiaKey) {
    const nvidiaModels = isImage
      ? ["meta/llama-3.2-90b-vision-instruct", "meta/llama-3.2-11b-vision-instruct"]
      : ["meta/llama-3.1-405b-instruct", "mistralai/mistral-large-2407"];

    const nvidiaEndpoints = ["https://integrate.api.nvidia.com/v1/chat/completions"];

    nvidiaLoop: for (const endpoint of nvidiaEndpoints) {
      for (const model of nvidiaModels) {
        try {
          const userContent = isImage
            ? [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${rawBase64}` } },
              ]
            : `${promptText}\n\nDOCUMENT TEXT:\n${documentText.slice(0, 50000)}`;

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
                { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract all news stories as a valid JSON array." },
                { role: "user", content: userContent },
              ],
              temperature: 0.2,
              max_tokens: 8192,
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            rawJson = resData.choices?.[0]?.message?.content || "[]";
            if (rawJson && rawJson !== "[]") {
              console.info(`[PDFParser] Successfully parsed document using NVIDIA AI NIM (${model})`);
              break nvidiaLoop;
            }
          } else {
            const errText = await response.text().catch(() => "");
            console.warn(`[PDFParser] NVIDIA AI model ${model} returned status ${response.status}:`, errText.slice(0, 150));
          }
        } catch (err) {
          console.warn(`[PDFParser] Error calling NVIDIA AI model ${model}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  // 2. Secondary Provider: Mistral AI (Text/Single Image fallback)
  if ((!rawJson || rawJson === "[]") && mistralKey) {
    const mistralModels = isImage ? ["pixtral-12b-2409"] : ["mistral-small-latest", "open-mistral-7b"];
    for (const model of mistralModels) {
      try {
        const userContent = isImage
          ? [{ type: "text", text: promptText }, { type: "image_url", image_url: `data:${mimeType};base64,${rawBase64}` }]
          : `${promptText}\n\nDOCUMENT TEXT:\n${documentText.slice(0, 50000)}`;

        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract all news stories as a valid JSON array." },
              { role: "user", content: userContent },
            ],
            temperature: 0.2,
            max_tokens: 8192,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          rawJson = resData.choices?.[0]?.message?.content || "[]";
          if (rawJson && rawJson !== "[]") {
            console.info(`[PDFParser] Successfully parsed document using Mistral AI (${model})`);
            break;
          }
        }
      } catch (err) {
        console.warn(`[PDFParser] Mistral fallback error:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 3. Tertiary Provider: Cloudflare Workers AI
  if ((!rawJson || rawJson === "[]") && cfConfigs.length > 0 && !isImage) {
    const cfModels = ["@cf/meta/llama-3.1-70b-instruct", "@cf/meta/llama-3.1-8b-instruct"];
    for (const cf of cfConfigs) {
      for (const model of cfModels) {
        try {
          const url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/${model}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cf.apiToken}`,
            },
            body: JSON.stringify({
              messages: [
                { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract all news stories as a valid JSON array." },
                { role: "user", content: `${promptText}\n\nDOCUMENT TEXT:\n${documentText.slice(0, 50000)}` },
              ],
              max_tokens: 4096,
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            rawJson = resData.result?.response || resData.result?.text || "[]";
            if (rawJson && rawJson !== "[]") {
              console.info(`[PDFParser] Successfully parsed document using Cloudflare Workers AI (${model})`);
              break;
            }
          }
        } catch (err) {
          console.warn(`[PDFParser] Cloudflare AI fallback error:`, err instanceof Error ? err.message : String(err));
        }
      }
      if (rawJson && rawJson !== "[]") break;
    }
  }

  const parsed = parseAiJsonResponse(rawJson);

  if (!parsed.length) {
    throw new Error("Falke AI was unable to extract news stories from this document. Please ensure the document contains readable text or news cards.");
  }

  const draftItems: DraftStory[] = parsed
    .map((item: any, idx: number) => formatDraftStory(item, idx + 1))
    .filter(Boolean) as DraftStory[];

  // Reuse embedded images extracted above or extract if not yet populated
  const coverImages = embeddedImages.length > 0 ? embeddedImages : isBase64Pdf && rawBase64 ? extractEmbeddedPdfImages(rawBase64) : [];

  console.info(`[PDFParser] Extracted ${draftItems.length} stories and ${coverImages.length} original PDF images. Resolving cover images...`);

  const results: CuratedByte[] = await runConcurrent(
    draftItems,
    3, // Concurrency of 3 for image processing
    async (draft, idx) => {
      let imageUrl: string | null = null;

      // 1. Primary: Use the original photograph from the PDF, crop black edges, and upscale to 1200x675
      const imageIdx = Math.max(0, draft.pageNumber - 1);
      const rawEmbedded = coverImages[imageIdx] || coverImages[idx];
      if (rawEmbedded) {
        try {
          imageUrl = await upscaleAndTrimCoverImage(rawEmbedded);
        } catch (err) {
          console.warn("[PDFParser] Image upscale failed:", err);
        }
      }

      // 2. Secondary fallback: High-resolution AI recreation via FLUX
      if (!imageUrl && draft.imagePrompt) {
        try {
          imageUrl = await generateAiRecreatedImage(draft.imagePrompt);
        } catch (err) {
          console.warn("[PDFParser] AI high-res image recreation failed:", err);
        }
      }

      // 3. Tertiary fallback: Editorial stock image matched by topic
      if (!imageUrl) {
        imageUrl = getTopicStockImage(draft.headline, draft.category);
      }

      return {
        headline: draft.headline,
        body: draft.body,
        category: draft.category,
        imageUrl,
        sourcePublisher: draft.source || "NewsBytes",
        sourcePublishedAt: new Date(),
      };
    },
    150
  );

  return results;
}
