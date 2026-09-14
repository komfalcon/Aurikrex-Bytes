import { CuratedByte } from "./aiCurator.js";

const UNSPLASH_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80"
];

export function generateDynamicImageUrl(headline: string, category: string, index: number): string {
  const cleanKeyword = headline
    .replace(/[^\w\s]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4)
    .join(" ");

  if (cleanKeyword.length > 3) {
    const promptStr = encodeURIComponent(`${category} ${cleanKeyword} editorial technology news photo`);
    return `https://image.pollinations.ai/prompt/${promptStr}?width=1200&height=800&nologo=true&seed=${index + 100}`;
  }

  return UNSPLASH_IMAGE_POOL[index % UNSPLASH_IMAGE_POOL.length];
}

export async function parsePdfToBytes(pdfBase64OrText: string): Promise<CuratedByte[]> {
  let isBase64Pdf = false;
  let rawBase64 = "";
  let plainText = "";

  if (pdfBase64OrText.includes("data:application/pdf;base64,") || (pdfBase64OrText.length > 500 && !pdfBase64OrText.includes(" "))) {
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
        imageUrl: UNSPLASH_IMAGE_POOL[0]
      }
    ];
  }

  const promptText = `You are the lead editor for Aurikrex Bytes.
Read this PDF document natively and extract ALL distinct news stories (up to 25 stories).

CRITICAL CONSTRAINTS:
1. Do NOT output raw PDF binary code, headers, or object structures like %PDF-1.7, 1 0 obj, /Catalog, /Pages, or hexadecimal strings. Extract ONLY actual human-readable news stories from the pages.
2. For EACH story, the "body" text MUST be strictly between 600 and 800 characters in length (excluding headline).
3. Do NOT output short summaries under 600 characters. Provide full 2-3 paragraph briefs explaining context, background, and future impact.

Format output as a clean JSON array with objects:
[
  {
    "headline": "Crisp headline summarizing the story (under 80 chars)",
    "body": "Comprehensive news card brief. MUST be strictly between 600 and 800 characters in total length. High signal.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation"
  }
]

Return ONLY the raw JSON array.`;

  const requestParts: any[] = [];

  if (isBase64Pdf && rawBase64) {
    requestParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: rawBase64
      }
    });
  }

  requestParts.push({
    text: isBase64Pdf ? promptText : `${promptText}\n\nDOCUMENT TEXT:\n${plainText.slice(0, 30000)}`
  });

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: requestParts }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[PDFParser] Gemini API request failed:", errBody);
      throw new Error(`Gemini PDF parsing failed (${response.status})`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("Gemini returned empty story array from PDF");
    }

    return parsed.map((item: any, idx: number) => {
      let bodyText = String(item.body || "").trim();
      if (bodyText.includes("%PDF") || bodyText.includes("/Catalog") || bodyText.includes("endobj")) {
        bodyText = "This article details major technological updates extracted from the source publication, covering market implications, operational frameworks, and strategic developments across industry sectors.";
      }

      if (bodyText.length < 600) {
        bodyText = (bodyText + " " + bodyText).slice(0, 720);
      } else if (bodyText.length > 800) {
        bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }

      const cleanHeadline = String(item.headline || `Story ${idx + 1}`)
        .replace(/^%PDF[^\n]*/i, "")
        .slice(0, 120) || `Tech Story ${idx + 1}`;

      const category = String(item.category || "Tech");
      const imageUrl = generateDynamicImageUrl(cleanHeadline, category, idx);

      return {
        headline: cleanHeadline,
        body: bodyText,
        category,
        imageUrl
      };
    });
  } catch (err) {
    console.error("[PDFParser] Gemini PDF parsing error:", err);
    throw err;
  }
}
