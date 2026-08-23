import driver from "../neo4.js";
import { generateEmbedding, buildSubmissionText, EMBEDDING_DIMENSIONS } from "../utils/embeddingService.js";

/**
 * Perform vector similarity search over the user's submissions.
 * Returns the top-K most semantically similar submissions.
 */
export async function vectorSearch(queryEmbedding, userId, topK = 5) {
    const session = driver.session();

    try {
        // Use Neo4j's native vector similarity search, scoped to this user
        const result = await session.run(`
            CALL db.index.vector.queryNodes('submission_embedding', $topK, $queryEmbedding)
            YIELD node AS s, score
            MATCH (u:User {id: $userId})-[:MADE]->(s)
            RETURN elementId(s) AS id, s.status AS status, s.timestamp AS timestamp, 
                   s.code AS code, score
            ORDER BY score DESC
            LIMIT $topK
        `, { queryEmbedding, userId, topK: neo4jInt(topK) });

        return result.records.map(r => ({
            id: r.get("id"),
            status: r.get("status"),
            timestamp: r.get("timestamp"),
            code: r.get("code"),
            score: r.get("score"),
        }));

    } finally {
        await session.close();
    }
}

/**
 * Given a list of Submission elementIds, expand 1-2 hops to collect
 * the full context: Problem, Topics, Errors, Mistakes.
 */
export async function expandSubgraph(submissionIds) {
    const session = driver.session();

    try {
        const result = await session.run(`
            UNWIND $ids AS sid
            MATCH (s:Submission) WHERE elementId(s) = sid
            OPTIONAL MATCH (s)-[:FOR]->(p:Problem)
            OPTIONAL MATCH (p)-[:BELONGS_TO]->(t:Topic)
            OPTIONAL MATCH (s)-[:HAS_ERROR]->(e:Error)
            OPTIONAL MATCH (s)-[:HAS_MISTAKE]->(m:Mistake)
            RETURN 
                elementId(s) AS submissionId,
                s.status AS status,
                s.timestamp AS timestamp,
                s.code AS code,
                p.name AS problem,
                p.url AS url,
                collect(DISTINCT t.name) AS topics,
                e.type AS error,
                m.type AS mistake
        `, { ids: submissionIds });

        return result.records.map(r => ({
            submissionId: r.get("submissionId"),
            problem: r.get("problem"),
            url: r.get("url"),
            status: r.get("status"),
            timestamp: r.get("timestamp"),
            code: r.get("code"),
            topics: r.get("topics"),
            error: r.get("error"),
            mistake: r.get("mistake"),
        }));

    } finally {
        await session.close();
    }
}

/**
 * Full GraphRAG retrieval pipeline:
 * 1. Embed the user's query
 * 2. Vector search for similar submissions
 * 3. Expand subgraph for full context
 */
export async function retrieveContext(userQuery, userId, topK = 5) {
    // Step 1: Embed the query
    const queryEmbedding = await generateEmbedding(userQuery);

    // Step 2: Vector similarity search
    const matches = await vectorSearch(queryEmbedding, userId, topK);

    if (matches.length === 0) {
        return { matches: [], context: [] };
    }

    // Step 3: Expand subgraph for matched submissions
    const submissionIds = matches.map(m => m.id);
    const context = await expandSubgraph(submissionIds);

    // Attach similarity scores to context
    const scoreMap = new Map(matches.map(m => [m.id, m.score]));
    context.forEach(c => {
        c.similarityScore = scoreMap.get(c.submissionId) || 0;
    });

    return { matches, context };
}

// Helper to convert JS int to Neo4j Integer
import neo4j from "neo4j-driver";
function neo4jInt(value) {
    return neo4j.int(value);
}
