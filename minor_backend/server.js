import express from "express";
import compression from "compression";
import { saveSubmission, getChatHistory, initDatabaseConstraints } from "./service/graphService.js";
import cors from "cors";
import { generateMistake } from "./utils/mistakeClassifier.js";
import { executeReadQuery } from "./service/queryExecutor.js";
import { formatRecords } from "./service/resultFormatter.js";
import { formatResponse, streamResponse } from "./utils/formatter.js";
import { generateCypher } from "./utils/llmService.js";
import { initTypesense, searchChats } from "./service/typesenseService.js";
import { classifyQuery } from "./utils/queryRouter.js";
import { retrieveContext } from "./service/graphRAGService.js";
import authRoutes from "./routes/authRoutes.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { authLimiter, geminiLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

// Initialize external services
(async () => {
  await initDatabaseConstraints();
  await initTypesense();
})();

app.use("/auth", authLimiter, authRoutes);

app.post("/submission", apiLimiter, authenticate, async (req, res) => {
  try {
    const data = req.body;
    data.userId = req.user.username; // Force user ID from the secure JWT token
    console.log("Received submission for:", data.userId, data.problem);
    const mistake = generateMistake({
        status: data.status,
        error: data.error
    });

    data.mistake = mistake;
    data.topics = data.topics && data.topics.length > 0
      ? data.topics
      : ["General"];
    console.log(data);
    await saveSubmission(data);
    res.json({msg : "Saved successfully 🚀"});
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving data");
  }
});

app.post("/query", authenticate, geminiLimiter, async (req, res) => {
  try {
    const userQuery = req.body.query;
    const userId = req.user.username; // Extract from JWT

    // 🧠 Step 1: Classify the query
    const classification = await classifyQuery(userQuery);
    console.log("Query Classification:", classification.type);

    if (classification.type === "ANALYTICAL") {
      // ────────────── TEXT-TO-CYPHER PIPELINE ──────────────
      const cypher = await generateCypher(userQuery, userId);
      console.log("Generated Cypher:", cypher);

      const params = { userId };
      const rawRecords = await executeReadQuery(cypher, params);
      const result = formatRecords(rawRecords);

      res.json({
        mode: "ANALYTICAL",
        query: cypher,
        result
      });

    } else {
      // ────────────── GRAPHRAG PIPELINE ──────────────
      const { context } = await retrieveContext(userQuery, userId, 5);
      console.log(`GraphRAG retrieved ${context.length} submissions`);

      res.json({
        mode: "CONTEXTUAL",
        result: context
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing query");
  }
});

app.post("/query/explain", authenticate, geminiLimiter, async (req, res) => {
  try {
    const userQuery = req.body.query;
    const resultData = req.body.data;
    const mode = req.body.mode || "ANALYTICAL";
    const userId = req.user.username; // Extract from JWT

    // Set headers for streaming response
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    // Stream AI Explanation (mode-aware)
    await streamResponse(userQuery, resultData, res, mode, userId);

  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).send("Error processing explanation");
    } else {
      res.end();
    }
  }
});

app.get("/chat/history", authenticate, apiLimiter, async (req, res) => {
  try {
    const userId = req.user.username;
    const history = await getChatHistory(userId);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching chat history");
  }
});

app.get("/chat/search", authenticate, apiLimiter, async (req, res) => {
  try {
    const userId = req.user.username;
    const { q, page, perPage } = req.query;
    if (!userId || !q) return res.json({ hits: [] });
    const results = await searchChats(userId, q, parseInt(page) || 1, parseInt(perPage) || 10);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error searching history");
  }
});

// ─── AI Gateway Status (for monitoring) ───
import { getGatewayStatus } from "./service/aiGateway.js";

app.get("/gateway/status", authenticate, (req, res) => {
  res.json(getGatewayStatus());
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});