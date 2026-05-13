<div align="center">
  <h1>🛡️ ARGUS</h1>
  <p><b>AI-powered Relationship Graph for Understanding Security Threats</b></p>
  <p>A modern, AI-native cybersecurity intelligence platform that models an organization's security posture as a living knowledge graph.</p>
</div>

---

## 📖 Overview

**ARGUS** is an advanced cybersecurity intelligence platform that integrates graph databases, vector search, and state-of-the-art AI (Google Gemini 2.0) to provide a comprehensive, real-time view of your organization's security posture. By modeling assets, CVEs, threat actors, and attack techniques as interconnected nodes, ARGUS enables proactive threat hunting, vulnerability management, and automated security analysis.

## ✨ Key Features

- **🕸️ Living Security Graph:** Models Assets, CVEs, Threat Actors, Attack Techniques, Crown Jewels, and Users using **Neo4j**, enabling complex relationship queries and impact analysis.
- **🧠 AI-Native Analysis:** Powered by **Google Gemini 2.0**, ARGUS interprets complex graph data, translates natural language into Graph Cypher queries, and generates human-readable security insights.
- **🔍 Vector Search:** Integrates **Qdrant** for semantic search across security logs, vulnerability descriptions, and threat intelligence feeds.
- **⚡ High-Performance Architecture:** Built with **Bun**, **Next.js 15**, and **Hono** for a lightning-fast, reactive, and scalable full-stack experience.
- **🔒 Secure Authentication:** Uses **Better Auth** with **PostgreSQL** (e.g. Supabase), providing robust session management and access control.

---

## 🏗️ Architecture & Stack

### Stack Highlights

| Layer | Technology | Description |
|-------|------------|-------------|
| **Runtime** | [Bun](https://bun.sh/) | Fast all-in-one JS runtime |
| **Frontend** | [Next.js 15](https://nextjs.org/), React 19 | React framework with TailwindCSS v4 |
| **UI** | [shadcn/ui](https://ui.shadcn.com/), Framer Motion | Accessible, animated component system |
| **Backend** | [Hono](https://hono.dev/) | Ultrafast web framework for the Edge |
| **Graph DB** | [Neo4j 5](https://neo4j.com/) | Native graph database for security models |
| **Vector DB** | [Qdrant](https://qdrant.tech/) | Vector similarity search engine |
| **Cache** | [Valkey](https://valkey.io/) | Redis-compatible high-performance cache |
| **AI** | [Google Gemini](https://deepmind.google/technologies/gemini/) | `gemini-2.0-flash` & `flash-lite` |
| **Auth** | [Better Auth](https://better-auth.com/) | Comprehensive authentication framework |
| **Validation**| [Zod](https://zod.dev/) | TypeScript-first schema validation |
| **Linting** | [Biome](https://biomejs.dev/) | Fast formatter and linter |

### Project Structure

ARGUS is structured as a monorepo using Bun workspaces:

```text
argus/
├── apps/
│   ├── web/          # Next.js 15 frontend dashboard
│   └── api/          # Hono backend API service
├── packages/
│   ├── ai/           # Google Gemini SDK & AI clients
│   ├── config/       # Environment validation (Zod)
│   ├── graph/        # Neo4j connection & query engine
│   ├── types/        # Shared Zod schemas & TypeScript types
│   └── ui/           # Shared design system & tokens
├── docker/           # Optional local Docker stack (see docker/README.md)
└── scripts/          # Database seeding & initialization
```

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed on your machine:
- **[Bun](https://bun.sh)** (v1.3+)
- **[Node.js](https://nodejs.org)** 20+ (required for Next.js compatibility)

You also need a **PostgreSQL** database (recommended: [Supabase](https://supabase.com)) and reachable **Neo4j**, **Qdrant**, and **Redis-compatible cache** endpoints — either managed cloud URLs in `.env` or optional local **Docker** (see `docker/README.md`).

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd argus
bun install
```

### 2. Environment Configuration

Copy the example environment variables and update them (especially `DATABASE_URL`, `GEMINI_API_KEY`, and service URLs for Neo4j / Qdrant / cache):

```bash
cp .env.example .env
```

### 3. Start infrastructure

Either configure **managed** Neo4j, Qdrant, and Redis (Valkey-compatible) URLs in `.env`, or start the **optional** local Docker stack:

```bash
bun run infra:docker:up
```

See `docker/README.md` and `implementation2.md` for details.

### 4. Initialize & Seed Database

Initialize the Neo4j schema and populate it with example security data:

```bash
bun run db:init
bun run db:seed
```

Seed the Authentication database (PostgreSQL/Supabase) with default administrative and user accounts:

```bash
bun run scripts/seed-all.ts
```
*(This commands creates `admin@argus.local` / `user@argus.local` and an organization, saving the login details to `default.txt` locally).*

### 5. Start Development Servers

Run the entire stack concurrently:

```bash
bun run dev
```

Alternatively, you can run services individually:
- **Web (Next.js):** `bun run dev:web` (Runs on `http://localhost:3000`)
- **API (Hono):** `bun run dev:api` (Runs on `http://localhost:4000`)

---

## 📜 Available Scripts

From the root directory, you can run the following commands:

- `bun run dev` - Starts all applications in development mode.
- `bun run build` - Builds all applications and packages.
- `bun run lint` - Runs Biome to check for linting errors.
- `bun run format` - Formats all codebase using Biome.
- `bun run typecheck` - Runs TypeScript compiler checks across the monorepo.
- `bun run infra:docker:up` - Starts optional local Docker (Neo4j, Qdrant, Valkey).
- `bun run infra:docker:down` - Stops that Docker stack.
- `bun run infra:docker:logs` - Follows Docker service logs.
- `bun run clean` - Removes all `node_modules` for a fresh installation.

---

## 📄 License

Private — All rights reserved.
