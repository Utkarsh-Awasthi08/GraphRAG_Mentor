# 📐 System Architecture & Data Flowcharts

This document outlines the complete end-to-end architecture of the **GraphRAG Mentor** system, covering both the **Data Ingestion Pipeline** and the **AI Query & GraphRAG Pipeline**.

---

## Table of Contents
1. [Flow 1: Data Ingestion Pipeline (Extension ➔ Neo4j & Embeddings)](#-flow-1-data-ingestion-pipeline-extension--neo4j--embeddings)
   - [Mermaid Diagram](#11-mermaid-diagram)
   - [Boxed ASCII Diagram](#12-boxed-ascii-diagram)
2. [Flow 2: AI Mentor Query, Routing & GraphRAG Flow](#-flow-2-ai-mentor-query-routing--graphrag-flow)
   - [Mermaid Diagram](#21-mermaid-diagram)
   - [Boxed ASCII Diagram](#22-boxed-ascii-diagram)

---

# 📦 Flow 1: Data Ingestion Pipeline (Extension ➔ Neo4j & Embeddings)

### 1.1 Mermaid Diagram

```mermaid
flowchart TD
    subgraph Browser ["🌐 Chrome Extension"]
        A["User submits code on LeetCode"] --> B["content.js triggers on submission completion"]
        B --> C["Extract Metadata:
        • Problem Name & URL
        • User ID
        • Monaco Editor Code
        • Topics / Tags
        • Status (Accepted, TLE, Wrong Answer, etc.)
        • Error String / Test Case"]
        C --> D["background.js sends POST /save-submission"]
    end

    subgraph Backend_Ingest ["⚙️ Express Backend"]
        D --> E["Receive Payload & Validate"]
        E --> F["mistakeClassifier.js:
        Map error & status to human-readable mistake pattern"]
        
        subgraph Neo4j_Graph ["📦 Neo4j Graph Construction"]
            F --> G["Execute Cypher Query:
            • MERGE (u:User {id})
            • MERGE (p:Problem {name})
            • CREATE (s:Submission {code, status, timestamp})
            • CREATE (e:Error {type})
            • CREATE (m:Mistake {type})
            • MERGE (t:Topic {name})
            • Establish Graph Relationships:
              (u)-[:MADE]->(s)
              (s)-[:FOR]->(p)
              (s)-[:HAS_ERROR]->(e)
              (s)-[:HAS_MISTAKE]->(m)
              (p)-[:BELONGS_TO]->(t)"]
        end

        subgraph Vectorization ["🧠 Vector Storage"]
            G --> H["embeddingService.js:
            Build text representation & generate 768-dim Gemini vector"]
            H --> I["SET s.embedding = $vector on Submission node"]
        end
    end

    I --> J(["✅ Submission Stored in Knowledge Graph & Ready for RAG"])
```

### 1.2 Boxed ASCII Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 🌐 CHROME EXTENSION (LeetCode)              │
│                                                             │
│  • User submits code on LeetCode                            │
│  • content.js extracts:                                     │
│     - Problem Name & URL                                    │
│     - Monaco Editor Code                                    │
│     - Submission Status (Accepted, TLE, Wrong Answer, etc.) │
│     - Error string / Test case input                        │
│     - Problem Topic Tags                                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  chrome.runtime.sendMessage()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 📡 EXTENSION BACKGROUND SCRIPT              │
│                                                             │
│  • Sends HTTP POST /save-submission to Backend              │
│  • Payload: { userId, problem, code, status, error, topics }│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  HTTP POST (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               ⚙️ EXPRESS BACKEND (server.js)                │
│                                                             │
│  • utils/mistakeClassifier.js:                              │
│     - Maps error & status to human-readable mistake reason  │
│     - Handles TLE ("Not optimized approach")                │
│     - Handles Accepted ("Solution is correct...")           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  Cypher Execution (driver.session)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                🗄️ NEO4J KNOWLEDGE GRAPH ENGINE              │
│                                                             │
│  • MERGE (u:User {id})                                      │
│  • MERGE (p:Problem {name})                                 │
│  • CREATE (s:Submission {code, status, timestamp})          │
│  • CREATE (e:Error {type})                                  │
│  • CREATE (m:Mistake {type})                                │
│  • MERGE (t:Topic {name})                                   │
│  • Connect Relationships:                                   │
│     (u)-[:MADE]->(s)-[:FOR]->(p)-[:BELONGS_TO]->(t)         │
│     (s)-[:HAS_ERROR]->(e), (s)-[:HAS_MISTAKE]->(m)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  Returns submissionId
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              🧠 GEMINI EMBEDDING PIPELINE                   │
│                                                             │
│  • utils/embeddingService.js:                               │
│     - Composes text representation of submission            │
│     - Calls gemini-embedding-001 (768 dimensions)           │
│  • Stores vector directly on node:                          │
│     MATCH (s) SET s.embedding = $vector                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│       ✅ STORED & INDEXED (Ready for GraphRAG Search)       │
└─────────────────────────────────────────────────────────────┘
```

---

# 🧠 Flow 2: AI Mentor Query, Routing & GraphRAG Flow

### 2.1 Mermaid Diagram

```mermaid
flowchart TD
    subgraph Frontend ["💻 React Frontend"]
        Q["User asks question in AI Mentor chat"] --> R["Send POST /query with Bearer JWT Token"]
    end

    subgraph Backend_Gateway ["🛡️ Backend Entry & Cache Layer"]
        R --> S["JWT Authentication & Rate Limiter (Sliding Window)"]
        S --> T{"1. Exact Hash Cache Check (Redis SHA-256)"}
        T -- "Exact Hit" --> CACHE_HIT["Return Cached Response Instantly (~2ms)"]
        T -- "Miss" --> U{"2. Semantic Cache Check (Cosine Sim > 0.92)"}
        U -- "Semantic Hit" --> CACHE_HIT
        U -- "Miss" --> V["Query Router: classifyQuery(prompt)"]
    end

    subgraph Router ["🔀 Query Router (LLM Classification)"]
        V --> W{"Classify Query Type"}
        W -- "Summary / Aggregation / Counts" --> PATH_ANALYTICAL["📊 ANALYTICAL MODE"]
        W -- "Pattern Detection / Specific Problem / Errors" --> PATH_CONTEXTUAL["🔍 CONTEXTUAL MODE"]
    end

    subgraph Analytical_Pipeline ["📊 Analytical Path (Text-to-Cypher)"]
        PATH_ANALYTICAL --> A1["llmService.js: Generate Cypher from Schema"]
        A1 --> A2["queryExecutor.js: Enforce LIMIT 25 & Execute Read Transaction"]
        A2 --> A3["Query Neo4j Graph directly"]
        A3 --> A4["resultFormatter.js: Format Neo4j records into clean JSON"]
    end

    subgraph Contextual_Pipeline ["🔍 Contextual Path (GraphRAG)"]
        PATH_CONTEXTUAL --> C1["embeddingService.js: Generate Vector for User Prompt"]
        C1 --> C2["Neo4j Vector Search:
        CALL db.index.vector.queryNodes('submission_embedding', topK, $embedding)"]
        C2 --> C3["expandSubgraph():
        1-2 Hop Traversal to fetch Problem, Topic, Error, Mistake"]
        C3 --> C4["Rank & Sort matches by Similarity Score"]
    end

    subgraph Synthesis ["🗜️ Context Minification & Prompt Building"]
        A4 --> M1["pruneData() & minifyRecord():
        Strip nulls, empty arrays, internal metadata"]
        C4 --> M1
        M1 --> M2["Build Compact Prompt (Rules + Minified Data)"]
    end

    subgraph LLM_Gateway ["🚀 Multi-Provider AI Gateway"]
        M2 --> G1{"Attempt Primary: Gemini Flash"}
        G1 -- "Success / Stream" --> STREAM["Stream Response Chunks to Client"]
        G1 -- "429 Rate Limit / Error" --> G2{"Fallback 1: Groq LPU (Qwen)"}
        G2 -- "Success / Stream" --> STREAM
        G2 -- "Fail" --> G3{"Fallback 2: OpenRouter"}
        G3 -- "Success / Stream" --> STREAM
    end

    subgraph Storage_Sync ["💾 Persistence & Sync"]
        STREAM --> SYNC1["Save Chat to Neo4j (:ChatHistory)"]
        STREAM --> SYNC2["Index Question & Answer into Typesense"]
        STREAM --> SYNC3["Set Exact & Semantic Redis Cache (TTL: 10m / 30m)"]
    end

    STREAM --> OUT(["🖥️ Live Markdown Stream Rendered on Frontend"])
```

### 2.2 Boxed ASCII Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    💻 REACT FRONTEND CHAT                   │
│                                                             │
│  • User enters prompt: "Why am I failing Tree questions?"   │
│  • Sends POST /query with Bearer JWT Token                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  HTTP POST (Bearer Token)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              🛡️ AUTH & TWO-TIER REDIS CACHING               │
│                                                             │
│  • Verify JWT Token + Apply User Rate Limiter               │
│                                                             │
│  [Tier 1: Exact Cache]                                      │
│   └─ SHA-256 Hash of prompt found in Redis?                 │
│        ├─► (YES) ──► Return response instantly (<2ms) ──────┼──┐
│        └─► (NO)                                             │  │
│  [Tier 2: Semantic Vector Cache]                            │  │
│   └─ Embed question ➔ Cosine Similarity > 0.92?             │  │
│        ├─► (YES) ──► Return cached response (~10ms) ────────┼──┤
│        └─► (NO)                                             │  │
└──────────────────────────────┬──────────────────────────────┘  │
                               │ (Cache Miss)                    │
                               ▼                                 │
┌─────────────────────────────────────────────────────────────┐  │
│             🔀 QUERY ROUTER (AI Classification)             │  │
│                                                             │  │
│  • Classifies query intent into one of two pipelines:       │  │
└──────────────┬──────────────────────────────┬───────────────┘  │
               │                              │                  │
      [ANALYTICAL MODE]              [CONTEXTUAL MODE]           │
      (Counts, Trends, History)      (Why did I fail? Patterns)  │
               │                              │                  │
               ▼                              ▼                  │
┌─────────────────────────────┐┌─────────────────────────────┐   │
│   📊 TEXT-TO-CYPHER PATH    ││     🔍 GRAPHRAG PATH        │   │
│                             ││                             │   │
│ 1. llmService.js:           ││ 1. Embed user query using   │   │
│    Generate Cypher from DB  ││    Gemini Embeddings        │   │
│    Schema + Prompt Rules    ││                             │   │
│ 2. queryExecutor.js:        ││ 2. Neo4j Native Vector      │   │
│    Auto-appends LIMIT 25    ││    Search (Top-K matches)   │   │
│    Runs Read Transaction    ││                             │   │
│ 3. resultFormatter.js:      ││ 3. expandSubgraph():        │   │
│    Converts Neo4j records   ││    1-2 hop graph expansion  │   │
│    to clean JSON            ││    (Problem, Error, Topic)  │   │
└──────────────┬──────────────┘└──────────────┬──────────────┘   │
               │                              │                  │
               └──────────────┬───────────────┘                  │
                              │ Raw Context                      │
                              ▼                                  │
┌─────────────────────────────────────────────────────────────┐  │
│          🗜️ CONTEXT PRUNING & DATA MINIFICATION             │  │
│                                                             │  │
│  • Strips nulls, empty arrays, redundant internal IDs       │  │
│  • Compacts JSON / Shortens prompt rules (Saves ~65% tokens)│  │
└──────────────────────────────┬──────────────────────────────┘  │
                               │ Minified Prompt                 │
                               ▼                                 │
┌─────────────────────────────────────────────────────────────┐  │
│            🚀 MULTI-PROVIDER AI GATEWAY ENGINE              │  │
│                                                             │  │
│   ┌─────────────────────────────────────────────────────┐   │  │
│   │ 1. Primary: Google Gemini Flash (15 RPM Quota)      │   │  │
│   └──────────────────────────┬──────────────────────────┘   │  │
│       Rate Limit (429) / Fail│                              │  │
│                              ▼                              │  │
│   ┌─────────────────────────────────────────────────────┐   │  │
│   │ 2. Fallback 1: Groq LPU - Qwen (30 RPM Ultra-Fast)  │   │  │
│   └──────────────────────────┬──────────────────────────┘   │  │
│       Rate Limit (429) / Fail│                              │  │
│                              ▼                              │  │
│   ┌─────────────────────────────────────────────────────┐   │  │
│   │ 3. Fallback 2: OpenRouter - Gemma 3 (Free Tier)     │   │  │
│   └─────────────────────────────────────────────────────┘   │  │
└──────────────────────────────┬──────────────────────────────┘  │
                               │ Streamed Text Chunks            │
                               ▼                                 │
┌─────────────────────────────────────────────────────────────┐  │
│               💾 PERSISTENCE & CACHE UPDATE                 │  │
│                                                             │  │
│  • Save message pair to Neo4j (:ChatHistory)                │  │
│  • Index question into Typesense for instant fuzzy search   │  │
│  • Store answer in Redis (Exact: 10m TTL, Semantic: 30m TTL)│  │
└──────────────────────────────┬──────────────────────────────┘  │
                               │                                 │
                               ▼                                 ▼
┌────────────────────────────────────────────────────────────────┐
│      🖥️ RESPONSE STREAMED LIVE TO REACT FRONTEND (Markdown)    │
└────────────────────────────────────────────────────────────────┘
```
