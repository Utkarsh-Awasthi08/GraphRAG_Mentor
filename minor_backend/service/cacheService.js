import Redis from "ioredis";
import crypto from "crypto";

const redis = new Redis({
  host: "localhost",
  port: 6380,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  }
});

redis.on("connect", () => console.log("✅ Redis connected (port 6380)"));
redis.on("error", (err) => console.warn("⚠️ Redis error:", err.message));

const DEFAULT_TTL = 600; // 10 minutes

/**
 * Generate a deterministic cache key from a prompt string.
 */
export function hashKey(prefix, input) {
  const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `${prefix}:${hash}`;
}

/**
 * Get a cached value. Returns parsed JSON or null.
 */
export async function getCache(key) {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.warn("Cache GET error:", err.message);
    return null;
  }
}

/**
 * Set a cached value with a TTL (default 10 minutes).
 */
export async function setCache(key, value, ttl = DEFAULT_TTL) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.warn("Cache SET error:", err.message);
  }
}

// ─────────────── Semantic / Fuzzy Cache ───────────────

const SEMANTIC_CACHE_KEY = "semantic_cache_entries";
const SIMILARITY_THRESHOLD = 0.92;

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Search the semantic cache for a near-duplicate question.
 * Returns { text, provider, similarity } if found, or null.
 *
 * We store a list of { embedding, text, provider, timestamp } entries in Redis.
 * On each new query, we compare its embedding against all cached entries.
 */
export async function findSemanticMatch(queryEmbedding) {
  try {
    const raw = await redis.get(SEMANTIC_CACHE_KEY);
    if (!raw) return null;

    const entries = JSON.parse(raw);
    let bestMatch = null;
    let bestScore = 0;

    for (const entry of entries) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (bestScore >= SIMILARITY_THRESHOLD && bestMatch) {
      console.log(`🧠 Semantic cache HIT (similarity: ${bestScore.toFixed(4)})`);
      return {
        text: bestMatch.text,
        provider: bestMatch.provider + " (semantic cache)",
        similarity: bestScore,
      };
    }

    return null;
  } catch (err) {
    console.warn("Semantic cache search error:", err.message);
    return null;
  }
}

/**
 * Add an entry to the semantic cache.
 * Keeps a rolling window of the last 50 entries (LRU-style).
 */
export async function addSemanticEntry(embedding, text, provider) {
  try {
    const raw = await redis.get(SEMANTIC_CACHE_KEY);
    const entries = raw ? JSON.parse(raw) : [];

    entries.push({
      embedding,
      text,
      provider,
      timestamp: Date.now(),
    });

    // Keep only the most recent 50 entries to bound memory usage
    const trimmed = entries.slice(-50);

    // Store with a 30-minute TTL (semantic cache lives longer than exact cache)
    await redis.set(SEMANTIC_CACHE_KEY, JSON.stringify(trimmed), "EX", 1800);
  } catch (err) {
    console.warn("Semantic cache add error:", err.message);
  }
}

export default redis;
