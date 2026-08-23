import driver from "../neo4.js";
import { embedSubmission } from "../utils/embeddingService.js";
import { indexChat } from "./typesenseService.js";

/**
 * Initialize Neo4j Indexes and Constraints to dramatically speed up query execution.
 * (O(1) lookups instead of O(N) full node scans).
 */
export async function initDatabaseConstraints() {
  const session = driver.session();
  try {
    const queries = [
      "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
      "CREATE INDEX IF NOT EXISTS FOR (s:Submission) ON (s.timestamp)",
      "CREATE INDEX IF NOT EXISTS FOR (p:Problem) ON (p.name)",
      "CREATE INDEX IF NOT EXISTS FOR (t:Topic) ON (t.name)"
    ];
    
    for (const q of queries) {
      await session.run(q);
    }
    console.log("⚡ Neo4j Database Constraints & Indexes verified!");
  } catch (err) {
    console.error("Warning: Failed to initialize Neo4j constraints:", err.message);
  } finally {
    await session.close();
  }
}


export async function saveSubmission(data) {
  const session = driver.session();

  try {
    // Step 1: Save the core graph structure
    const query = `
  MERGE (u:User {id: $userId})
  MERGE (p:Problem {name: $problem})
  SET p.url = $url

  CREATE (e:Error {
    type:$error
 })

  CREATE (s:Submission {
    code: $code,
    status: $status,
    timestamp: $timestamp
  })

  MERGE (u)-[:MADE]->(s)
  MERGE (s)-[:FOR]->(p)
  MERGE (s)-[:HAS_ERROR]->(e)

  WITH s, p, $mistake AS mistake

  // 👇 Only create Mistake if NOT null
  FOREACH (_ IN CASE WHEN mistake IS NOT NULL THEN [1] ELSE [] END |
    CREATE (m:Mistake {
      type: mistake
   })
    MERGE (s)-[:HAS_MISTAKE]->(m)
  )

  WITH s, p
  UNWIND $topics AS topic
  MERGE (t:Topic {name: toUpper(topic)})
  MERGE (p)-[:BELONGS_TO]->(t)

  RETURN elementId(s) AS submissionId
`;

    const result = await session.run(query, data);
    const submissionId = result.records[0].get("submissionId");

    console.log("Saved to Neo4j ✅ (id:", submissionId, ")");

    // Step 2: Generate embedding and store it on the Submission node
    try {
      const embedding = await embedSubmission(data);

      await session.run(
        `MATCH (s:Submission) WHERE elementId(s) = $id SET s.embedding = $embedding`,
        { id: submissionId, embedding }
      );

      console.log("Embedding stored ✅");
    } catch (embErr) {
      // Non-fatal: submission is saved even if embedding fails
      console.error("Warning: Failed to store embedding:", embErr.message);
    }

  } catch (err) {
    console.error("Error saving:", err);
    throw err;
  } finally {
    await session.close();
  }
}

export async function saveChatHistory(userId, queryText, answer, mode, data) {
  const session = driver.session();
  try {
    const dataJSON = JSON.stringify(data);
    const timestamp = new Date().toISOString();

    const query = `
      MERGE (u:User {id: $userId})
      CREATE (c:ChatHistory {
        id: randomUUID(),
        query: $queryText,
        answer: $answer,
        mode: $mode,
        timestamp: $timestamp,
        dataJSON: $dataJSON
      })
      MERGE (u)-[:ASKED]->(c)
      WITH c
      // If we have submissionIds in the data, link them
      UNWIND $submissionIds AS subId
      MATCH (s:Submission) WHERE elementId(s) = subId
      MERGE (c)-[:REFERENCED]->(s)
    `;
    
    const submissionIds = (data || []).map(d => d.submissionId).filter(Boolean);

    await session.run(query, {
      userId, queryText, answer, mode, timestamp, dataJSON, submissionIds
    });
    console.log("Chat history saved to Neo4j ✅");

    // Sync to Typesense
    await indexChat({
      id: Math.random().toString(36).substring(7), // or use the UUID from neo4j, but simplified here
      userId,
      query: queryText,
      mode,
      timestamp
    });

  } catch (err) {
    console.error("Error saving chat history:", err);
  } finally {
    await session.close();
  }
}

export async function getChatHistory(userId) {
  const session = driver.session();
  try {
    const query = `
      MATCH (u:User {id: $userId})-[:ASKED]->(c:ChatHistory)
      RETURN c
      ORDER BY c.timestamp DESC
    `;
    const result = await session.run(query, { userId });
    return result.records.map(r => {
      const node = r.get("c").properties;
      return {
        id: node.id,
        query: node.query,
        answer: node.answer,
        mode: node.mode,
        timestamp: node.timestamp,
        data: node.dataJSON ? JSON.parse(node.dataJSON) : null
      };
    });
  } catch (err) {
    console.error("Error getting chat history:", err);
    return [];
  } finally {
    await session.close();
  }
}
