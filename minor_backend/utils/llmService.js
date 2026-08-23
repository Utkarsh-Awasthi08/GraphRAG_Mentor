import { generateText } from "../service/aiGateway.js";
import { getCache, setCache, hashKey } from "../service/cacheService.js";

export async function generateCypher(userQuery, userId) {
    const prompt = `
You are a Neo4j Cypher expert. Given the following database schema for a coding tracker:

Node Labels and Properties:
- (:User {id: string})
- (:Submission {status: string, timestamp: string, code: string}) // status holds high-level result like "Accepted", "Wrong Answer", "Compile Error", "Time Limit Exceeded"
- (:Problem {name: string, url: string})
- (:Topic {name: string})
- (:Error {type: string}) // type holds the detailed error message or stack trace (e.g., "Line 18: error...", "java.lang.NullPointerException")
- (:Mistake {type: string}) // type holds AI-generated advice/explanation

Relationships:
- (u:User)-[:MADE]->(s:Submission)
- (s:Submission)-[:FOR]->(p:Problem)
- (p:Problem)-[:BELONGS_TO]->(t:Topic)
- (s:Submission)-[:HAS_ERROR]->(e:Error)
- (s:Submission)-[:HAS_MISTAKE]->(m:Mistake)

Rules:
1. Write a read-only Cypher query to answer the user's question.
2. YOU MUST strictly scope the query to the specific user by starting with: MATCH (u:User {id: $userId})
3. Only output valid Cypher code. Do NOT wrap it in markdown code blocks like \`\`\`cypher, just the raw query string.
4. Do NOT use the word 'null' or comments. Just the cypher.
5. Topics are capitalized words (e.g. "TREE", "GRAPH", "ARRAY", "DYNAMIC_PROGRAMMING"). Use 'toUpper' or 'toLower' for case-insensitive matching.
6. **CRITICAL**: When the user asks about specific errors (like "Compile Error", "Wrong Answer", "Time Limit Exceeded", "Runtime Error"), you MUST check \`s.status\`, NOT \`e.type\`. 
   Example: \`WHERE toLower(s.status) = "compile error"\`
7. Use \`e.type\` only if searching for specific stack traces (e.g. "NullPointerException").
8. **IMPORTANT**: Always add LIMIT 25 to your queries to prevent returning too many results.
9. For aggregate queries (COUNT, SUM, AVG, etc.), LIMIT is not required.

User Question: "${userQuery}"
`;

    // Check cache for identical Cypher generation requests
    const cacheKey = hashKey("cypher", prompt);
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log("⚡ Cache HIT — returning cached Cypher query");
        return cached;
    }

    try {
        const { text, provider } = await generateText(prompt, { cache: false }); // We handle caching ourselves here
        console.log(`  ↳ Cypher generated via ${provider}`);
        let cypher = text.trim();
        
        // Strip markdown if the model hallucinates them
        if (cypher.startsWith("\`\`\`cypher")) {
            cypher = cypher.replace(/^\`\`\`cypher/, "").replace(/\`\`\`$/, "").trim();
        } else if (cypher.startsWith("\`\`\`")) {
            cypher = cypher.replace(/^\`\`\`/, "").replace(/\`\`\`$/, "").trim();
        }

        // Cache the Cypher query for 10 minutes
        await setCache(cacheKey, cypher);
        
        return cypher;
    } catch (err) {
        console.error("Error generating Cypher:", err);
        throw new Error("Failed to generate Cypher query.");
    }
}