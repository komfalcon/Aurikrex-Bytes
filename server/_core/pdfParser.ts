import { CuratedByte } from "./aiCurator.js";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80"
];

export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const rawString = buffer.toString("utf-8");
  const textBlocks: string[] = [];
  const textMatches = rawString.match(/\(([^)]+)\)\s*T[jJ]/g) || [];
  
  for (const match of textMatches) {
    const cleaned = match.replace(/^\(|\)\s*T[jJ]$/g, "").trim();
    if (cleaned.length > 2) {
      textBlocks.push(cleaned);
    }
  }

  if (textBlocks.length > 10) {
    return textBlocks.join(" ");
  }

  return rawString
    .replace(/[^\x20-\x7E\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 30000);
}

export async function parsePdfToBytes(pdfBase64OrText: string): Promise<CuratedByte[]> {
  let text = "";
  if (pdfBase64OrText.startsWith("data:") || pdfBase64OrText.length > 500 && !pdfBase64OrText.includes(" ")) {
    try {
      const base64Data = pdfBase64OrText.replace(/^data:application\/pdf;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      text = extractTextFromPdfBuffer(buffer);
    } catch (err) {
      console.error("[PDFParser] Failed to parse base64 buffer:", err);
      text = pdfBase64OrText;
    }
  } else {
    text = pdfBase64OrText;
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (!apiKey) {
    console.warn("[PDFParser] No GEMINI_API_KEY or GOOGLE_API_KEY found. Extracting fallback Bytes from text.");
    return fallbackExtractBytes(text);
  }

  const prompt = `You are the lead editor for Aurikrex Bytes.
I will provide you with text extracted from a PDF document containing multiple news items/articles.
Your job is to read the text and extract ALL distinct news stories (up to 25 stories).

CRITICAL LENGTH RULE:
For EACH story, the "body" text MUST be strictly between 600 and 800 characters (excluding headline).
DO NOT write short summaries under 600 characters.

Format as a clean JSON array:
[
  {
    "headline": "Crisp headline summarizing the story (under 80 chars)",
    "body": "Comprehensive news brief. MUST be strictly between 600 and 800 characters in length. High signal.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation"
  }
]

PDF CONTENT:
${text.slice(0, 25000)}

Return ONLY the raw JSON array.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!response.ok) {
      console.error("[PDFParser] Gemini API request failed:", await response.text());
      return fallbackExtractBytes(text);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed) || !parsed.length) {
      return fallbackExtractBytes(text);
    }

    return parsed.map((item: any, idx: number) => {
      let bodyText = String(item.body || "").trim();
      if (bodyText.length < 600) {
        bodyText = (bodyText + " " + bodyText).slice(0, 720);
      } else if (bodyText.length > 800) {
        bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }

      return {
        headline: String(item.headline || `Story ${idx + 1}`).slice(0, 120),
        body: bodyText,
        category: String(item.category || "Tech"),
        imageUrl: FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]
      };
    });
  } catch (err) {
    console.error("[PDFParser] Gemini extraction error:", err);
    return fallbackExtractBytes(text);
  }
}

function fallbackExtractBytes(text: string): CuratedByte[] {
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 50);

  const results: CuratedByte[] = [];
  for (let i = 0; i < Math.min(paragraphs.length, 20); i++) {
    const p = paragraphs[i];
    const words = p.split(" ");
    const headline = words.slice(0, 8).join(" ") + "...";
    let bodyText = p;
    if (bodyText.length < 600) {
      bodyText = (bodyText + " " + bodyText).slice(0, 720);
    } else if (bodyText.length > 800) {
      bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
    }

    results.push({
      headline,
      body: bodyText,
      category: "Tech",
      imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
    });
  }

  return results.length ? results : [
    {
      headline: "PDF Content Batch Extracted",
      body: (text.slice(0, 300) + " " + text.slice(0, 400)).slice(0, 650),
      category: "Tech",
      imageUrl: FALLBACK_IMAGES[0]
    }
  ];
}
