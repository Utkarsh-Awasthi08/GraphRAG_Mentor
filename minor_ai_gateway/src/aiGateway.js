import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { Mistral } from "@mistralai/mistralai";
import { getCache, setCache, hashKey, findSemanticMatch, addSemanticEntry } from "./cacheService.js";
import { generateEmbedding } from "./embeddingService.js";
import dotenv from "dotenv";
dotenv.config();

// ─────────────── Provider Clients ───────────────

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─────────────── Groq Model Rotation Pool ───────────────
// Priority order within Groq: highest RPD & TPD first (best bang for buck)
// Excluded: whisper (audio only), prompt-guard (safety/classification only), compound (orchestration)

const GROQ_MODELS = [
  { id: "qwen/qwen3.6-27b",      rpm: 30, rpd: 1000, label: "Qwen 3.6 27B"      },
  { id: "qwen/qwen3.8-27b",      rpm: 30, rpd: 1000, label: "Qwen 3.8 27B"      },
  { id: "openai/gpt-oss-120b",   rpm: 30, rpd: 1000, label: "GPT-OSS 120B"      },
  { id: "openai/gpt-oss-20b",    rpm: 30, rpd: 1000, label: "GPT-OSS 20B"       },
  { id: "groq/compound-mini",    rpm: 30, rpd: 250,  label: "Groq Compound Mini" },
  { id: "groq/compound",         rpm: 30, rpd: 250,  label: "Groq Compound"     },
];

// Per-model rate-limit state for Groq rotation
const groqModelState = {};
for (const m of GROQ_MODELS) {
  groqModelState[m.id] = {
    count:       0,
    windowStart: Date.now(),
    dailyCount:  0,
    dayStart:    Date.now(),
    cooldownUntil: 0,
  };
}

function isGroqModelAvailable(modelId) {
  const m     = GROQ_MODELS.find(x => x.id === modelId);
  const state = groqModelState[modelId];
  const now   = Date.now();

  // Cooldown (set after a 429 from this specific model)
  if (now < state.cooldownUntil) return false;

  // Reset 60-second RPM window
  if (now - state.windowStart > 60_000) {
    state.count       = 0;
    state.windowStart = now;
  }

  // Reset daily RPD window (86 400 s)
  if (now - state.dayStart > 86_400_000) {
    state.dailyCount = 0;
    state.dayStart   = now;
  }

  // Near-limit threshold: treat 90 % as "full" to rotate early
  const rpmNearLimit = state.count       >= Math.floor(m.rpm * 0.9);
  const rpdNearLimit = state.dailyCount  >= Math.floor(m.rpd * 0.9);

  return !rpmNearLimit && !rpdNearLimit;
}

function recordGroqModelUsage(modelId) {
  groqModelState[modelId].count++;
  groqModelState[modelId].dailyCount++;
}

function setGroqModelCooldown(modelId, durationMs = 60_000) {
  groqModelState[modelId].cooldownUntil = Date.now() + durationMs;
  const label = GROQ_MODELS.find(x => x.id === modelId)?.label || modelId;
  console.warn(`⚠️ Groq [${label}] hit rate limit — cooling down for ${durationMs / 1000}s`);
}

/** Returns the next available Groq model ID, or null if all are exhausted. */
function pickGroqModel() {
  for (const m of GROQ_MODELS) {
    if (isGroqModelAvailable(m.id)) return m.id;
  }
  return null;
}

// ─────────────── Top-Level Provider Configs ───────────────
// Priority Order for Chat/Streaming: Groq -> OpenRouter -> Gemini
// Dedicated Mistral provider for Cypher generation & query classification

const PROVIDERS = {
  groq: {
    name:    "Groq",
    enabled: !!process.env.GROQ_API_KEY,
  },
  openrouter: {
    name:    "OpenRouter",
    model:   "google/gemma-3-27b-it:free",
    enabled: !!OPENROUTER_API_KEY,
  },
  gemini: {
    name:    "Gemini",
    model:   "gemini-3.6-flash",
    enabled: !!process.env.GEMINI_API_KEY,
  },
  mistral: {
    name:    "Mistral",
    // mistral-large for precise analytical tasks (Cypher, classification)
    modelLarge: "mistral-large-latest",
    // ministral-8b for fast, low-cost classification
    modelFast:  "ministral-8b-latest",
    enabled: !!process.env.MISTRAL_API_KEY,
  },
};

