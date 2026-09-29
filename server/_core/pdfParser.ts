import { CuratedByte, cleanHeadline, clampEditorialBrief, parseAiJsonResponse, extractAiBody } from "./aiCurator.js";
import { cloudinaryConfigured } from "../services.js";
import { getMistralApiKey, getNvidiaApiKey } from "./aiKeys.js";
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
 * Attempts to upload a base64 image data URI to Cloudinary if credentials are configured.
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
    });
    return result.secure_url || result.url || null;
  } catch (err) {
    console.warn("[PDFParser] Cloudinary upload skipped, using data URI fallback:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Attempts to recreate cover imagery using NVIDIA FLUX.
 */
async function generateAiRecreatedImage(prompt: string): Promise<string | null> {
  if (!prompt) return null;

  if (getNvidiaApiKey()) {
    try {
      const fluxUrl = await generateNvidiaFluxImage(prompt);
      if (fluxUrl) {
        return fluxUrl;
      }
    } catch (err) {
      console.warn("[PDFParser] NVIDIA FLUX image generation failed:", err instanceof Error ? err.message : String(err));
    }
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
    const match = pdfBase64OrText.match(/^data:([^;]+);base64,(.*)$/s);
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

  if (!mistralKey && !nvidiaKey) {
    console.warn("[PDFParser] Neither MISTRAL_API_KEY nor NVIDIA_API_KEY is configured.");
    return [
      {
        headline: "Falke AI Key Required for Document Ingestion",
        body: "Please ensure MISTRAL_API_KEY or NVIDIA_API_KEY is configured in your environment variables on Vercel to enable native document parsing.",
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


  const promptText = `You are the executive technology editor for Aurikrex Bytes (www.bytes.aurikrex.tech).
You are analyzing an uploaded multi-story document / PDF (each page contains a distinct mobile news card with an image at the top, a headline, a summary, and a publisher source at the bottom).

YOUR TASK:
Scan the entire document and extract EVERY single distinct news story found across the pages (up to 30 stories).

CRITICAL CONSTRAINTS & REQUIREMENTS:
1. Do NOT output raw PDF binary code, headers, or object tokens (%PDF, obj, endobj, stream, /Catalog, /Pages, xref). Extract ONLY actual human-readable news stories.
2. For EACH story, write a comprehensive 3-part editorial brief:
   - Part 1: The Lead — What happened, who announced it, and the core factual developments.
   - Part 2: Why It Matters — The commercial, architectural, or industry-wide impact.
   - Part 3: The Outlook — Key engineering milestones, product rollouts, or regulatory challenges to watch next.
3. Every single "body" MUST be comprehensive and substantive, strictly targeting 650-750 characters. No repetitive text or placeholder sentences.
4. "headline": Crisp, active headline summarizing the story (under 80 characters). Strip any mobile app UI tags or brackets.
5. "category": Select the most accurate from: "Tech", "AI", "Science", "Innovation", "Crypto".
6. "imagePrompt": Look carefully at the image or graphic at the top of the news card on that page. Describe that exact visual scene in a detailed, photorealistic prompt suitable for image generation (e.g., "A studio photograph of...", "Close-up of..."). Focus on high-end tech photography realism.
7. "source": Extract the publisher / source name indicated at the bottom of the card (e.g., "Electrek", "The New York Times", "Nikkei Asia", "GitHub", "NewsBytes").`;

  let rawJson = "[]";

  // 1. Primary Provider: NVIDIA AI NIM (Developer Credits Supported - Fast & High Throughput)
  if (nvidiaKey) {
    const nvidiaModels = (isImage || isImageBasedPdf)
      ? ["meta/llama-3.2-90b-vision-instruct", "nvidia/neva-22b"]
      : ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "mistralai/mistral-7b-instruct-v0.3"];

    const nvidiaEndpoints = [
      "https://integrate.api.nvidia.com/v1/chat/completions",
      "https://ai.api.nvidia.com/v1/chat/completions",
    ];

    nvidiaLoop: for (const endpoint of nvidiaEndpoints) {
      for (const model of nvidiaModels) {
        try {
          // For images and image-based PDFs: send first page as image_url to vision model
          // For text PDFs: send extracted text as plain string
          const userContent = (isImage || isImageBasedPdf)
            ? [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: isImage ? `data:${mimeType};base64,${rawBase64}` : `data:application/pdf;base64,${rawBase64}` } },
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

  // 2. Secondary Provider: Mistral AI (Free Tier Compatible)
  if ((!rawJson || rawJson === "[]") && mistralKey) {
    const mistralModels = (isImage || isImageBasedPdf)
      ? ["pixtral-12b-2409", "pixtral-large-latest"]  // Vision models support images + PDF OCR
      : ["open-mistral-7b", "mistral-small-latest", "open-mixtral-8x7b"];

    for (const model of mistralModels) {
      try {
        let userContent: string | object[];
        if (isImage) {
          // Regular image: use image_url
          userContent = [
            { type: "text", text: promptText },
            { type: "image_url", image_url: `data:${mimeType};base64,${rawBase64}` },
          ];
        } else if (isImageBasedPdf) {
          // Image-based PDF: use document_url (Mistral Pixtral OCR)
          userContent = [
            { type: "text", text: promptText },
            { type: "document_url", document_url: `data:application/pdf;base64,${rawBase64}` },
          ];
        } else {
          // Text PDF: plain text extraction
          userContent = `${promptText}\n\nDOCUMENT TEXT:\n${documentText.slice(0, 50000)}`;
        }

        // Vision/document models don't support json_object response_format
        const responseFormat = (isImage || isImageBasedPdf) ? undefined : { type: "json_object" };

        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model,
            ...(responseFormat ? { response_format: responseFormat } : {}),
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
        } else {
          const errText = await response.text().catch(() => "");
          console.warn(`[PDFParser] Mistral AI model ${model} returned status ${response.status}:`, errText.slice(0, 150));
          if (response.status === 429) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      } catch (err) {
        console.warn(`[PDFParser] Error calling Mistral AI model ${model}:`, err instanceof Error ? err.message : String(err));
      }
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

    const cleanTitle = cleanHeadline(String(item.headline || `Tech Story ${idx + 1}`)).slice(0, 120);
    const category = String(item.category || "Tech");

    const finalBody = clampEditorialBrief(bodyText || cleanTitle, {
      publisher: item.source || "Tech Wire",
      publishedAt: new Date(),
    });

    return {
      cleanTitle,
      finalBody,
      category,
      source: item.source,
      imagePrompt: item.imagePrompt,
    };
  });

  console.info(`[PDFParser] Extracted ${draftItems.length} stories. Resolving cover images via NVIDIA FLUX...`);

  const results: CuratedByte[] = await Promise.all(
    draftItems.map(async (draft) => {
      let imageUrl: string | null = null;
      if (draft.imagePrompt) {
        imageUrl = await generateAiRecreatedImage(draft.imagePrompt);
      }
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
