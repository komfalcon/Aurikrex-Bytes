import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db.js";

export const FOLLOW_UP_PROMPT_VERSION = "v1-bytes-followup";
export const MIN_CACHEABLE_OUTPUT_CHARS = 35;
export const MAX_CACHEABLE_OUTPUT_CHARS = 12000;

const REFUSAL_OR_FALLBACK_PATTERNS = [
  /as an ai/i,
  /i cannot fulfill/i,
  /i'm sorry,?\s+but i can't/i,
  /unable to help with that/i,
  /internal server error/i,
  /service unavailable/i,
  /rate limit exceeded/i,
  /quota exceeded/i,
  /live search and ai analysis are currently updating/i,
  /please ensure tavily_api_key/i,
];

export interface CachedFollowUpPayload {
  answer: string;
  searchQueries: string[];
  modelUsed: string;
  cached: boolean;
  contentHash: string;
  hitCount: number;
}

// Single-flight coalescing map: deduplicates concurrent identical cache-miss AI requests
const inFlight = new Map<string, Promise<{ answer: string; searchQueries: string[]; modelUsed: string }>>();

// Fast in-memory L1 cache backed by persistent Turso/libSQL L2 table (`ai_explanation_cache`)
const memoryCache = new Map<
  string,
  {
    contentHash: string;
    promptVersion: string;
    postId: number;
    questionText: string;
    answerText: string;
    searchQueriesJson: string;
    modelUsed: string;
    status: "active" | "invalidated";
    hitCount: number;
    reportCount: number;
    createdAt: number;
    lastServedAt: number;
  }
>();

let _cacheTableReady: Promise<void> | null = null;

async function ensureCacheTable() {
  const db = await getDb();
  if (!db) return null;
  if (!_cacheTableReady) {
    _cacheTableReady = (async () => {
      await db.run(
        sql.raw(`CREATE TABLE IF NOT EXISTS ai_explanation_cache (
          content_hash text NOT NULL,
          prompt_version text NOT NULL,
          post_id integer NOT NULL,
          question_text text NOT NULL,
          answer_text text NOT NULL,
          search_queries_json text NOT NULL DEFAULT '[]',
          model_used text NOT NULL DEFAULT 'mistral-small-latest',
          status text NOT NULL DEFAULT 'active',
          hit_count integer NOT NULL DEFAULT 0,
          report_count integer NOT NULL DEFAULT 0,
          invalidated_reason text,
          created_at integer NOT NULL,
          last_served_at integer NOT NULL,
          PRIMARY KEY (content_hash, prompt_version)
        )`)
      );
      await db.run(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS ai_explanation_cache_post_idx ON ai_explanation_cache (post_id, status)"
        )
      );
    })().catch((err) => {
      console.warn("[AiCache] Table initialization warning:", err);
      _cacheTableReady = null;
    });
  }
  await _cacheTableReady;
  return db;
}

export function normalizeCanonicalText(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .toLowerCase();
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generates a deterministic SHA-256 content hash from the canonicalized story content and reader question.
 * If the post headline/body is edited, the hash naturally changes so stale explanations are never served!
 */
export function computeFollowUpContentHash(params: {
  postId: number;
  headline: string;
  body: string;
  question: string;
  promptVersion?: string;
}): string {
  const canonicalPayload = JSON.stringify({
    v: params.promptVersion || FOLLOW_UP_PROMPT_VERSION,
    postId: Number(params.postId),
    headline: normalizeCanonicalText(params.headline),
    body: normalizeCanonicalText(params.body),
    question: normalizeCanonicalText(params.question),
  });
  return sha256Hex(canonicalPayload);
}

/**
 * Validates AI output before caching, matching CBT's validateExplanationOutput rules.
 */
export function validateFollowUpOutput(rawText: string | null | undefined): {
  valid: boolean;
  normalizedText: string;
  reason?: string;
} {
  if (!rawText || typeof rawText !== "string") {
    return { valid: false, normalizedText: "", reason: "Output is empty or non-string" };
  }

  const normalizedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (normalizedText.length < MIN_CACHEABLE_OUTPUT_CHARS) {
    return {
      valid: false,
      normalizedText,
      reason: `Output too short (${normalizedText.length} < ${MIN_CACHEABLE_OUTPUT_CHARS} chars)`,
    };
  }

  if (normalizedText.length > MAX_CACHEABLE_OUTPUT_CHARS) {
    return {
      valid: false,
      normalizedText,
      reason: `Output too long (${normalizedText.length} > ${MAX_CACHEABLE_OUTPUT_CHARS} chars)`,
    };
  }

  for (const pattern of REFUSAL_OR_FALLBACK_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        valid: false,
        normalizedText,
        reason: `Output matched refusal/fallback pattern: ${pattern.source}`,
      };
    }
  }

  return { valid: true, normalizedText };
}

