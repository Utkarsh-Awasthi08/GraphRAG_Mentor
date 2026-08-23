/**
 * One-time migration script to:
 * 1. Create the Neo4j vector index on Submission.embedding
 * 2. Generate embeddings for all existing Submissions that don't have one yet
 * 
 * Usage: node scripts/migrateEmbeddings.js
 */
import driver from "../neo4.js";
import { buildSubmissionText, generateEmbedding, EMBEDDING_DIMENSIONS } from "../utils/embeddingService.js";

async function createVectorIndex() {
    const session = driver.session();
    try {
        console.log("Creating vector index...");
        await session.run(`
            CREATE VECTOR INDEX submission_embedding IF NOT EXISTS
            FOR (s:Submission) ON (s.embedding)
            OPTIONS {indexConfig: {
                \`vector.dimensions\`: ${EMBEDDING_DIMENSIONS},
                \`vector.similarity_function\`: 'cosine'
            }}
        `);
        console.log("✅ Vector index created (or already exists).");
    } catch (err) {
        // Index might already exist — that's fine
        if (err.message.includes("already exists") || err.message.includes("EquivalentSchemaRuleAlreadyExists")) {
            console.log("✅ Vector index already exists.");
        } else {
            console.error("Error creating index:", err);
            throw err;
        }
    } finally {
        await session.close();
    }
}

async function migrateExistingSubmissions() {
    const session = driver.session();

    try {
        // Find all submissions that don't have embeddings yet
        const result = await session.run(`
            MATCH (u:User)-[:MADE]->(s:Submission)-[:FOR]->(p:Problem)
            WHERE s.embedding IS NULL
            OPTIONAL MATCH (p)-[:BELONGS_TO]->(t:Topic)
            OPTIONAL MATCH (s)-[:HAS_ERROR]->(e:Error)
            OPTIONAL MATCH (s)-[:HAS_MISTAKE]->(m:Mistake)
            RETURN 
                elementId(s) AS id,
                s.status AS status,
                s.code AS code,
                p.name AS problem,
                e.type AS error,
                m.type AS mistake,
                collect(DISTINCT t.name) AS topics
        `);

        const submissions = result.records.map(r => ({
            id: r.get("id"),
            status: r.get("status"),
            code: r.get("code"),
            problem: r.get("problem"),
            error: r.get("error"),
            mistake: r.get("mistake"),
            topics: r.get("topics"),
        }));

        console.log(`Found ${submissions.length} submissions without embeddings.`);

        if (submissions.length === 0) {
            console.log("Nothing to migrate.");
            return;
        }

        let success = 0;
        let failed = 0;

        for (const sub of submissions) {
            try {
                const text = buildSubmissionText(sub);
                const embedding = await generateEmbedding(text);

                await session.run(
                    `MATCH (s:Submission) WHERE elementId(s) = $id SET s.embedding = $embedding`,
                    { id: sub.id, embedding }
                );

                success++;
                console.log(`  [${success}/${submissions.length}] ✅ ${sub.problem || "Unknown"}`);
            } catch (err) {
                failed++;
                console.error(`  [FAIL] ${sub.problem || "Unknown"}:`, err.message);
            }
        }

        console.log(`\nMigration complete: ${success} succeeded, ${failed} failed.`);

    } finally {
        await session.close();
    }
}

async function main() {
    console.log("=== Embedding Migration Script ===\n");

    await createVectorIndex();
    console.log("");
    await migrateExistingSubmissions();

    console.log("\nDone. Closing driver...");
    await driver.close();
}

main().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