// Simple rate-limit state for OpenRouter & Gemini (no rotation)
const rateLimitState = {
  openrouter: { count: 0, windowStart: Date.now(), maxRPM: 20, cooldownUntil: 0 },
  gemini:     { count: 0, windowStart: Date.now(), maxRPM: 15, cooldownUntil: 0 },
};

function isProviderAvailable(providerKey) {
  // Groq availability is determined by model rotation, handled separately
  if (providerKey === "groq") return !!pickGroqModel();

  const state = rateLimitState[providerKey];
  const now   = Date.now();
  if (now < state.cooldownUntil) return false;
  if (now - state.windowStart > 60_000) {
    state.count       = 0;
    state.windowStart = now;
  }
  return state.count < state.maxRPM;
}

function recordUsage(providerKey) {
  if (providerKey === "groq") return; // handled per-model
  rateLimitState[providerKey].count++;
}

function setCooldown(providerKey, durationMs = 60_000) {
  if (providerKey === "groq") return; // handled per-model
  rateLimitState[providerKey].cooldownUntil = Date.now() + durationMs;
  console.warn(`⚠️ ${PROVIDERS[providerKey].name} hit rate limit — cooling down for ${durationMs / 1000}s`);
}

// ─────────────── Provider Execution Functions ───────────────

