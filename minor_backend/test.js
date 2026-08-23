import driver from "./neo4.js";
import { generateCypher } from "./utils/llmService.js";
import { executeReadQuery } from "./service/queryExecutor.js";
import { formatRecords } from "./service/resultFormatter.js";
import { formatResponse } from "./utils/formatter.js";

async function runTest() {
  const userQuery = "How many compile errors did I get?";
  const userId = "Awasthi";

  console.log("Query:", userQuery);

  try {
    const cypher = await generateCypher(userQuery, userId);
    console.log("Generated Cypher:", cypher);

    const rawRecords = await executeReadQuery(cypher, { userId });
    const result = formatRecords(rawRecords);
    console.log("Raw Result:", JSON.stringify(result, null, 2));

    const answer = await formatResponse(userQuery, result);
    console.log("AI Answer:", answer);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTest();
// testConnection removed to prevent premature driver close