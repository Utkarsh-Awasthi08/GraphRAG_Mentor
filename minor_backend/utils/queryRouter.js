import { generateText } from "../service/aiGateway.js";

/**
 * Classify a user query into ANALYTICAL or CONTEXTUAL.
 * 
 * ANALYTICAL: Statistical, counting, filtering, time-based comparisons.
 *   e.g. "How many TLE errors this week?", "Count my wrong answers in arrays"
 * 
 * CONTEXTUAL: Reasoning about code patterns, advice, "why" questions, improvements.
 *   e.g. "Why do I keep failing Trees?", "What bad habits do I have?"
 */
export async function classifyQuery(userQuery) {
    const prompt = `
You are a query classifier for a coding practice tracker.

Classify the following user query into EXACTLY one category:

ANALYTICAL - The query asks for counts, statistics, comparisons, rankings, time-based filtering, or aggregated numbers.
Examples: "How many errors this week?", "Count my TLE errors", "What is my failure rate?", "Which topic has most wrong answers?", "Show my submissions for Trees"

CONTEXTUAL - The query asks for reasoning, explanations, code-level insights, improvement advice, pattern analysis, or "why" questions.
Examples: "Why do I keep failing Trees?", "What mistakes am I repeating?", "Am I improving?", "What bad coding habits do I have?", "Give me advice on my weak areas", "What patterns should I learn?"

User Query: "${userQuery}"

Reply with ONLY the single word: ANALYTICAL or CONTEXTUAL
`;

    try {
        const { text, provider } = await generateText(prompt, { cache: true, cacheTTL: 300 });
        console.log(`  ↳ Classification via ${provider}`);
        const classification = text.trim().toUpperCase();

        // Validate — default to ANALYTICAL if unclear
        if (classification.includes("CONTEXTUAL")) {
            return { type: "CONTEXTUAL" };
        }
        return { type: "ANALYTICAL" };

    } catch (err) {
        console.error("Error classifying query:", err);
        // Default to ANALYTICAL on failure (safe fallback)
        return { type: "ANALYTICAL" };
    }
}
