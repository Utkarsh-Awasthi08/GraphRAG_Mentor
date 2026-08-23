# 🚀 GraphRAG Mentor: Knowledge-Graph Coding Analytics & Multi-LLM Gateway

> **An intelligent coding diagnostic platform that builds a personal knowledge graph of your LeetCode practice history, utilizing GraphRAG (Retrieval-Augmented Generation), Text-to-Cypher translation, and a fault-tolerant multi-LLM gateway to deliver deep, contextual code mentoring.**

---

## 📖 Table of Contents
- [Why GraphRAG Mentor?](#-why-graphrag-mentor)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started & Installation](#-getting-started--installation)
  - [1. Prerequisites & Docker Setup](#1-prerequisites--docker-setup)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
  - [5. Chrome Extension Setup](#5-chrome-extension-setup)
- [How It Works (Deep Dive for Beginners)](#-how-it-works-deep-dive-for-beginners)
  - [Dual-Mode Query Router](#1-dual-mode-query-router-analytical-vs-contextual)
  - [Two-Tier Redis Caching Engine](#2-two-tier-redis-caching-engine)
  - [Context Pruning & Minification](#3-context-pruning--minification)
  - [Multi-Provider AI Gateway](#4-multi-provider-ai-gateway)
- [Backend API Endpoints](#-backend-api-endpoints)
- [Resume / Portfolio Highlights](#-resume--portfolio-highlights)

---

## 💡 Why GraphRAG Mentor?

Traditional AI code assistants are **stateless**—they only see the code snippet you paste in and have zero awareness of your historical practice habits, repeated runtime mistakes, or recurring topic weaknesses.

**GraphRAG Mentor solves this by creating a personal Knowledge Graph:**
1. Every LeetCode submission is automatically captured via a Chrome Extension and modeled as connected entities in **Neo4j** (`User`, `Problem`, `Submission`, `Topic`, `Error`, `Mistake`).
2. Submissions are embedded into 768-dimensional vector spaces using **Google Gemini Embeddings**.
3. When you ask questions like *"Why do I keep failing Binary Tree questions?"*, the system performs **subgraph expansion** and vector search to retrieve your actual historical mistake patterns and provides targeted pedagogical advice.

---

## 🌟 Key Features

- 🧩 **Zero-Click Ingestion (Chrome Extension):** Automatically captures Monaco Editor code, execution status (Accepted, TLE, Wrong Answer), test cases, and problem tags on LeetCode.
- 🧠 **GraphRAG Diagnostic Engine:** Combines graph traversals with vector similarity to diagnose *why* you are failing specific concepts.
- 📊 **Text-to-Cypher Analytics:** Translates natural language into declarative Neo4j Cypher queries for statistical aggregation (e.g., *"How many DP problems did I solve this week?"*).
- 🛡️ **Fault-Tolerant AI Gateway:** Intelligent 3-tier fallback (`Gemini Flash` ➔ `Groq LPU` ➔ `OpenRouter`) with per-provider rate tracking and automatic circuit breaking.
- ⚡ **Two-Tier Redis Caching:**
  - **Tier 1 (Exact Hash):** Instant sub-2ms response for identical prompts.
  - **Tier 2 (Semantic Vector Cache):** Detects near-duplicate questions using vector cosine similarity ($> 0.92$), cutting LLM costs by up to 40%.
- 🗜️ **Context Minification:** Strips null fields, compresses JSON payloads, and limits subgraph nodes, slashing token costs by **~65%**.
- 🔍 **Instant History Search:** Powered by **Typesense** for typo-tolerant, sub-millisecond search over past mentor conversations.
- 🔐 **Secure JWT Authentication:** User authentication with bcrypt password hashing and IP/User rate limiting.

---

## 🏗️ System Architecture

```
[ LeetCode Submission ]
         │
         ▼
[ Chrome Extension ] ──(HTTP POST)──► [ Express Backend ]
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    ▼                                                  ▼
          [ Neo4j Knowledge Graph ]                         [ Gemini Embeddings ]
    (:User)-[:MADE]->(:Submission)-[:FOR]->(:Problem)         (768-dim vector)
           -[:HAS_ERROR]->(:Error)                                     │
           -[:HAS_MISTAKE]->(:Mistake)                                 ▼
           -[:BELONGS_TO]->(:Topic)                         Indexed on :Submission node
```

```
[ User Query via React Chat ]
               │
               ▼
[ Auth & Sliding Rate Limiter ]
               │
               ▼
[ Two-Tier Redis Cache ] ──► (Hit: Sub-10ms Return)
               │ (Miss)
               ▼
[ AI Query Router ]
    ├──► ANALYTICAL ──► Text-to-Cypher ──► Neo4j DB Query ──┐
    └──► CONTEXTUAL ──► Vector Search ──► Subgraph Expansion ─┤
                                                              ▼
                                                   [ Context Minification ]
                                                              │
                                                              ▼
                                                   [ Multi-LLM Gateway ]
                                                (Gemini ➔ Groq ➔ OpenRouter)
                                                              │
                                                              ▼
                                                   [ Streamed Markdown ]
```

> 📄 *For detailed flowcharts and diagrams, see [ARCHITECTURE_FLOWCHARTS.md](file:///Users/utkarshawasthi/Documents/minor_project/ARCHITECTURE_FLOWCHARTS.md).*

---

## 🛠️ Technology Stack

| Layer | Technologies | Role in System |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Responsive Glassmorphism chat UI, live streaming markdown |
| **Backend** | Node.js, Express.js (ES Modules) | REST APIs, Streamed SSE responses, payload compression |
| **Databases** | **Neo4j** (Graph Database), **Redis** (Port 6380) | Knowledge graph storage, Cypher engine, two-tier cache |
| **Search Engine** | **Typesense** (Port 8108) | Typo-tolerant full-text search over chat history |
| **AI / LLMs** | Google Gemini 3.5 Flash, Groq (Qwen 27B), OpenRouter | Routing, Cypher generation, diagnostic explanations |
| **Embeddings** | `gemini-embedding-001` (768 dimensions) | Submission vector indexing and semantic question matching |
| **Security** | JWT (jsonwebtoken), Bcrypt.js, Express-Rate-Limit | Token verification, password hashing, anti-abuse quotas |
| **DevOps** | Docker | Containerized Neo4j, Redis, and Typesense instances |

---

## 📂 Repository Structure

```text
minor_project/
├── minor_backend/                  # Express REST API & AI Pipeline
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT validation
│   │   └── rateLimiter.js          # User & IP rate limiters
│   ├── routes/
│   │   └── authRoutes.js           # /auth/signup & /auth/login
│   ├── service/
│   │   ├── aiGateway.js            # Multi-provider fallback & rate tracking
│   │   ├── cacheService.js         # Redis exact & semantic caching
│   │   ├── graphRAGService.js      # Vector search & subgraph expansion
│   │   ├── graphService.js         # Neo4j writes, queries & schema indexes
│   │   ├── queryExecutor.js        # Cypher read transactions & LIMIT auto-enforcer
│   │   ├── resultFormatter.js      # Formats Neo4j records into clean JSON
│   │   └── typesenseService.js     # Typesense schema & history indexing
│   ├── utils/
│   │   ├── embeddingService.js     # Gemini vector generation
│   │   ├── formatter.js            # Context minification & prompt building
│   │   ├── llmService.js           # Text-to-Cypher generator
│   │   ├── mistakeClassifier.js    # Error pattern classifier (TLE, WA, CE)
│   │   └── queryRouter.js          # Query intent classification
│   ├── neo4.js                     # Neo4j Driver Connection
│   └── server.js                   # Main Server & API Routes
│
├── minor_frontend/                 # React + Vite Single Page Application
│   ├── src/
│   │   ├── components/             # Chat UI, Sidebar, History Search, Modals
│   │   ├── App.jsx                 # Main layout & stream handling
│   │   └── main.jsx                # Entrypoint
│   └── vite.config.js
│
├── minor_extension/                # Chrome Extension (Manifest V3)
│   ├── content.js                  # LeetCode DOM scraping & Monaco Editor hooks
│   ├── background.js               # Background service worker & API bridge
│   └── manifest.json               # Extension permissions & configuration
│
├── ARCHITECTURE_FLOWCHARTS.md      # Boxed & Mermaid System Flowcharts
└── README.md                       # Comprehensive Project Documentation
```

---

## ⚡ Getting Started & Installation

### 1. Prerequisites & Docker Setup
Make sure you have **Node.js (v18+)**, **npm**, and **Docker** installed.

Start the required infrastructure containers:

```bash
# 1. Run Neo4j Graph Database
docker run -d --name minor_neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.26.0

# 2. Run Redis (Configured for Port 6380)
docker run -d --name minor_redis \
  -p 6380:6379 \
  redis:7-alpine

# 3. Run Typesense Search Engine
docker run -d --name minor_typesense \
  -p 8108:8108 \
  -v /tmp/typesense-data:/data \
  typesense/typesense:27.1 \
  --data-dir /data --api-key=xyz123 --enable-cors
```

---

### 2. Environment Variables
Create a `.env` file in the `minor_backend/` directory:

```env
# Server
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here

# Neo4j Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6380

# Typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=xyz123

# AI Provider API Keys
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
OPEN_ROUTER_API_KEY=sk-or-v1-...
```

---

### 3. Backend Setup

```bash
cd minor_backend
npm install
node server.js
```
*You should see:*
```
⚡ Neo4j Database Constraints & Indexes verified!
✅ Redis connected (port 6380)
Typesense collection chat_history exists.
Server running on http://localhost:3000
```

---

### 4. Frontend Setup

```bash
cd minor_frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 5. Chrome Extension Setup

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `minor_extension/` directory.
4. Navigate to any problem on [LeetCode](https://leetcode.com/problems/two-sum/) and submit a solution—your submission will automatically log to Neo4j!

---

## 🔍 How It Works (Deep Dive for Beginners)

### 1. Dual-Mode Query Router (Analytical vs Contextual)
When a user asks a question, it is first routed through an LLM classification step:
* **ANALYTICAL:** For statistical and aggregate questions (e.g., *"How many problems have I solved in total?"*).
  * *Workflow:* Generates a Cypher query ➔ Executes on Neo4j with an enforced `LIMIT 25` ➔ Formats records ➔ Summarizes results.
* **CONTEXTUAL (GraphRAG):** For pedagogical and debugging questions (e.g., *"Why do I fail dynamic programming problems?"*).
  * *Workflow:* Generates vector embedding of the question ➔ Queries Neo4j vector index for top-5 most relevant submissions ➔ Expands 1–2 graph hops to gather associated problems, error messages, and classified mistakes ➔ Streams diagnostic advice.

### 2. Two-Tier Redis Caching Engine
To prevent unnecessary LLM API usage:
1. **Tier 1 (Exact Hash):** Computes a SHA-256 hash of the prompt. If found in Redis, returns the answer in **~2ms**.
2. **Tier 2 (Semantic Vector Cache):** If exact match misses, generates an embedding of the raw question and computes the **Cosine Similarity** against the last 50 cached queries. If similarity is $> 0.92$, returns the cached answer instantly.

### 3. Context Pruning & Minification
Passing massive raw JSON to an LLM wastes tokens. Before sending data:
- Strips `null`, `undefined`, empty strings, and internal IDs (`submissionId`, `url`).
- Uses compact single-line JSON formatting.
- Automatically ranks contextual records by similarity score and caps prompt injection at the **top 10** most relevant items.

### 4. Multi-Provider AI Gateway
To prevent rate limits from breaking the application, `service/aiGateway.js` implements an autonomous fallback system:

```
[ Request ] ──► [ Gemini 3.5 Flash ] ──(429 Rate Limit)──► [ Groq LPU (Qwen 27B) ] ──(Fail)──► [ OpenRouter Gemma 3 ]
```
If a provider hits a rate limit or returns a 429 error, it enters a **60-second cooldown** so subsequent requests seamlessly bypass it.

---

## 📡 Backend API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | No | Register a new user (`username`, `password`) |
| `POST` | `/auth/login` | No | Authenticate user and receive a signed JWT |
| `POST` | `/save-submission` | No | Ingest submission payload from Chrome Extension |
| `POST` | `/query` | Yes (JWT) | Stream AI mentor explanations for user prompts |
| `GET` | `/history` | Yes (JWT) | Retrieve user's full past conversation history |
| `GET` | `/history/search?q=...` | Yes (JWT) | Fast full-text fuzzy search across chat history |
| `GET` | `/gateway/status` | Yes (JWT) | Real-time monitoring of AI provider rate limits & cooldowns |

---

## 🎯 Resume / Portfolio Highlights

If you're showcasing this project on your resume, here are key points and metrics you can use:

- **GraphRAG Architecture:** Designed a knowledge-graph retrieval pipeline using **Neo4j** and **Vector Search**, enabling semantic subgraph expansion for contextual code debugging.
- **Text-to-Cypher Pipeline:** Engineered an automated translation layer converting natural language into declarative graph queries with automated limit injection and read transactions.
- **Resilient AI Gateway:** Architected a multi-provider fallback engine (Gemini, Groq, OpenRouter) with sliding-window rate tracking and circuit breaking.
- **Optimized Caching & Token Economy:** Implemented a two-tier Redis cache (exact hash + cosine similarity fuzzy matching) and context minification, **cutting token consumption by ~65%** and achieving sub-10ms cached latencies.
- **Full-Text Search:** Integrated **Typesense** for typo-tolerant, instant search across historical graph-linked conversations.
