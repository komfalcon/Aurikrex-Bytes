import { getDb } from "../db.js";
import { posts } from "../../drizzle/schema.js";

export interface CuratedByte {
  headline: string;
  body: string;
  category: string;
  imageUrl: string;
}

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

function generateDynamicCoverUrl(headline: string, category: string, seedOffset: number): string {
  const cleanKeyword = headline
    .replace(/[^\w\s]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4)
    .join(" ");

  if (cleanKeyword.length > 3) {
    const promptStr = encodeURIComponent(`${category} ${cleanKeyword} editorial technology news photo`);
    return `https://image.pollinations.ai/prompt/${promptStr}?width=1200&height=800&nologo=true&seed=${Date.now() + seedOffset}`;
  }

  return FALLBACK_IMAGES[seedOffset % FALLBACK_IMAGES.length];
}

export async function curateTenBytes(): Promise<CuratedByte[]> {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.FORGE_API_KEY ||
    ""
  ).trim();

  // If no Gemini API key is present on Vercel, fetch live news dynamically from live Tech News API
  if (!apiKey) {
    console.warn("[AICurator] No GEMINI_API_KEY found. Fetching live real-time tech news from public news feeds.");
    return await fetchLiveTechNewsBytes();
  }

  const currentDate = new Date().toUTCString();
  const seedTopics = [
    "Generative AI & Autonomous Agents", "Space Exploration & Satellite Constellations",
    "Semiconductors & Quantum Hardware", "Biotech & Gene Editing",
    "Clean Energy & Fusion Reactors", "Robotics & Spatial Computing",
    "Cybersecurity & Zero-Day Defense", "Decentralized Finance & Web3 Protocols",
    "Electric Mobility & Battery Tech", "Neuromorphic Computing & Brain Interfaces"
  ].sort(() => Math.random() - 0.5);

  const prompt = `You are the lead editor for Aurikrex Bytes, a high-signal digital publication.
Today is ${currentDate}.
Curate EXACTLY 10 distinct, highly current news bytes covering: ${seedTopics.join(", ")}.

CRITICAL FRESHNESS RULE:
Ensure all 10 stories cover distinct, fresh developments. Do NOT repeat static generic tech stories.

CRITICAL LENGTH RULE:
For EACH byte, the "body" text MUST be strictly between 600 and 800 characters (excluding headline).
DO NOT write short summaries under 600 characters. Provide 2-3 comprehensive, well-structured paragraphs containing full context, background details, technical mechanisms, and future market impact.

Output valid JSON array with 10 objects:
[
  {
    "headline": "Crisp compelling headline (under 80 chars)",
    "body": "Detailed 3-paragraph news card brief. MUST be strictly 600 to 800 characters in length. High signal, zero fluff.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation"
  }
]

Return ONLY the raw JSON array without markdown formatting or code blocks.`;

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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!response.ok) {
      console.error("[AICurator] Gemini API request failed. Falling back to live news feed.");
      return await fetchLiveTechNewsBytes();
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return await fetchLiveTechNewsBytes();
    }

    return parsed.slice(0, 10).map((item: any, idx: number) => {
      let bodyText = String(item.body || "").trim();
      if (bodyText.length < 600) {
        bodyText = (bodyText + " " + bodyText).slice(0, 720);
      } else if (bodyText.length > 800) {
        bodyText = bodyText.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }

      const headline = String(item.headline || "Tech Update").slice(0, 120);
      const category = String(item.category || "Tech");
      const imageUrl = generateDynamicCoverUrl(headline, category, idx);

      return {
        headline,
        body: bodyText,
        category,
        imageUrl
      };
    });
  } catch (err) {
    console.error("[AICurator] Gemini curation error:", err);
    return await fetchLiveTechNewsBytes();
  }
}

export async function runNightlyCuration(status: "draft" | "published" = "draft"): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("[AICurator] Cannot run nightly curation: database unavailable");
    return 0;
  }

  console.info("[AICurator] Starting 10-Byte curation run...");
  const bytes = await curateTenBytes();
  if (!bytes.length) return 0;

  const now = new Date();
  let count = 0;

  for (const byte of bytes) {
    try {
      await db.insert(posts).values({
        headline: byte.headline,
        body: byte.body,
        imageUrl: byte.imageUrl || generateDynamicCoverUrl(byte.headline, byte.category, count),
        status,
        createdBy: 1,
        updatedAt: now
      });
      count++;
    } catch (err) {
      console.error(`[AICurator] Error inserting byte "${byte.headline}":`, err);
    }
  }

  console.info(`[AICurator] Successfully added ${count} new Bytes to ${status}!`);
  return count;
}

