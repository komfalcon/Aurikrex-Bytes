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
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80"
];

export async function curateTenBytes(): Promise<CuratedByte[]> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[AICurator] No GEMINI_API_KEY or GOOGLE_API_KEY found in environment. Using default fallback curation.");
    return getFallbackBytes();
  }

  const prompt = `You are the lead editor for Aurikrex Bytes, a high-signal digital publication.
Curate EXACTLY 10 distinct, engaging news bytes covering Technology, Artificial Intelligence, Science, Future Tech, and Global Innovation.

For EACH byte, output valid JSON array with 10 objects:
[
  {
    "headline": "Crisp compelling headline (under 80 chars)",
    "body": "Clear, informative brief in 2 short paragraphs (under 180 words). High signal, zero fluff.",
    "category": "Tech" | "AI" | "Science" | "Crypto" | "Innovation",
    "imageKeyword": "abstract technology / neural network / quantum computing / cyber security"
  }
]

Return ONLY the raw JSON array without markdown formatting or code blocks.`;

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
      const errText = await response.text();
      console.error(`[AICurator] Gemini API request failed (${response.status}):`, errText);
      return getFallbackBytes();
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("[AICurator] Gemini response parsed but was empty.");
      return getFallbackBytes();
    }

    return parsed.slice(0, 10).map((item: any, idx: number) => ({
      headline: String(item.headline || "Tech Update").slice(0, 120),
      body: String(item.body || "").trim(),
      category: String(item.category || "Tech"),
      imageUrl: FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]
    }));
  } catch (err) {
    console.error("[AICurator] Failed to curate bytes via Gemini:", err);
    return getFallbackBytes();
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
        imageUrl: byte.imageUrl,
        status,
        createdBy: 1,
        updatedAt: now
      });
      count++;
    } catch (err) {
      console.error(`[AICurator] Error inserting byte "${byte.headline}":`, err);
    }
  }

  console.info(`[AICurator] Successfully published ${count} new Bytes!`);
  return count;
}

function getFallbackBytes(): CuratedByte[] {
  return [
    {
      headline: "Quantum Computing Reaches Milestone in Fault-Tolerant Qubits",
      body: "Researchers have demonstrated logical qubit operations with error rates below the fault-tolerance threshold. This breakthrough paves the way for practical quantum algorithms in chemistry and material science.\n\nCommercial applications are expected within the next three years as hardware scaling improves.",
      category: "Tech",
      imageUrl: FALLBACK_IMAGES[0]
    },
    {
      headline: "Next-Generation Neural Architectures Slash Inference Costs by 60%",
      body: "Engineers have unveiled a sparse attention mechanism that drastically reduces compute power needed for large language model inference.\n\nThis optimization enables low-latency AI deployment on consumer hardware without quality degradation.",
      category: "AI",
      imageUrl: FALLBACK_IMAGES[1]
    },
    {
      headline: "Fusion Energy Prototype Achieves Net Energy Gain in Extended Plasma Run",
      body: "A compact tokamak reactor maintained stable plasma fusion for over 20 minutes, outputting more energy than consumed by its heating lasers.\n\nGrid integration trials are scheduled for late 2028.",
      category: "Science",
      imageUrl: FALLBACK_IMAGES[2]
    },
    {
      headline: "Solid-State Batteries Enter Pilot Production for Electric Transport",
      body: "Automotive manufacturers have initiated pilot assembly for high-density solid-state batteries promising 800-mile ranges and 10-minute charge times.\n\nMass market vehicle integration is targeted for 2027.",
      category: "Innovation",
      imageUrl: FALLBACK_IMAGES[3]
    },
    {
      headline: "Autonomous Orbital Cleaners Deploy to Clear Low Earth Orbit Debris",
      body: "Space agencies have deployed the first fleet of autonomous satellite harvesters designed to de-orbit space junk using laser propulsion.\n\nThe mission aims to clear 500 cataloged debris pieces within its initial year.",
      category: "Tech",
      imageUrl: FALLBACK_IMAGES[4]
    },
    {
      headline: "Silicon-Photonic Chips Replace Copper Interconnects in Data Centers",
      body: "Hyperscale cloud providers are transitioning server architectures to optical interconnects, increasing data bandwidth tenfold while cutting energy consumption by 40%.\n\nThe technology is set to become industry standard across AI clusters.",
      category: "Innovation",
      imageUrl: FALLBACK_IMAGES[5]
    },
    {
      headline: "Synthetic Biology Platform Synthesizes Biodegradable Structural Polymer",
      body: "Bioengineers have programmed micro-organisms to produce high-tensile bioplastics that naturally decompose in marine environments within 90 days.\n\nCommercial packaging trials begin next quarter.",
      category: "Science",
      imageUrl: FALLBACK_IMAGES[6]
    },
    {
      headline: "Edge-AI Vision Processors Enable Real-Time Robotic Spatial Mapping",
      body: "Ultra-low-power vision chips allow robotics to perform 3D spatial mapping at 120 FPS locally without reliance on cloud compute.\n\nApplications include search-and-rescue drones and industrial automation.",
      category: "AI",
      imageUrl: FALLBACK_IMAGES[7]
    },
    {
      headline: "Decentralized Mesh Networks Provide Resilient Emergency Communications",
      body: "New peer-to-peer satellite-linked mesh nodes allow off-grid communication during natural disasters without traditional cell tower infrastructure.\n\nEmergency services across three continents are adopting the protocol.",
      category: "Tech",
      imageUrl: FALLBACK_IMAGES[8]
    },
    {
      headline: "Generative Code Verification Engines Guarantee Zero-Day Protection",
      body: "Formal verification engines powered by symbolic reasoning now audit software logic in real time, detecting memory safety and authorization bugs prior to compilation.\n\nDevelopment platforms are integrating the checks into standard CI pipelines.",
      category: "AI",
      imageUrl: FALLBACK_IMAGES[9]
    }
  ];
}
