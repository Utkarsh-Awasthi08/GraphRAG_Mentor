import { generateText, streamText } from "../service/aiGateway.js";
import { INCLUDE_CODE_IN_EMBEDDINGS } from "./embeddingService.js";
import { saveChatHistory } from "../service/graphService.js";
import redis from "../service/cacheService.js";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// ─────────────── Context Pruning ───────────────
const MAX_CONTEXT_ITEMS = 10;

function pruneData(data, mode) {
    if (!data || data.length === 0) return data;

    const total = data.length;

    if (mode === "CONTEXTUAL") {
        // Sort by similarity score (desc), then by timestamp (most recent first)
        const sorted = [...data].sort((a, b) => {
            const scoreA = a.similarityScore || 0;
            const scoreB = b.similarityScore || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            // Tie-break by recency
            return (b.timestamp || "").localeCompare(a.timestamp || "");
        });
        const pruned = sorted.slice(0, MAX_CONTEXT_ITEMS);
        if (total > MAX_CONTEXT_ITEMS) {
            console.log(`🔪 Context pruned: ${total} → ${pruned.length} items (by relevance)`);
        }
        return pruned;
    }

    // ANALYTICAL mode: trim to top results, sorted by recency
    if (Array.isArray(data) && data.length > MAX_CONTEXT_ITEMS) {
        const pruned = data.slice(0, MAX_CONTEXT_ITEMS);
        console.log(`🔪 Analytical data pruned: ${total} → ${pruned.length} items`);
        return pruned;
    }
    return data;
}

// ─────────────── Context Minification ───────────────

/**
 * Strip null, undefined, empty strings, empty arrays, and verbose metadata
 * from data objects before injecting them into LLM prompts.
 * This can reduce input token count by 30-40%.
 */
function minifyRecord(record) {
    const cleaned = {};
    for (const [key, value] of Object.entries(record)) {
        // Skip nullish, empty strings, "None", "Unknown", empty arrays
        if (value === null || value === undefined) continue;
        if (value === "" || value === "None" || value === "Unknown") continue;
        if (Array.isArray(value) && value.length === 0) continue;

        // Skip internal metadata fields that the LLM doesn't need
        if (["submissionId", "url", "code", "dataJSON", "similarityScore"].includes(key)) continue;

        cleaned[key] = value;
    }
    return cleaned;
}

function minifyDataset(data) {
    if (!Array.isArray(data)) return data;
    return data.map(minifyRecord);
}

// ─────────────── Prompt Builders ───────────────

function buildAnalyticalPrompt(question, data) {
    const total = data._originalCount || data.length;
    const minified = minifyDataset(data);
    const shownCount = minified.length;
    const limitNote = total > shownCount
        ? `\n(${shownCount} of ${total} total shown)\n`
        : "";

    // Compact JSON (no indentation) saves ~40% tokens vs pretty-print
    return `You are a coding mentor.
Q: ${question}
Data:${JSON.stringify(minified)}${limitNote}
Rules: Use data above only. Summarize clearly. Highlight patterns. Give actionable advice. Use bullet points.`;
}

function buildContextualPrompt(question, context) {
    // Build compact context — only include non-empty fields
    const submissions = context.map((item, i) => {
        const parts = [`${i + 1}.`];

        if (item.problem) parts.push(`Problem:${item.problem}`);
        if (item.status) parts.push(`Status:${item.status}`);
        if (item.error && item.error !== "None") parts.push(`Error:${item.error}`);
        if (item.mistake && item.mistake !== "None") parts.push(`Mistake:${item.mistake}`);
        if (item.topics?.length) parts.push(`Topics:${item.topics.join(",")}`);
        if (item.timestamp) parts.push(`Time:${item.timestamp}`);

        // DORMANT: Include code in context when code embeddings are active
        if (INCLUDE_CODE_IN_EMBEDDINGS && item.code) {
            const truncated = item.code.length > 500
                ? item.code.substring(0, 500) + "\n// ...truncated"
                : item.code;
            parts.push(`Code:\n${truncated}`);
        }

        return parts.join(" | ");
    }).join("\n");

    return `You are an expert coding mentor analyzing a student's practice history.
Q: ${question}
Submissions (from knowledge graph, ranked by relevance):
${submissions}
Rules: Analyze patterns. Identify recurring mistakes and weak areas. Give specific, actionable advice referencing actual problems/topics. Be encouraging but honest. Use bullet points.`;
}

// ─────────────── Public API ───────────────

export async function formatResponse(question, data, mode = "ANALYTICAL") {
    if (!data || data.length === 0) {
      return "No records found.";
    }

    const prunedData = pruneData(data, mode);
    const prompt = mode === "CONTEXTUAL"
        ? buildContextualPrompt(question, prunedData)
        : buildAnalyticalPrompt(question, prunedData);
  
    try {
        const { text, provider } = await generateText(prompt, { userQuery: question });
        console.log(`  ↳ Explanation via ${provider}`);
        return text;
    } catch (err) {
        console.error("Error formatting response:", err);
        return "Failed to generate explanation from AI.";
    }
}

export async function streamResponse(question, data, res, mode = "ANALYTICAL", userId) {
    if (!data || data.length === 0) {
        res.write("No records found.");
        res.end();
        return;
    }

    const prunedData = pruneData(data, mode);
    const prompt = mode === "CONTEXTUAL"
        ? buildContextualPrompt(question, prunedData)
        : buildAnalyticalPrompt(question, prunedData);

    // Cache key based on the exact prompt
    const cacheKey = "stream:" + crypto.createHash("sha256").update(prompt).digest("hex");

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log("  ↳ Explanation served from Redis cache");
            
            // Artificially stream the cached response to recreate the typewriter effect
            const chunks = cached.match(/.{1,15}/g) || [cached];
            for (const chunk of chunks) {
                res.write(chunk);
                await new Promise(r => setTimeout(r, 20)); // ~20ms delay per chunk
            }
            
            res.end();
            return;
        }
    } catch (err) {
        console.warn("Redis cache error:", err.message);
    }

    let fullAnswer = "";

    try {
        const { stream, provider } = await streamText(prompt);
        console.log(`  ↳ Streaming explanation via ${provider}`);
        
        for await (const chunkText of stream) {
            fullAnswer += chunkText;
            res.write(chunkText);
        }
        
        try {
            await redis.set(cacheKey, fullAnswer, "EX", 3600); // Cache for 1 hour
        } catch (err) {
            console.warn("Redis set error:", err.message);
        }

        if (userId) {
            await saveChatHistory(userId, question, fullAnswer, mode, prunedData);
        }
    } catch (err) {
        console.error("Error streaming response:", err);
        res.write("\n[Error: Failed to stream AI explanation]");
    } finally {
        res.end();
    }
}