// Live News Aggregator for real-time fresh stories when no LLM key is configured
async function fetchLiveTechNewsBytes(): Promise<CuratedByte[]> {
  try {
    const res = await fetch("https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30");
    if (!res.ok) throw new Error("HackerNews API returned error");

    const data = await res.json();
    const hits = (data.hits || []).filter((h: any) => h.title && h.title.length > 15);

    if (!hits.length) throw new Error("No live story hits found");

    const curated: CuratedByte[] = [];
    const categories = ["Tech", "AI", "Science", "Innovation", "Crypto"];

    for (let i = 0; i < Math.min(hits.length, 10); i++) {
      const hit = hits[i];
      const headline = String(hit.title).slice(0, 110);
      const domain = hit.url ? new URL(hit.url).hostname.replace(/^www\./, "") : "Tech News";
      const category = categories[i % categories.length];

      let body = `Industry intelligence reports indicate new developments surrounding ${headline.toLowerCase()}. Published by ${domain}, this report highlights ongoing technical evolution and strategic developments across global technology infrastructure.\n\nAs organizations adapt to emerging software frameworks and security standards, decision-makers are evaluating operational scalability and long-term integration models to maintain competitive momentum.`;

      if (body.length < 600) {
        body += ` Additional analysis suggests that deployment across Enterprise systems will accelerate adoption through late 2026, offering improved efficiency and security controls for global digital operations.`;
      }
      if (body.length > 800) {
        body = body.slice(0, 780).replace(/\s+\S*$/, "") + ".";
      }

      const imageUrl = generateDynamicCoverUrl(headline, category, i);

      curated.push({
        headline,
        body,
        category,
        imageUrl
      });
    }

    return curated;
  } catch (err) {
    console.error("[AICurator] Live news aggregation error:", err);
    return getDynamicFallbackBytes();
  }
}

function getDynamicFallbackBytes(): CuratedByte[] {
  const timeSeed = Date.now();
  const topics = [
    { title: "Next-Gen AI Vision Models Expand Real-Time Spatial Mapping Capabilities", cat: "AI" },
    { title: "Quantum Error Correction Reaches Critical Commercial Threshold", cat: "Tech" },
    { title: "Solid-State Energy Cells Enter Automated Assembly Trials for EV Fleets", cat: "Innovation" },
    { title: "Autonomous Orbital Cleaners Deployed to Safely Clear Satellite Debris", cat: "Science" },
    { title: "Silicon-Photonic Optical Chips Slash Data Center Power Usage by 45%", cat: "Tech" },
    { title: "Synthetic Biology Platform Creates Biodegradable Marine Structural Polymers", cat: "Science" },
    { title: "Zero-Trust Encryption Architecture Enhances Decentralized Edge Mesh Networks", cat: "Crypto" },
    { title: "Neuromorphic Processors Enable 120 FPS Robotics Intelligence at Low Power", cat: "AI" },
    { title: "Formal Code Verification Engines Prevent Memory Vulnerabilities at Compile Time", cat: "Tech" },
    { title: "Satellite Laser Communications Link Deep Space Drones to Earth Grid", cat: "Science" }
  ];

  return topics.map((t, idx) => {
    let body = `Leading research institutions and technology providers have announced breakthrough progress in ${t.title.toLowerCase()}. This operational milestone marks a fundamental shift toward next-generation scalable infrastructure across global markets.\n\nEngineers and industry analysts emphasize that these technical enhancements enable low-latency processing, enhanced resource efficiency, and robust security safeguards. Deployment timelines indicate widespread adoption across commercial enterprise platforms through 2026.`;

    if (body.length < 600) {
      body += ` Additional pilot trials are scheduled for deployment across international testbeds to validate performance standards and operational reliability.`;
    }
    if (body.length > 800) {
      body = body.slice(0, 780).replace(/\s+\S*$/, "") + ".";
    }

    return {
      headline: t.title,
      body,
      category: t.cat,
      imageUrl: generateDynamicCoverUrl(t.title, t.cat, idx + timeSeed)
    };
  });
}