/**
 * Looks up a cached AI follow-up response by contentHash + promptVersion.
 * Increments hitCount and updates lastServedAt on HIT.
 */
export async function getCachedFollowUp(
  contentHash: string,
  promptVersion: string = FOLLOW_UP_PROMPT_VERSION
): Promise<CachedFollowUpPayload | null> {
  const memKey = `${promptVersion}:${contentHash}`;
  const now = Date.now();

  // 1. Check L1 memory cache first
  const memRecord = memoryCache.get(memKey);
  if (memRecord && memRecord.status === "active" && memRecord.answerText) {
    memRecord.hitCount += 1;
    memRecord.lastServedAt = now;
    // Update L2 database hit count asynchronously
    void incrementDbHitCount(contentHash, promptVersion, now);
    let parsedQueries: string[] = [];
    try {
      parsedQueries = JSON.parse(memRecord.searchQueriesJson);
    } catch {}
    return {
      answer: memRecord.answerText,
      searchQueries: Array.isArray(parsedQueries) ? parsedQueries : [],
      modelUsed: memRecord.modelUsed,
      cached: true,
      contentHash,
      hitCount: memRecord.hitCount,
    };
  }

  // 2. Check L2 persistent Turso/SQLite database
  try {
    const db = await ensureCacheTable();
    if (!db) return null;

    const rows = await db.all<{
      content_hash: string;
      prompt_version: string;
      post_id: number;
      question_text: string;
      answer_text: string;
      search_queries_json: string;
      model_used: string;
      status: string;
      hit_count: number;
      report_count: number;
      created_at: number;
      last_served_at: number;
    }>(
      sql`SELECT content_hash, prompt_version, post_id, question_text, answer_text, search_queries_json, model_used, status, hit_count, report_count, created_at, last_served_at
          FROM ai_explanation_cache
          WHERE content_hash = ${contentHash} AND prompt_version = ${promptVersion} AND status = 'active'
          LIMIT 1`
    );

    const row = rows[0];
    if (!row || !row.answer_text) return null;

    const newHitCount = (Number(row.hit_count) || 0) + 1;
    memoryCache.set(memKey, {
      contentHash: row.content_hash,
      promptVersion: row.prompt_version,
      postId: Number(row.post_id),
      questionText: row.question_text,
      answerText: row.answer_text,
      searchQueriesJson: row.search_queries_json || "[]",
      modelUsed: row.model_used || "mistral-small-latest",
      status: "active",
      hitCount: newHitCount,
      reportCount: Number(row.report_count) || 0,
      createdAt: Number(row.created_at) || now,
      lastServedAt: now,
    });

    void incrementDbHitCount(contentHash, promptVersion, now);

    let parsedQueries: string[] = [];
    try {
      parsedQueries = JSON.parse(row.search_queries_json || "[]");
    } catch {}

    return {
      answer: row.answer_text,
      searchQueries: Array.isArray(parsedQueries) ? parsedQueries : [],
      modelUsed: row.model_used || "mistral-small-latest",
      cached: true,
      contentHash,
      hitCount: newHitCount,
    };
  } catch (err) {
    console.warn("[AiCache] Read error:", err);
    return null;
  }
}

async function incrementDbHitCount(contentHash: string, promptVersion: string, now: number) {
  try {
    const db = await ensureCacheTable();
    if (!db) return;
    await db.run(
      sql`UPDATE ai_explanation_cache
          SET hit_count = hit_count + 1, last_served_at = ${now}
          WHERE content_hash = ${contentHash} AND prompt_version = ${promptVersion}`
    );
  } catch {}
}

/**
 * Validates and persists a newly generated AI follow-up response into L1 + L2 cache.
 */
