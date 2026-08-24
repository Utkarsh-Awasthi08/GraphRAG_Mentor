import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { getCache, setCache, hashKey, findSemanticMatch, addSemanticEntry } from "./cacheService.js";
import { generateEmbedding } from "./embeddingService.js";
import dotenv from "dotenv";
dotenv.config();

// ─────────────── Provider Clients ───────────────

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─────────────── Provider Configs ───────────────
// Priority Order: Gemini -> Groq -> OpenRouter (last resort)

const PROVIDERS = {
  gemini: {
    name: "Gemini",
    model: "gemini-3.5-flash",
    enabled: !!process.env.GEMINI_API_KEY,
  },
  groq: {
    name: "Groq",
    model: "qwen/qwen3.6-27b", // fast, free, strong reasoning
    enabled: !!process.env.GROQ_API_KEY,
  },
  openrouter: {
    name: "OpenRouter",
    model: "google/gemma-3-27b-it:free", // free tier model
    enabled: !!OPENROUTER_API_KEY,
  },
};

// ─────────────── Rate Limit Tracking ───────────────
// Simple in-memory sliding window tracker per provider

const rateLimitState = {
  gemini:     { count: 0, windowStart: Date.now(), maxRPM: 15,  cooldownUntil: 0 },
  groq:       { count: 0, windowStart: Date.now(), maxRPM: 30,  cooldownUntil: 0 },
  openrouter: { count: 0, windowStart: Date.now(), maxRPM: 20,  cooldownUntil: 0 },
};

function isProviderAvailable(providerKey) {
  const state = rateLimitState[providerKey];
  const now = Date.now();

  // Check cooldown (set after a 429 error)
  if (now < state.cooldownUntil) return false;

  // Reset window every 60 seconds
  if (now - state.windowStart > 60_000) {
    state.count = 0;
    state.windowStart = now;
  }

  return state.count < state.maxRPM;
}

function recordUsage(providerKey) {
  rateLimitState[providerKey].count++;
}

function setCooldown(providerKey, durationMs = 60_000) {
  rateLimitState[providerKey].cooldownUntil = Date.now() + durationMs;
  console.warn(`⚠️ ${PROVIDERS[providerKey].name} hit rate limit — cooling down for ${durationMs / 1000}s`);
}

// ─────────────── Provider Execution Functions ───────────────

async function callGemini(prompt) {
  const model = geminiAI.getGenerativeModel({ model: PROVIDERS.gemini.model });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function callGroq(prompt) {
  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: PROVIDERS.groq.model,
    temperature: 0.3,
    max_tokens: 2048,
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

async function callOpenRouter(prompt) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "GraphRAG Mentor",
    },
    body: JSON.stringify({
      model: PROVIDERS.openrouter.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errorBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ─────────────── Streaming Functions ───────────────

async function* streamGemini(prompt) {
  const model = geminiAI.getGenerativeModel({ model: PROVIDERS.gemini.model });
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}

async function* streamGroq(prompt) {
  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: PROVIDERS.groq.model,
    temperature: 0.3,
    max_tokens: 2048,
    stream: true,
  });
  for await (const chunk of completion) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) yield text;
  }
}

async function* streamOpenRouter(prompt) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "GraphRAG Mentor",
    },
    body: JSON.stringify({
      model: PROVIDERS.openrouter.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errorBody}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ") && !line.includes("[DONE]")) {
        try {
          const json = JSON.parse(line.slice(6));
          const text = json.choices?.[0]?.delta?.content || "";
          if (text) yield text;
        } catch { /* skip parse errors */ }
      }
    }
  }
}

// ─────────────── Main Gateway: generateText ───────────────

const PROVIDER_ORDER = ["gemini", "groq", "openrouter"];

const callFns = { gemini: callGemini, groq: callGroq, openrouter: callOpenRouter };
const streamFns = { gemini: streamGemini, groq: streamGroq, openrouter: streamOpenRouter };

/**
 * Generate text with automatic caching and multi-provider fallback.
 * @param {string} prompt - The full prompt string.
 * @param {object} options
 * @param {boolean} options.cache - Whether to check/store in Redis (default: true).
 * @param {boolean} options.semanticCache - Whether to use semantic/fuzzy matching (default: true).
 * @param {string} options.userQuery - The raw user question (for semantic embedding). If omitted, full prompt is used.
 * @param {number} options.cacheTTL - Cache TTL in seconds (default: 600).
 * @param {string} options.preferProvider - Force a specific provider first ("gemini" | "groq" | "openrouter").
 * @returns {Promise<{text: string, provider: string, cached: boolean}>}
 */
