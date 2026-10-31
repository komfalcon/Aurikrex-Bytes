import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

// Load environment variables from env or .env
const envPath = existsSync(resolve(process.cwd(), "env"))
  ? resolve(process.cwd(), "env")
  : resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  const envConfig = dotenv.parse(readFileSync(envPath));
  for (const [k, v] of Object.entries(envConfig)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  console.error("Error: TURSO_DATABASE_URL is not set.");
  process.exit(1);
}

const client = createClient({
  url: databaseUrl,
  authToken: authToken || undefined,
});

async function main() {
  console.log("Connecting to Turso database...");
  const res = await client.execute({
    sql: `SELECT id, headline, source_url, source_publisher, status, body, updated_at 
          FROM posts 
          WHERE body LIKE '%Major technological developments were announced today regarding%'
          ORDER BY id DESC`,
    args: [],
  });

  const rows = res.rows;
  console.log(`\nFound ${rows.length} posts with the generic template line:\n`);

  const drafts = rows.filter(r => r.status === "draft");
  const published = rows.filter(r => r.status === "published");
  const scheduled = rows.filter(r => r.status === "scheduled");

  console.log(`- Drafts: ${drafts.length}`);
  console.log(`- Published: ${published.length}`);
  console.log(`- Scheduled: ${scheduled.length}\n`);

  for (const row of rows) {
    console.log(`[ID ${row.id}] [${String(row.status).toUpperCase()}] ${row.headline}`);
  }

  const action = process.argv[2];
  if (!action) {
    console.log(`
Usage:
  node scripts/fix-templated-bytes.mjs list             # Just list matching posts (default)
  node scripts/fix-templated-bytes.mjs delete-drafts    # Delete all templated drafts
  node scripts/fix-templated-bytes.mjs rewrite          # Use Gemini to generate real editorial briefs
`);
    return;
  }

  if (action === "delete-drafts") {
    if (!drafts.length) {
      console.log("No templated drafts to delete.");
      return;
    }
    const draftIds = drafts.map(d => d.id);
    console.log(`Deleting ${draftIds.length} templated drafts...`);
    for (const id of draftIds) {
      await client.execute({
        sql: "DELETE FROM posts WHERE id = ?",
        args: [id],
      });
    }
    console.log("Deleted successfully.");
    return;
  }

  if (action === "rewrite") {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
      console.error("Error: GEMINI_API_KEY or GOOGLE_API_KEY is required for the rewrite action.");
      process.exit(1);
    }

    console.log(`Rewriting ${rows.length} posts using Gemini...`);
    for (const row of rows) {
      console.log(`Generating brief for: "${row.headline}"...`);
      try {
        const prompt = `You are the executive tech editor for Aurikrex Bytes.
Write an authoritative, high-signal editorial brief for this story:
Title: ${row.headline}
Publisher: ${row.source_publisher || "Tech News"}
Source URL: ${row.source_url || ""}

CRITICAL EDITORIAL RULES:
1. Base your brief strictly on the story topic and facts. Do NOT use any generic filler text like "Major technological developments were announced today".
2. Write three concise, punchy paragraphs:
   - Paragraph 1: The core event, company, breakthrough, or incident.
   - Paragraph 2: Technical/architectural implications, why it matters to engineers.
   - Paragraph 3: Outlook, timeline, or key metrics to watch.
3. Total body length MUST be between 500 and 750 characters.
4. Provide a crisp headline under 90 characters (no HTML entities like &#8217; or source tags).

Return JSON format:
{
  "headline": "Clean Crisp Headline",
  "body": "Paragraph 1\\n\\nParagraph 2\\n\\nParagraph 3"
}`;

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-goog-api-key": geminiKey,
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

        if (!resp.ok) {
          console.warn(`Gemini returned status ${resp.status} for ID ${row.id}`);
          continue;
        }

        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (parsed.headline && parsed.body) {
          await client.execute({
            sql: "UPDATE posts SET headline = ?, body = ?, updated_at = ? WHERE id = ?",
            args: [parsed.headline, parsed.body, Date.now(), row.id],
          });
          console.log(`Updated ID ${row.id}: "${parsed.headline}"`);
        }
      } catch (err) {
        console.error(`Failed to rewrite ID ${row.id}:`, err);
      }
    }
    console.log("\nFinished rewriting posts.");
  }
}

main().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
