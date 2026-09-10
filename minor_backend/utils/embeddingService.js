import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";
dotenv.config();

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ============================================================
// 🔧 CONFIGURATION FLAG
// Set to true to include code snippets in embedding generation.
// This enriches vector search with code-level patterns but
// consumes more tokens. Currently DORMANT — flip to true when ready.
// ============================================================
export const INCLUDE_CODE_IN_EMBEDDINGS = false;

// codestral-embed: Mistral's code-optimized embedding model.
// Outputs 1024-dimensional vectors — ideal for code + error text.
const EMBEDDING_MODEL = "codestral-embed";
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Composes a rich text string from submission data for embedding.
 * When INCLUDE_CODE_IN_EMBEDDINGS is true, the user's code is appended.
 */
export function buildSubmissionText(data) {
    const parts = [
        `Problem: ${data.problem || "Unknown"}`,
        `Status: ${data.status || "Unknown"}`,
        `Error: ${data.error || "None"}`,
        `Mistake: ${data.mistake || "None"}`,
        `Topics: ${(data.topics || []).join(", ")}`,
    ];

    // DORMANT: Code embedding support — activate by setting flag to true
    if (INCLUDE_CODE_IN_EMBEDDINGS && data.code) {
        // Truncate code to ~1500 chars to stay within token limits
        const truncatedCode = data.code.length > 1500
            ? data.code.substring(0, 1500) + "\n// ... truncated"
            : data.code;
        parts.push(`Code:\n${truncatedCode}`);
    }

    return parts.join(" | ");
}

/**
 * Generate a vector embedding for the given text using Mistral codestral-embed.
 * Returns an array of length EMBEDDING_DIMENSIONS (1024).
 */
export async function generateEmbedding(text) {
    try {
        const result = await mistral.embeddings.create({
            model: EMBEDDING_MODEL,
            inputs: [text],
        });
        return result.data[0].embedding;
    } catch (err) {
        console.error("Error generating embedding:", err);
        throw new Error("Failed to generate embedding.");
    }
}

/**
 * Convenience: generate embedding directly from submission data.
 */
export async function embedSubmission(data) {
    const text = buildSubmissionText(data);
    return generateEmbedding(text);
}