export async function generateText(prompt, options = {}) {
  const { cache = true, semanticCache = true, userQuery, cacheTTL = 600, preferProvider } = options;

  // 1. Check exact Redis cache
  if (cache) {
    const cacheKey = hashKey("llm", prompt);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("⚡ Exact cache HIT — returning cached LLM response");
      return { text: cached.text, provider: cached.provider, cached: true };
    }
  }

  // 2. Check semantic/fuzzy cache (embedding-based)
  let queryEmbedding = null;
  if (semanticCache && userQuery) {
    try {
      queryEmbedding = await generateEmbedding(userQuery);
      const semanticMatch = await findSemanticMatch(queryEmbedding);
      if (semanticMatch) {
        return { text: semanticMatch.text, provider: semanticMatch.provider, cached: true };
      }
    } catch (err) {
      console.warn("Semantic cache lookup failed (non-fatal):", err.message);
    }
  }

  // 2. Build ordered provider list
  let order = [...PROVIDER_ORDER];
  if (preferProvider && order.includes(preferProvider)) {
    order = [preferProvider, ...order.filter(p => p !== preferProvider)];
  }

  // 3. Try providers in order
  let lastError;
  for (const providerKey of order) {
    if (!PROVIDERS[providerKey].enabled) continue;
    if (!isProviderAvailable(providerKey)) {
      console.log(`⏳ ${PROVIDERS[providerKey].name} — rate limit window full, skipping...`);
      continue;
    }

    try {
      console.log(`🤖 Calling ${PROVIDERS[providerKey].name} (${PROVIDERS[providerKey].model})...`);
      recordUsage(providerKey);
      const text = await callFns[providerKey](prompt);

      // Save to exact cache
      if (cache) {
        const cacheKey = hashKey("llm", prompt);
        await setCache(cacheKey, { text, provider: PROVIDERS[providerKey].name }, cacheTTL);
      }

      // Save to semantic cache
      if (semanticCache && queryEmbedding) {
        await addSemanticEntry(queryEmbedding, text, PROVIDERS[providerKey].name);
      }

      return { text, provider: PROVIDERS[providerKey].name, cached: false };
    } catch (err) {
      lastError = err;
      console.warn(`❌ ${PROVIDERS[providerKey].name} failed:`, err.message);
      // If 429 or rate limit related, set cooldown
      if (err.message?.includes("429") || err.message?.includes("rate") || err.message?.includes("quota")) {
        setCooldown(providerKey, 60_000);
      }
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}

/**
 * Stream text with multi-provider fallback. Returns an async generator.
 * Does NOT cache (streaming is inherently real-time).
 * @param {string} prompt
 * @param {object} options
 * @param {string} options.preferProvider - Force a specific provider first.
 * @returns {AsyncGenerator<string>} and provider name
 */
export async function streamText(prompt, options = {}) {
  const { preferProvider } = options;

  let order = [...PROVIDER_ORDER];
  if (preferProvider && order.includes(preferProvider)) {
    order = [preferProvider, ...order.filter(p => p !== preferProvider)];
  }

  let lastError;
  for (const providerKey of order) {
    if (!PROVIDERS[providerKey].enabled) continue;
    if (!isProviderAvailable(providerKey)) {
      console.log(`⏳ ${PROVIDERS[providerKey].name} — rate limit window full, skipping...`);
      continue;
    }

    try {
      console.log(`🤖 Streaming from ${PROVIDERS[providerKey].name} (${PROVIDERS[providerKey].model})...`);
      recordUsage(providerKey);
      const stream = streamFns[providerKey](prompt);
      return { stream, provider: PROVIDERS[providerKey].name };
    } catch (err) {
      lastError = err;
      console.warn(`❌ ${PROVIDERS[providerKey].name} stream failed:`, err.message);
      if (err.message?.includes("429") || err.message?.includes("rate") || err.message?.includes("quota")) {
        setCooldown(providerKey, 60_000);
      }
    }
  }

  throw new Error(`All AI providers failed to stream. Last error: ${lastError?.message}`);
}

/**
 * Get the current rate limit status for all providers.
 * Useful for debugging/monitoring.
 */
export function getGatewayStatus() {
  return Object.entries(rateLimitState).map(([key, state]) => ({
    provider: PROVIDERS[key]?.name || key,
    enabled: PROVIDERS[key]?.enabled || false,
    model: PROVIDERS[key]?.model,
    requestsInWindow: state.count,
    maxRPM: state.maxRPM,
    onCooldown: Date.now() < state.cooldownUntil,
    cooldownRemaining: Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000)),
  }));
}