export async function setCachedFollowUp(params: {
  contentHash: string;
  promptVersion?: string;
  postId: number;
  question: string;
  answer: string;
  searchQueries: string[];
  modelUsed: string;
}): Promise<boolean> {
  const promptVersion = params.promptVersion || FOLLOW_UP_PROMPT_VERSION;
  const validation = validateFollowUpOutput(params.answer);
  if (!validation.valid) {
    console.warn(`[AiCache] Rejected caching invalid AI output: ${validation.reason}`);
    return false;
  }

  const now = Date.now();
  const searchQueriesJson = JSON.stringify(params.searchQueries || []);
  const memKey = `${promptVersion}:${params.contentHash}`;

  memoryCache.set(memKey, {
    contentHash: params.contentHash,
    promptVersion,
    postId: params.postId,
    questionText: params.question,
    answerText: validation.normalizedText,
    searchQueriesJson,
    modelUsed: params.modelUsed || "mistral-small-latest",
    status: "active",
    hitCount: 0,
    reportCount: 0,
    createdAt: now,
    lastServedAt: now,
  });

  try {
    const db = await ensureCacheTable();
    if (!db) return true;
    await db.run(
      sql`INSERT INTO ai_explanation_cache (
            content_hash, prompt_version, post_id, question_text, answer_text,
            search_queries_json, model_used, status, hit_count, report_count, created_at, last_served_at
          ) VALUES (
            ${params.contentHash}, ${promptVersion}, ${params.postId}, ${params.question},
            ${validation.normalizedText}, ${searchQueriesJson}, ${params.modelUsed || "mistral-small-latest"},
            'active', 0, 0, ${now}, ${now}
          )
          ON CONFLICT(content_hash, prompt_version) DO UPDATE SET
            answer_text = excluded.answer_text,
            search_queries_json = excluded.search_queries_json,
            model_used = excluded.model_used,
            status = 'active',
            invalidated_reason = NULL,
            last_served_at = excluded.last_served_at`
    );
    return true;
  } catch (err) {
    console.warn("[AiCache] Write error:", err);
    return true;
  }
}

export const FOLLOW_UP_REPORT_THRESHOLD = 3;

/**
 * Marks a cached AI follow-up response as invalidated (e.g. when reported or post updated).
 */
export async function invalidateCachedFollowUp(
  contentHash: string,
  reason = "reported",
  options: { force?: boolean; promptVersion?: string } = {}
): Promise<boolean> {
  const promptVersion = options.promptVersion || FOLLOW_UP_PROMPT_VERSION;
  const force = Boolean(options.force);
  const memKey = `${promptVersion}:${contentHash}`;
  const memRecord = memoryCache.get(memKey);
  if (memRecord) {
    memRecord.reportCount += 1;
    if (force || memRecord.reportCount >= FOLLOW_UP_REPORT_THRESHOLD) {
      memRecord.status = "invalidated";
    }
  }

  try {
    const db = await ensureCacheTable();
    if (!db) return Boolean(memRecord && memRecord.status === "invalidated");
    if (force) {
      await db.run(
        sql`UPDATE ai_explanation_cache
            SET status = 'invalidated',
                report_count = report_count + 1,
                invalidated_reason = ${reason.slice(0, 200)}
            WHERE content_hash = ${contentHash} AND prompt_version = ${promptVersion}`
      );
      return true;
    } else {
      await db.run(
        sql`UPDATE ai_explanation_cache
            SET report_count = report_count + 1,
                status = CASE WHEN report_count + 1 >= ${FOLLOW_UP_REPORT_THRESHOLD} THEN 'invalidated' ELSE status END,
                invalidated_reason = ${reason.slice(0, 200)}
            WHERE content_hash = ${contentHash} AND prompt_version = ${promptVersion}`
      );
      return Boolean(memRecord && memRecord.status === "invalidated");
    }
  } catch {
    return Boolean(memRecord && memRecord.status === "invalidated");
  }
}

/**
 * Single-flight wrapper so concurrent identical cache misses share a single upstream Tavily + LLM call.
 */
export function singleFlightFollowUp(
  key: string,
  fn: () => Promise<{ answer: string; searchQueries: string[]; modelUsed: string }>
): Promise<{ answer: string; searchQueries: string[]; modelUsed: string }> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }
  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
