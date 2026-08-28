[🇺🇸 Read in English](README.md) | [AR إقرأ باللغة العربية](README_AR.md)

<div align="center">
  <!-- مسار لوجو المشروع -->
  <img src="frontend/public/globe.svg" alt="DevVault AI Logo" width="120" />

  # 🧠 DevVault AI

  **The ultimate AI-powered Knowledge Repository, Intelligent Memory, and Productivity Hub for Engineering Teams.**

  [![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
</div>

---

## 🚀 Overview

**DevVault AI** is a highly advanced, centralized intelligence platform designed specifically for software developers and engineering teams. It transcends traditional snippet managers by deeply analyzing your entire source code project to build an interconnected **Knowledge Graph**. 

It acts as an intelligent "second brain" that tracks your codebase evolution, remembers your debugging lessons, understands your team's architectural blueprints, and learns your unique stylistic profile (Developer DNA). By integrating deeply with Large Language Models (OpenAI / Google Gemini), DevVault AI provides context-aware code generation, deeply informed technical explanations, and advanced project-wide search capabilities.

---

## ✨ Core Features & Domain Model

DevVault AI introduces a sophisticated domain-driven architecture to categorize and understand developer assets:

*   🌐 **Knowledge Graph (Codebase Indexing):** Upload or link an entire project (Codebase). The backend parses files (Source Assets) and maps functional modules (Logical Entities), establishing a graph of relationships (e.g., imports, inheritances) that the AI traverses to understand the full context of your project.
*   🤖 **AI Context Builder & Chat:** A highly context-aware AI assistant. When you ask a question, the `AI Context Builder` selectively injects code chunks, developer memory, and knowledge graph relationships into the prompt. Includes a dedicated `Context Trace` debugging endpoint to see exactly *why* the AI made its decisions.
*   🧬 **Stylistic Profile (Developer DNA):** The system continuously learns your coding style, naming conventions, and architectural preferences, ensuring that any AI-generated code perfectly aligns with your personal or team standards.
*   🛠️ **Debugging Lessons (Error Solutions):** Stop fixing the same bug twice. Track errors, root causes, and solution diffs. The AI uses this historical memory to instantly suggest solutions when it detects similar patterns in the future.
*   📦 **Code Assets & Architecture Blueprints:** Store reusable snippets, boilerplate templates, and complex infrastructure setups (Docker, CI/CD, etc.) that can be queried and integrated by the AI instantly.
*   ⏱️ **Time Machine & Auditing:** Track the chronological evolution of your workspace, view historical audit events, and rollback or replay codebase states.
*   👥 **Workspaces & Real-time Collaboration:** Designed for enterprise teams. Create isolated Workspaces, assign Role-Based Access Control (RBAC), and collaborate in real-time via `Socket.IO`.
*   💳 **Enterprise Billing:** Built-in Stripe integration enforcing Pro and Team license limits (team members, AI limits, storage boundaries).

---

## 🏗️ Architecture & Tech Stack

DevVault AI is built on a modern, decoupled client-server architecture capable of handling heavy code parsing workloads asynchronously.

### Frontend (Client Application)
*   **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) & React 19.
*   **Language:** TypeScript (Strict Mode).
*   **Styling & Animation:** Tailwind CSS v4 and Framer Motion.
*   **Specialized UI:** 
    *   `@monaco-editor/react`: VSCode-like in-browser code editing.
    *   `reactflow`: Interactive node-based visualization of the Knowledge Graph.
*   **Realtime:** `socket.io-client` for live notifications and collaborative editing.

### Backend (API Server & Workers)
*   **Framework:** Node.js with Express & TypeScript.
*   **Database (Persistent):** MongoDB via Mongoose (Schema validation & relationships).
*   **Database (Cache & PubSub):** Redis (Session caching, Rate limiting, WebSockets PubSub).
*   **Background Jobs:** `BullMQ` for asynchronous processing of heavy tasks (ZIP extraction, Codebase AST Parsing, Embedding Generation).
*   **AI Integration:** `@google/generative-ai` & `openai` SDKs for embeddings, chat, and contextual reasoning.
*   **Security & Identity:** JWT-based stateless auth, OAuth callbacks (GitHub/Google), and standard Express security middlewares (Helmet, CORS, Rate Limiter).

---

## 📂 Directory Structure

```text
DevVault/
├── backend/                  # Node.js API Service & Background Workers
│   ├── src/                  
│   │   ├── controllers/      # Route handlers (Auth, Projects, AI, Search, etc.)
│   │   ├── models/           # Mongoose Data Models (Project, Snippet, CodeEntity...)
│   │   ├── routes/           # Express Router definitions
│   │   ├── services/         # Core business logic (AI Context, Parsers, Queue processors)
│   │   ├── utils/            # Domain Mappers, Billing helpers, Access Control
│   │   └── middleware/       # JWT Auth, Validation, Limits enforcement
├── frontend/                 # Next.js Web Application
│   ├── src/
│   │   ├── app/              # Next.js App Router Pages (Chat, Dashboard, DNA, etc.)
│   │   ├── components/       # Reusable React UI Components (Sidebar, CodeEditor...)
│   │   └── context/          # React Context Providers (Auth, CommandPalette, Language...)
├── docs/                     # Architectural documentation (Domain Models, Runbooks)
├── scripts/                  # Utility and database migration scripts
└── docker-compose.yml        # Local development infrastructure (Mongo + Redis)
```

---

## 🚀 Getting Started (Runbook)

### Prerequisites
*   Node.js (v20+)
*   Docker & Docker Compose (for local database services)
*   *Optional (for full experience):* OpenAI / Gemini API Keys, Stripe Keys, OAuth Credentials.

### 1. Start Infrastructure Services
Boot up the MongoDB and Redis containers:
```bash
docker compose up -d mongo redis
```

### 2. Environment Configuration
Duplicate the `.env.example` files in both directories:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```
*(Note: DevVault AI can run in "Local Simulation" mode for billing and offline fallback for AI if external keys are not provided).*

### 3. Start the Backend API
```bash
cd backend
npm install
npm run dev
```
*(Runs on `http://localhost:5001`. Verify via `curl http://localhost:5001/health`)*

### 4. Start the Frontend App
Open a new terminal tab:
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:3000`)*

---

## 🛡️ License & Copyright
This software is proprietary. All rights reserved. Do not distribute or copy without explicit permission.
