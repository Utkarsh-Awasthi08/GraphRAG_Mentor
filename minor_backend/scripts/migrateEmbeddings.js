/**
 * Migration Script: Gemini 768-dim → Mistral codestral-embed 1024-dim
 *
 * Run with: node scripts/migrateEmbeddings.js
 *
 * What this does:
 *  1. Drops the old 768-dim vector index (submission_embedding)
 *  2. Creates a new 1024-dim vector index
 *  3. Re-embeds every Submission node using codestral-embed
 *  4. Saves the new embedding back onto the node
 */

import driver from "../neo4.js";
import { buildSubmissionText, generateEmbedding } from "../utils/embeddingService.js";
import dotenv from "dotenv";
dotenv.config();

const BATCH_SIZE = 10; // Process N submissions at a time to avoid rate limits

async function migrate() {
    const session = driver.session();
    console.log("🚀 Starting embedding migration: Gemini 768d → Mistral 1024d");

    try {
        // Step 1: Drop the old vector index
        console.log("\n📌 Step 1: Dropping old 768-dim vector index...");
        try {
            await session.run("DROP INDEX submission_embedding IF EXISTS");
            console.log("  ✅ Old index dropped.");
        } catch (err) {
            console.log("  ⚠️  Index did not exist, skipping drop.");
        }

        // Step 2: Create new 1024-dim vector index
        console.log("\n📌 Step 2: Creating new 1024-dim vector index...");
        await session.run(`
            CREATE VECTOR INDEX submission_embedding IF NOT EXISTS 
            FOR (s:Submission) ON (s.embedding) 
            OPTIONS {indexConfig: {\`vector.dimensions\`: 1024, \`vector.similarity_function\`: 'cosine'}}
        `);
        console.log("  ✅ New 1024-dim index created.");

        // Step 3: Fetch all submissions that have their old data available
        console.log("\n📌 Step 3: Fetching all submissions from Neo4j...");
        const result = await session.run(`
            MATCH (u:User)-[:MADE]->(s:Submission)
            OPTIONAL MATCH (s)-[:FOR]->(p:Problem)
            OPTIONAL MATCH (s)-[:HAS_ERROR]->(e:Error)
            OPTIONAL MATCH (s)-[:HAS_MISTAKE]->(m:Mistake)
            OPTIONAL MATCH (p)-[:BELONGS_TO]->(t:Topic)
            RETURN 
                elementId(s) AS id,
                s.status     AS status,
                s.code       AS code,
                p.name       AS problem,
                e.type       AS error,
                m.type       AS mistake,
                collect(DISTINCT t.name) AS topics
        `);

        const submissions = result.records.map(r => ({
            id:      r.get("id"),
            problem: r.get("problem") || "Unknown",
            status:  r.get("status")  || "Unknown",
            error:   r.get("error")   || "None",
            mistake: r.get("mistake") || "None",
            topics:  r.get("topics")  || [],
            code:    r.get("code")    || "",
        }));

        console.log(`  Found ${submissions.length} submissions to re-embed.\n`);

        // Step 4: Re-embed in batches
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
            const batch = submissions.slice(i, i + BATCH_SIZE);
            console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(submissions.length / BATCH_SIZE)}...`);

            for (const sub of batch) {
                try {
                    const text      = buildSubmissionText(sub);
                    const embedding = await generateEmbedding(text);

                    await session.run(
                        `MATCH (s:Submission) WHERE elementId(s) = $id SET s.embedding = $embedding`,
                        { id: sub.id, embedding }
                    );

                    successCount++;
                } catch (err) {
                    failCount++;
                    console.error(`  ❌ Failed to re-embed ${sub.id}: ${err.message}`);
                }
            }

            // Small delay between batches to respect API rate limits
            if (i + BATCH_SIZE < submissions.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   Succeeded: ${successCount}`);
        console.log(`   Failed:    ${failCount}`);
        console.log(`\n🎯 Vector index is now 1024-dim (codestral-embed). Ready for queries!`);

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await session.close();
        await driver.close();
    }
}

migrate();
