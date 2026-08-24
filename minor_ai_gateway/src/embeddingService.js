import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// 🔧 CONFIGURATION FLAG
// Set to true to include code snippets in embedding generation.
// This enriches vector search with code-level patterns but
// consumes more tokens. Currently DORMANT — flip to true when ready.
// ============================================================
const INCLUDE_CODE_IN_EMBEDDINGS = false;

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

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
 * Generate a vector embedding for the given text using Gemini.
 * Returns a Float32Array of length EMBEDDING_DIMENSIONS.
 */
export async function generateEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
        const result = await model.embedContent({
            content: { role: "user", parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
        });
        return result.embedding.values;
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

export { INCLUDE_CODE_IN_EMBEDDINGS, EMBEDDING_DIMENSIONS };