async function callGemini(prompt) {
  const model  = geminiAI.getGenerativeModel({ model: PROVIDERS.gemini.model });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Call Mistral for structured tasks (Cypher generation / query classification).
 * @param {string} prompt
 * @param {'large'|'fast'} tier - 'large' for mistral-large, 'fast' for ministral-8b
 */
async function callMistral(prompt, tier = "large") {
  const model = tier === "fast"
    ? PROVIDERS.mistral.modelFast
    : PROVIDERS.mistral.modelLarge;

  const result = await mistralClient.chat.complete({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1, // Low temperature for deterministic structured outputs
    maxTokens: 512,
  });
  return result.choices[0]?.message?.content?.trim() || "";
}

/**
 * Call Groq with automatic model rotation.
 * Returns { text, modelUsed } so callers know which model was picked.
 */
async function callGroq(prompt) {
  const modelId = pickGroqModel();
  if (!modelId) throw new Error("All Groq models are at rate limit");

  const label = GROQ_MODELS.find(m => m.id === modelId)?.label || modelId;
  console.log(`  ↳ Groq model selected: ${label}`);

  try {
    recordGroqModelUsage(modelId);
    const completion = await groq.chat.completions.create({
      messages:   [{ role: "user", content: prompt }],
      model:      modelId,
      temperature: 0.3,
      max_tokens:  2048,
    });
    return { text: completion.choices[0]?.message?.content?.trim() || "", modelUsed: label };
  } catch (err) {
    if (err.message?.includes("429") || err.message?.includes("rate") || err.message?.includes("quota")) {
      setGroqModelCooldown(modelId);
    }
    throw err;
  }
}

async function callOpenRouter(prompt) {
  const res = await fetch(OPENROUTER_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title":      "GraphRAG Mentor",
    },
    body: JSON.stringify({
      model:       PROVIDERS.openrouter.model,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  2048,
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
  const model  = geminiAI.getGenerativeModel({ model: PROVIDERS.gemini.model });
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}

/**
 * Stream from Groq with automatic model rotation.
 * Returns { stream (AsyncGenerator), modelLabel }
 */
async function streamGroq(prompt) {
  const modelId = pickGroqModel();
  if (!modelId) throw new Error("All Groq models are at rate limit");

  const label = GROQ_MODELS.find(m => m.id === modelId)?.label || modelId;
  console.log(`  ↳ Groq stream model selected: ${label}`);

  recordGroqModelUsage(modelId);

  async function* gen() {
    try {
      const completion = await groq.chat.completions.create({
        messages:    [{ role: "user", content: prompt }],
        model:       modelId,
        temperature: 0.3,
        max_tokens:  2048,
        stream:      true,
      });
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) yield text;
      }
    } catch (err) {
      if (err.message?.includes("429") || err.message?.includes("rate") || err.message?.includes("quota")) {
        setGroqModelCooldown(modelId);
      }
      throw err;
    }
  }

  return { stream: gen(), modelLabel: label };
}

async function* streamOpenRouter(prompt) {
  const res = await fetch(OPENROUTER_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title":      "GraphRAG Mentor",
    },
    body: JSON.stringify({
      model:       PROVIDERS.openrouter.model,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  2048,
      stream:      true,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errorBody}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

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

// Priority: Groq → OpenRouter → Gemini
const PROVIDER_ORDER = ["groq", "openrouter", "gemini"];

/**
 * Generate text with automatic caching and multi-provider fallback.
 * Groq rotates across its model pool before escalating to OpenRouter.
 */
export async function generateText(prompt, options = {}) {
  const {
    cache = true,
    semanticCache = true,
    userQuery,
    cacheTTL = 600,
    preferProvider,
  } = options;

  // 1. Exact Redis cache check
  if (cache) {
    const cacheKey = hashKey("llm", prompt);
    const cached   = await getCache(cacheKey);
    if (cached) {
      console.log("⚡ Exact cache HIT — returning cached LLM response");
      return { text: cached.text, provider: cached.provider, cached: true };
    }
  }

  // 2. Semantic / fuzzy cache check (embedding-based)
  let queryEmbedding = null;
  if (semanticCache && userQuery) {
    try {
      queryEmbedding       = await generateEmbedding(userQuery);
      const semanticMatch  = await findSemanticMatch(queryEmbedding);
      if (semanticMatch) {
        return { text: semanticMatch.text, provider: semanticMatch.provider, cached: true };
      }
    } catch (err) {
      console.warn("Semantic cache lookup failed (non-fatal):", err.message);
    }
  }

  // 3. Build ordered provider list
  let order = [...PROVIDER_ORDER];
  if (preferProvider && order.includes(preferProvider)) {
    order = [preferProvider, ...order.filter(p => p !== preferProvider)];
  }

  // 4. Try providers in order; Groq internally rotates models
  let lastError;
  for (const providerKey of order) {
    if (!PROVIDERS[providerKey].enabled) continue;
    if (!isProviderAvailable(providerKey)) {
      console.log(`⏳ ${PROVIDERS[providerKey].name} — all rate limits reached, skipping...`);
      continue;
    }

    try {
      recordUsage(providerKey);

      let text, providerLabel;
      if (providerKey === "groq") {
        const result  = await callGroq(prompt);
        text          = result.text;
        providerLabel = `Groq (${result.modelUsed})`;
      } else if (providerKey === "openrouter") {
        text          = await callOpenRouter(prompt);
        providerLabel = `OpenRouter (${PROVIDERS.openrouter.model})`;
      } else {
        text          = await callGemini(prompt);
        providerLabel = `Gemini (${PROVIDERS.gemini.model})`;
      }

      console.log(`✅ Response from ${providerLabel}`);

      // Store in exact cache
      if (cache) {
        const cacheKey = hashKey("llm", prompt);
        await setCache(cacheKey, { text, provider: providerLabel }, cacheTTL);
      }

      // Store in semantic cache
      if (semanticCache && queryEmbedding) {
        await addSemanticEntry(queryEmbedding, text, providerLabel);
      }

      return { text, provider: providerLabel, cached: false };
    } catch (err) {
      lastError = err;
      console.warn(`❌ ${PROVIDERS[providerKey].name} failed:`, err.message);
      if (
        err.message?.includes("429") ||
        err.message?.includes("rate") ||
        err.message?.includes("quota")
      ) {
        setCooldown(providerKey, 60_000);
      }
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}

/**
 * Stream text with multi-provider fallback.
 * Groq internally rotates models. Returns { stream, provider }.
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
      console.log(`⏳ ${PROVIDERS[providerKey].name} — all rate limits reached, skipping...`);
      continue;
    }

    try {
      recordUsage(providerKey);

      if (providerKey === "groq") {
        const { stream, modelLabel } = await streamGroq(prompt);
        console.log(`🤖 Streaming from Groq (${modelLabel})...`);
        return { stream, provider: `Groq (${modelLabel})` };
      } else if (providerKey === "openrouter") {
        console.log(`🤖 Streaming from OpenRouter (${PROVIDERS.openrouter.model})...`);
        return { stream: streamOpenRouter(prompt), provider: `OpenRouter (${PROVIDERS.openrouter.model})` };
      } else {
        console.log(`🤖 Streaming from Gemini (${PROVIDERS.gemini.model})...`);
        return { stream: streamGemini(prompt), provider: `Gemini (${PROVIDERS.gemini.model})` };
      }
    } catch (err) {
      lastError = err;
      console.warn(`❌ ${PROVIDERS[providerKey].name} stream failed:`, err.message);
      if (
        err.message?.includes("429") ||
        err.message?.includes("rate") ||
        err.message?.includes("quota")
      ) {
        setCooldown(providerKey, 60_000);
      }
    }
  }

  throw new Error(`All AI providers failed to stream. Last error: ${lastError?.message}`);
}

/**
 * Dedicated Mistral text generation — for structured tasks that need precision:
 *   - Text-to-Cypher generation  → tier: "large"  (mistral-large-latest)
 *   - Query classification       → tier: "fast"   (ministral-8b-latest)
 *
 * Bypasses the Groq/OpenRouter/Gemini rotation pool entirely.
 * Includes Redis exact-cache support.
 *
 * @param {string} prompt
 * @param {object} options
 * @param {'large'|'fast'} options.tier   - Which Mistral model to use
 * @param {boolean}        options.cache  - Whether to use Redis cache (default: true)
 * @param {number}         options.cacheTTL - TTL in seconds (default: 300)
 * @returns {Promise<{text: string, provider: string, cached: boolean}>}
 */
export async function generateMistral(prompt, options = {}) {
  const { tier = "large", cache = true, cacheTTL = 300 } = options;

  if (!PROVIDERS.mistral.enabled) {
    throw new Error("Mistral provider is not enabled — missing MISTRAL_API_KEY");
  }

  // Check Redis cache
  if (cache) {
    const cacheKey = hashKey("mistral", prompt);
    const cached   = await getCache(cacheKey);
    if (cached) {
      console.log("⚡ Mistral cache HIT");
      return { text: cached.text, provider: cached.provider, cached: true };
    }
  }

  const model = tier === "fast"
    ? PROVIDERS.mistral.modelFast
    : PROVIDERS.mistral.modelLarge;

  console.log(`🧠 Calling Mistral (${model}) [tier: ${tier}]...`);
  const text = await callMistral(prompt, tier);

  const providerLabel = `Mistral (${model})`;

  if (cache) {
    const cacheKey = hashKey("mistral", prompt);
    await setCache(cacheKey, { text, provider: providerLabel }, cacheTTL);
  }

  return { text, provider: providerLabel, cached: false };
}

/**
 * Returns monitoring status for all providers and Groq model pool.
 */
export function getGatewayStatus() {
  const providerStatus = Object.entries(PROVIDERS).map(([key, cfg]) => {
    if (key === "groq") {
      const models = GROQ_MODELS.map(m => {
        const s   = groqModelState[m.id];
        const now = Date.now();
        return {
          model:            m.label,
          rpmUsed:          s.count,
          rpmLimit:         m.rpm,
          rpdUsed:          s.dailyCount,
          rpdLimit:         m.rpd,
          available:        isGroqModelAvailable(m.id),
          onCooldown:       now < s.cooldownUntil,
          cooldownRemaining: Math.max(0, Math.ceil((s.cooldownUntil - now) / 1000)),
        };
      });
      return { provider: "Groq", enabled: cfg.enabled, models };
    }

    const state = rateLimitState[key];
    const now   = Date.now();
    return {
      provider:          cfg.name,
      enabled:           cfg.enabled,
      model:             cfg.model,
      requestsInWindow:  state.count,
      maxRPM:            state.maxRPM,
      onCooldown:        now < state.cooldownUntil,
      cooldownRemaining: Math.max(0, Math.ceil((state.cooldownUntil - now) / 1000)),
    };
  });

  return providerStatus;
}
