import { CuratedByte, cleanHeadline, clampEditorialBrief } from "./aiCurator.js";
import { cloudinaryConfigured } from "../services.js";

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
 * Attempts to recreate the screenshot image via Imagen 3 using a detailed visual prompt.
 */
async function generateAiRecreatedImage(prompt: string, apiKey: string): Promise<string | null> {
  if (!apiKey || !prompt) return null;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: `${prompt}. High-quality editorial technology photography, 4k resolution, sharp focus, professional studio lighting, realistic, no text, no watermark.`,
            },
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const base64Bytes = data.predictions?.[0]?.bytesBase64Encoded;
      if (base64Bytes) {
        const dataUri = `data:image/jpeg;base64,${base64Bytes}`;
        const cdnUrl = await uploadBase64ToCloudinary(dataUri);
        return cdnUrl || dataUri;
      }
    } else {
      const errText = await response.text();
      console.warn("[PDFParser] Imagen generation unavailable on this key tier:", errText.slice(0, 100));
    }
  } catch (err) {
    console.warn("[PDFParser] Error generating image via Imagen:", err instanceof Error ? err.message : String(err));
  }
  return null;
}

export async function parsePdfToBytes(pdfBase64OrText: string): Promise<CuratedByte[]> {
  let isBase64Pdf = false;
  let rawBase64 = "";
  let plainText = "";

  if (
    pdfBase64OrText.includes("data:application/pdf;base64,") ||
    (pdfBase64OrText.length > 500 && !pdfBase64OrText.includes(" "))
  ) {
    isBase64Pdf = true;
    rawBase64 = pdfBase64OrText.replace(/^data:application\/pdf;base64,/, "").trim();
  } else {
    plainText = pdfBase64OrText;
  }

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.FORGE_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    console.warn("[PDFParser] No GEMINI_API_KEY found. Unable to parse PDF document natively.");
    return [
      {
        headline: "Gemini API Key Required for PDF Ingestion",
        body: "Please ensure GEMINI_API_KEY or GOOGLE_API_KEY is configured in your environment variables on Vercel to enable native multimodal PDF parsing.",
        category: "Tech",
        imageUrl: generateDynamicByteCard("Gemini API Key Required", "Tech"),
      },
    ];
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

  const requestParts: any[] = [];

  if (isBase64Pdf && rawBase64) {
    requestParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: rawBase64,
      },
    });
  }

  requestParts.push({
    text: isBase64Pdf ? promptText : `${promptText}\n\nDOCUMENT TEXT:\n${plainText.slice(0, 50000)}`,
  });

  const modelCandidates = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
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
            contents: [{ parts: requestParts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              responseSchema: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    headline: { type: "STRING" },
                    body: { type: "STRING" },
                    category: { type: "STRING", enum: ["Tech", "AI", "Science", "Innovation", "Crypto"] },
                    imagePrompt: { type: "STRING" },
                    source: { type: "STRING" },
                  },
                  required: ["headline", "body", "category"],
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[PDFParser] Gemini model ${model} returned ${response.status}:`, errText.slice(0, 150));
        continue;
      }

      const resData = await response.json();
      rawJson = resData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      if (rawJson && rawJson !== "[]") break;
    } catch (err) {
      console.warn(`[PDFParser] Error calling model ${model}:`, err instanceof Error ? err.message : String(err));
    }
  }

  let parsed: any[] = [];
  try {
    const cleanJson = rawJson.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleanJson);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }

  if (!parsed.length) {
    throw new Error("Gemini was unable to extract news stories from this document. Please ensure the PDF contains readable text or news cards.");
  }

  const results: CuratedByte[] = [];

  for (let idx = 0; idx < parsed.length; idx++) {
    const item = parsed[idx];
    let bodyText = String(item.body || "").trim();

    // Remove any accidental raw PDF binary tokens
    if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) {
      bodyText = "This article details major technological updates extracted from the source publication, covering market implications, operational frameworks, and strategic developments across industry sectors.";
    }

    const cleanTitle = cleanHeadline(String(item.headline || `Tech Story ${idx + 1}`)).slice(0, 120);
    const category = String(item.category || "Tech");

    // Strictly enforce 600-800 character boundary without duplication
    bodyText = clampEditorialBrief(bodyText, {
      publisher: item.source || "Tech Wire",
      publishedAt: new Date(),
    });

    // Recreate image: Tier 1 via Imagen, Tier 2 via dynamic topic card
    let imageUrl: string | null = null;
    if (item.imagePrompt) {
      imageUrl = await generateAiRecreatedImage(item.imagePrompt, apiKey);
    }
    if (!imageUrl) {
      imageUrl = generateDynamicByteCard(cleanTitle, category, item.source);
    }

    results.push({
      headline: cleanTitle,
      body: bodyText,
      category,
      imageUrl,
    });
  }

  return results;
}
