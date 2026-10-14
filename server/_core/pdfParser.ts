import { CuratedByte, cleanHeadline, clampEditorialBrief, parseAiJsonResponse, extractAiBody } from "./aiCurator.js";
import { cloudinaryConfigured } from "../services.js";
import { getMistralApiKey, getNvidiaApiKey, getCloudflareAiConfig, getCloudflareAiConfigs } from "./aiKeys.js";
import { generateNvidiaFluxImage, getTopicStockImage } from "./imageGeneration.js";
import zlib from "zlib";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);


/**
 * Extracts domain-specific theme and branding parameters for bespoke card generation.
 * Guarantees every single news item gets a tailored, beautiful card rather than a generic template.
 */
function extractEntityKicker(headline: string, category: string, source?: string): {
  kicker: string;
  palette: { bg1: string; bg2: string; accent1: string; accent2: string; glow: string };
} {
  const h = headline.toLowerCase();

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
  if (/satellite|orbit|moon|earth|space|cubesat|gaganyaan|astronaut|india|drug|aging|biological|cell|dna|physics/.test(h)) {
    let entity = "FRONTIER SCIENCE";
    if (h.includes("satellite") || h.includes("moon") || h.includes("orbit")) entity = "AEROSPACE • DEEP SPACE";
    else if (h.includes("drug") || h.includes("aging") || h.includes("disease")) entity = "BIOTECH • LONGEVITY";
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

  // Crypto & Decentralized Networks
  if (/blockchain|crypto|token|harmony|ethereum|multisig|wallet|bitcoin/.test(h)) {
    return {
      kicker: "CRYPTO • INFRASTRUCTURE",
      palette: {
        bg1: "#0d131f",
        bg2: "#192841",
        accent1: "#6366f1",
        accent2: "#a855f7",
        glow: "rgba(99, 102, 241, 0.22)",
      },
    };
  }

  // Default Editorial
  return {
    kicker: `${(category || "TECH").toUpperCase()} • VERIFIED REPORT`,
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
 * Automatically trims dark/black borders and letterboxing from image buffers,
 * and upscales/resizes to crisp 16:9 editorial dimensions (1200x675).
 */
async function cleanAndTrimImage(base64DataUri: string): Promise<string> {
  if (!base64DataUri || !base64DataUri.startsWith("data:image/")) return base64DataUri;
  try {
    const sharp = _require("sharp");
    const raw = base64DataUri.replace(/^data:image\/[a-z]+;base64,/, "");
    const buf = Buffer.from(raw, "base64");

    // Automatically trim borders with dark/black threshold (pixel brightness <= 40)
    const trimmedBuf = await sharp(buf)
      .trim({ background: { r: 0, g: 0, b: 0 }, threshold: 40 })
      .resize({ width: 1200, height: 675, fit: "cover", position: "entropy" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${trimmedBuf.toString("base64")}`;
  } catch (err) {
    console.warn("[PDFParser] cleanAndTrimImage warning:", err instanceof Error ? err.message : String(err));
    return base64DataUri;
  }
}

/**
 * Attempts to upload a base64 image data URI to Cloudinary if credentials are configured.
 * Enforces automatic 16:9 aspect ratio and content-aware auto-crop to remove black borders.
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
        { aspect_ratio: "16:9", crop: "fill", gravity: "auto" },
      ],
    });
    return result.secure_url || result.url || null;
  } catch (err) {
    console.warn("[PDFParser] Cloudinary upload skipped, using data URI fallback:", err instanceof Error ? err.message : String(err));
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
 * Attempts to recreate cover imagery in high-resolution using FLUX (NVIDIA NIM or Cloudflare Workers AI).
 */
async function generateAiRecreatedImage(prompt: string): Promise<string | null> {
  if (!prompt) return null;
  try {
    const fluxUrl = await generateNvidiaFluxImage(prompt);
    if (fluxUrl) {
      console.info("[PDFParser] Successfully generated high-resolution AI cover image via FLUX.");
      return fluxUrl;
    }
  } catch (err) {
    console.warn("[PDFParser] FLUX image generation failed:", err instanceof Error ? err.message : String(err));
  }
  return null;
}

async function extractPdfText(rawBase64: string): Promise<string> {
  try {
    const buf = Buffer.from(rawBase64, "base64");

    // 1. Primary: Use pdf-parse (handles CIDFont, embedded, TrueType encoding)
    try {
      const pdfParse = _require("pdf-parse");
      const data = await pdfParse(buf, { max: 0 });
      const text = (data.text || "").trim();
      if (text.length > 50) {
        console.info(`[PDFParser] pdf-parse extracted ${text.length} chars, ${data.numpages} pages`);
        return text;
      }
    } catch (err) {
      console.warn("[PDFParser] pdf-parse failed, falling back to manual extraction:", err instanceof Error ? err.message : String(err));
    }

    // 2. Fallback: Try decompressing zlib FlateDecode streams
    const str = buf.toString("latin1");
    const extractedParts: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(str)) !== null) {
      const streamContent = streamMatch[1];
      try {
        const streamBuf = Buffer.from(streamContent, "latin1");
        const decompressed = zlib.inflateSync(streamBuf).toString("utf-8");
        const words = decompressed.split(/\s+/).filter((w) => w.length > 2 && /[a-zA-Z]/.test(w));
        if (words.length > 5) extractedParts.push(words.join(" "));
      } catch {
        // Stream wasn't zlib
      }
    }

    const resultText = extractedParts.join(" ").replace(/\s+/g, " ").trim();
    if (resultText.length > 50) return resultText;
  } catch {
    // ignore
  }
  return "";
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
    console.info("[PDFParser] PDF appears to be image-based (no extractable text). Routing to vision AI via document_url.");
  } else if (!isImage && !documentText) {
    documentText = "A multi-story news PDF document uploaded by Aurikrex Bytes editor containing recent technology developments.";
  }


  const promptText = `ROLE

You are the Executive Technology Editor for Aurikrex Bytes (https://bytes.aurikrex.com).

Analyze the entire uploaded multi-page PDF, extract genuine technology and science news stories, create concise editorial briefs, and recreate each story's exact original image at higher resolution, cropping out unwanted black spaces along the edges.


1. NEWS EXTRACTION & FILTERING

Review every page in the PDF.

INCLUDE:
- Technology, AI, science, and engineering breakthroughs.
- Product launches and company announcements.
- Semiconductors, software, cybersecurity, robotics, and space.
- Electric vehicles, cryptocurrency, and emerging innovations.
- Technology business deals, investments, and industry developments.

EXCLUDE:
- Event flyers, posters, schedules, and promotional banners.
- Advertisements, cover pages, and unrelated content.
- Duplicate stories unless a later appearance contains significant new information.

Extract every distinct, legitimate news story. Do not invent facts or treat promotional material as news.


2. PAGE NUMBER

For every story, provide "pageNumber" using the actual 1-based PDF page index.

Verify the page containing the story and its associated original image. Never guess page numbers.


3. HEADLINE

Write a crisp, active, publication-ready headline.

- Maximum 119 characters.
- Remove app tags, interface text, and irrelevant metadata.
- Preserve factual accuracy.
- Avoid clickbait and unsupported claims.


4. EDITORIAL BODY

Write a three-part editorial brief:

The Lead: What happened, who announced it, and the key facts.

Why It Matters: The commercial, engineering, or industry-wide implications.

The Outlook: Upcoming milestones, product rollouts, technical challenges, or unresolved questions worth watching.

STRICT CHARACTER LIMIT:
The complete body must contain 650–750 characters, inclusive, including all three labels, spaces, and punctuation.

Target approximately 700 characters. Verify the character count before returning each story.

Keep the writing informative, concise, and non-repetitive. Distinguish verified facts from analysis and projections. Never invent future milestones.


5. CATEGORY

Assign exactly one category from this list:

- "Tech"
- "AI"
- "Science"
- "Innovation"
- "Crypto"

Choose the category that best represents each story's primary subject.


6. EXACT IMAGE RECREATION — CRITICAL

For every valid story, locate the exact original photograph or cover image associated with it on the corresponding PDF page.

Recreate that SAME image at higher resolution and crop out unwanted black spaces along its edges.

This is an image-reproduction task, NOT an instruction to generate a similar image.

PRESERVE:
- The original subject, people, objects, and surroundings.
- Composition, camera angle, perspective, and aspect ratio.
- Colors, lighting, shadows, and photographic style.
- Faces, logos, symbols, and meaningful visual details.
- All recognizable elements of the original photograph.

DO NOT:
- Substitute another photograph or create an alternative scene.
- Redesign, stylize, or reinterpret the image.
- Add or remove meaningful objects, people, or logos.
- Introduce artificial details or change the image's meaning.
- Stretch the image or crop out important content.

BLACK-EDGE CROPPING:
Remove only unwanted black borders or padding. Preserve intentional dark areas that belong to the photograph and retain all meaningful content.

RESOLUTION:
Enhance sharpness and detail while maintaining natural photographic realism. Avoid artificial textures and fabricated details.

WORKFLOW:
1. Identify the correct PDF page and original image.
2. Extract or isolate the image.
3. Crop unwanted black margins.
4. Enhance or recreate it at higher resolution while preserving visual fidelity.
5. Compare the result with the original.
6. Save and deliver the actual image file for that story.

If exact reconstruction is technically impossible, preserve as much original information as possible. Never claim an image was recreated unless the file was actually produced.

The "imagePrompt" field below is descriptive metadata only. It does not replace the requirement to deliver the recreated image.

Use descriptive filenames and PNG or high-quality JPEG output.


7. IMAGE DESCRIPTION

Write "imagePrompt" based on direct visual inspection of the original image.

Describe the subject, environment, composition, lighting, dominant colors, and distinctive visible details.

Do not invent details or describe an imagined replacement image.


8. SOURCE ATTRIBUTION

The "source" field must identify the original publisher, such as Reuters, TechCrunch, Electrek, or The Information.

Use the publisher identified in the document whenever possible. Do not confuse the publisher with the company being reported on.

If the source cannot be verified, use "Unknown".

Never fabricate facts, source names, quotations, or citations.


9. REQUIRED JSON OUTPUT

Return only a valid JSON object in the following structure:

{
  "publication": "Aurikrex Bytes",
  "documentAnalysis": {
    "totalPagesReviewed": 0,
    "validStoriesExtracted": 0,
    "nonNewsPagesExcluded": 0
  },
  "stories": [
    {
      "pageNumber": 1,
      "headline": "Publication-ready headline",
      "category": "Tech",
      "body": "The Lead: ... Why It Matters: ... The Outlook: ...",
      "source": "Original publisher",
      "imagePrompt": "Detailed description of the original image.",
      "imageOutputFilename": "story-image.png",
      "imageStatus": "recreated"
    }
  ]
}

OUTPUT RULES:
- Return every distinct, valid news story in order of first appearance.
- Include all required fields.
- Use actual PDF page numbers.
- Ensure every body contains 650–750 characters.
- Set "imageStatus" to "recreated" only when the image file has actually been produced and saved or attached. Otherwise, use "failed".
- Count all reviewed pages and excluded non-news pages accurately.
- Do not include excluded material in the stories array.
- Ensure the JSON parses correctly, with no comments, trailing commas, or Markdown fences.
- Deliver the recreated image files alongside the JSON output.


10. FINAL QUALITY CHECK

Before responding, verify:
- The entire PDF has been reviewed.
- All genuine news stories have been extracted.
- Flyers, advertisements, and duplicate stories have been filtered appropriately.
- Headlines, categories, sources, and page numbers are correct.
- Every body meets the strict character limit.
- Each recreated image matches its original, has unwanted black borders removed, and preserves meaningful content.
- Every image marked "recreated" actually exists.
- The JSON is valid and all document counts are accurate.

FINAL INSTRUCTION:
Prioritize factual accuracy, editorial quality, and exact image preservation. Never fabricate information or pretend an image has been produced when it has not. Return only the final JSON object and deliver the corresponding image files.`;

  let rawJson = "[]";

  // 1. Primary Provider: NVIDIA AI NIM (For single images or text PDFs)
  if (nvidiaKey && (isImage || !isImageBasedPdf)) {
    const nvidiaModels = isImage
      ? ["meta/llama-3.2-90b-vision-instruct", "meta/llama-3.2-11b-vision-instruct"]
      : ["meta/llama-3.1-405b-instruct", "mistralai/mistral-large-2407"];

    const nvidiaEndpoints = [
      "https://integrate.api.nvidia.com/v1/chat/completions",
    ];

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
                { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract news stories as a valid JSON array." },
                { role: "user", content: userContent },
              ],
              temperature: 0.3,
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
            console.warn(`[PDFParser] NVIDIA AI model ${model} at ${endpoint} returned status ${response.status}:`, errText.slice(0, 150));
          }
        } catch (err) {
          console.warn(`[PDFParser] Error calling NVIDIA AI model ${model}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  // Extract all embedded JPEG images from PDF byte buffer
  const embeddedImages = isBase64Pdf && rawBase64 ? extractEmbeddedPdfImages(rawBase64) : [];

  // If image-based PDF and we extracted embedded JPEGs: process text pages concurrently via Mistral Pixtral / NVIDIA vision
  if (isImageBasedPdf && embeddedImages.length > 0 && (mistralKey || nvidiaKey)) {
    console.info(`[PDFParser] Processing ${embeddedImages.length} images concurrently via Mistral Pixtral vision...`);

    const hasTextScreenshots = embeddedImages.some(img => {
      const d = getJpegDimensions(img);
      return d && d.aspectRatio < 0.60;
    });

    const pageTasks = embeddedImages.map(async (pageImg, pageIdx) => {
      const pageNum = pageIdx + 1;
      const dims = getJpegDimensions(pageImg);

      // Skip standalone cover photos (aspect ratio >= 0.60) from being sent to text OCR if we have text screenshots
      if (dims && dims.aspectRatio >= 0.60 && hasTextScreenshots && embeddedImages.length > 1) {
        return [];
      }

      const pagePrompt = `${promptText}\n\nNOTE: You are analyzing PAGE ${pageNum} of ${embeddedImages.length}.`;

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
                { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract news stories as a valid JSON array." },
                { role: "user", content: [
                    { type: "text", text: pagePrompt },
                    { type: "image_url", image_url: pageImg },
                  ]
                },
              ],
              temperature: 0.3,
              max_tokens: 4096,
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            const pageJson = resData.choices?.[0]?.message?.content || "[]";
            const parsedPage = parseAiJsonResponse(pageJson);
            if (parsedPage.length > 0) {
              const pageStories: CuratedByte[] = [];
              for (const item of parsedPage) {
                let bodyText = extractAiBody(item);
                if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) bodyText = "";
                const cleanTitle = cleanHeadline(String(item.headline || `Tech Story ${pageNum}`)).slice(0, 119);
                const validCategories = ["Tech", "AI", "Science", "Innovation", "Crypto"];
                const category = validCategories.includes(String(item.category)) ? String(item.category) : "Tech";
                const source = item.source && String(item.source).trim() ? String(item.source).trim() : "Unknown";
                const finalBody = clampEditorialBrief(bodyText || cleanTitle, { publisher: source, publishedAt: new Date() });

                // 1. Primary: Recreate high-resolution cover photo using AI FLUX
                const promptToUse = item.imagePrompt || `${cleanTitle}. High-tech editorial journalism photography, 16:9 aspect ratio, 4k resolution, sharp focus, professional lighting, photorealistic, no borders, no text`;
                let imageUrl: string | null = null;
                try {
                  imageUrl = await generateAiRecreatedImage(promptToUse);
                } catch {
                  // Fall back to clean embedded image
                }

                // 2. Secondary fallback: Clean & trim embedded PDF image of black edges, then upload to Cloudinary
                if (!imageUrl) {
                  let chosenCoverImg = pageImg;
                  if (dims && dims.aspectRatio < 0.60 && pageIdx + 1 < embeddedImages.length) {
                    const nextImg = embeddedImages[pageIdx + 1];
                    const nextDims = getJpegDimensions(nextImg);
                    if (nextDims && nextDims.aspectRatio >= 0.60) {
                      chosenCoverImg = nextImg;
                    }
                  }
                  const trimmedImg = await cleanAndTrimImage(chosenCoverImg);
                  const cdnUrl = await uploadBase64ToCloudinary(trimmedImg || chosenCoverImg);
                  imageUrl = cdnUrl || trimmedImg || chosenCoverImg;
                }

                pageStories.push({
                  headline: cleanTitle,
                  body: finalBody,
                  category,
                  imageUrl,
                  sourcePublisher: item.source || "NewsBytes",
                  sourcePublishedAt: new Date(),
                });
              }
              console.info(`[PDFParser] Page ${pageNum}: Extracted ${pageStories.length} story/stories.`);
              return pageStories;
            }
          }
        } catch (err) {
          console.warn(`[PDFParser] Page ${pageNum} extraction error:`, err instanceof Error ? err.message : String(err));
        }
      }
      return [];
    });

    const pageResults = await Promise.all(pageTasks);
    const allExtractedStories = pageResults.flat();

    if (allExtractedStories.length > 0) {
      console.info(`[PDFParser] Successfully extracted ${allExtractedStories.length} total stories across ${embeddedImages.length} images concurrently.`);
      return allExtractedStories;
    }
  }

  // 2. Secondary Provider: Standard Mistral AI (Text/Single Prompt fallback)
  if ((!rawJson || rawJson === "[]") && mistralKey) {
    const mistralModels = isImage ? ["pixtral-12b-2409"] : ["open-mistral-7b", "mistral-small-latest"];
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
              { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract news stories as a valid JSON array." },
              { role: "user", content: userContent },
            ],
            temperature: 0.3,
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

  // 3. Tertiary Provider: Cloudflare Workers AI (Text/Single Prompt fallback with multi-account cascade)
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
                { role: "system", content: "You are the executive technology editor for Aurikrex Bytes. Extract news stories as a valid JSON array." },
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

  const draftItems = parsed.map((item: any, idx: number) => {
    let bodyText = extractAiBody(item);

    // Remove any accidental raw PDF binary tokens
    if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) {
      bodyText = "";
    }

    const cleanTitle = cleanHeadline(String(item.headline || `Tech Story ${idx + 1}`)).slice(0, 119);
    const validCategories = ["Tech", "AI", "Science", "Innovation", "Crypto"];
    const category = validCategories.includes(String(item.category)) ? String(item.category) : "Tech";
    const source = item.source && String(item.source).trim() ? String(item.source).trim() : "Unknown";

    const finalBody = clampEditorialBrief(bodyText || cleanTitle, {
      publisher: source,
      publishedAt: new Date(),
    });

    const pageNum = Number(item.pageNumber || idx + 1);

    return {
      cleanTitle,
      finalBody,
      category,
      source,
      imagePrompt: item.imagePrompt,
      pageNumber: pageNum,
    };
  });

  // Reuse embedded images extracted above or extract if not yet populated
  const coverImages = embeddedImages.length > 0 ? embeddedImages : (isBase64Pdf && rawBase64 ? extractEmbeddedPdfImages(rawBase64) : []);

  console.info(`[PDFParser] Extracted ${draftItems.length} stories and ${coverImages.length} original PDF images. Resolving cover images...`);

  const results: CuratedByte[] = await Promise.all(
    draftItems.map(async (draft, idx) => {
      let imageUrl: string | null = null;

      // 1. Primary: Recreate high-resolution cover photo using AI FLUX
      const promptToUse = draft.imagePrompt || `${draft.cleanTitle}. High-tech editorial journalism photography, 16:9 aspect ratio, 4k resolution, sharp focus, professional lighting, photorealistic, no borders, no text`;
      try {
        imageUrl = await generateAiRecreatedImage(promptToUse);
      } catch (err) {
        console.warn("[PDFParser] AI high-res image recreation failed:", err);
      }

      // 2. Secondary fallback: Use embedded PDF image, BUT clean & trim black edges first!
      if (!imageUrl) {
        const imageIdx = Math.max(0, draft.pageNumber - 1);
        const rawEmbedded = coverImages[imageIdx] || coverImages[idx];
        if (rawEmbedded) {
          const trimmedImg = await cleanAndTrimImage(rawEmbedded);
          const cdnUrl = await uploadBase64ToCloudinary(trimmedImg || rawEmbedded);
          imageUrl = cdnUrl || trimmedImg || rawEmbedded;
        }
      }

      // 3. Tertiary fallback: Editorial stock image matched by topic
      if (!imageUrl) {
        imageUrl = getTopicStockImage(draft.cleanTitle, draft.category);
      }

      return {
        headline: draft.cleanTitle,
        body: draft.finalBody,
        category: draft.category,
        imageUrl,
        sourcePublisher: draft.source || "NewsBytes",
        sourcePublishedAt: new Date(),
      };
    })
  );

  return results;
}
