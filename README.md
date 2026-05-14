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

## 🚀 Deployment (Hybrid Cloud)

For production, we recommend a hybrid deployment strategy:
- **Frontend (Web)**: Deploy `apps/web` to **Vercel** for optimal Edge performance.
- **Backend (API)**: Deploy `apps/api` to **Railway** (or Render) using the provided `Dockerfile.api`. This ensures background schedulers and long-running processes remain active.

See `DEPLOYMENT.md` for full instructions.

---

## 📋 Changelog

### 2026-05-14 — Cloud Deployment Readiness

#### ✨ Improvements
- **Hybrid Cloud Deployment Support**: Created `Dockerfile.api` to enable deploying the Bun-based Hono backend to Railway/Render.
- **Supabase Connection Pooling**: Updated database connection strategy to use Supavisor pooler URLs (`aws-1-ap-southeast-2.pooler.supabase.com:5432`) to resolve IPv6/DNS issues and handle serverless connection limits.
- **Deployment Documentation**: Updated deployment guides for hosting the Next.js frontend on Vercel and the API on Railway.

### 2026-05-13 — Onboarding & Authentication Revamp

#### 🔴 Security Fixes
- **Added Next.js middleware** (`apps/web/src/middleware.ts`) for server-side route protection — blocks unauthenticated access to `/dashboard`, `/admin`, `/graph`, `/analyst`, etc. before pages render
- **Admin route verification** — middleware validates `super_admin` role via API call for `/admin/*` routes
- **Replaced all `router.push()` with `router.replace()`** across login, onboarding, and auth provider to prevent browser back-button navigation to protected pages after logout
- **Added `requireAuth()` middleware** to previously unprotected `/me` and `/onboarding` API routes (`apps/api/src/routes/v1/index.ts`)
- **Removed aggressive auto-redirects** from `apiFetch` — API errors no longer trigger `window.location.assign()` which caused redirect loops; errors are thrown with metadata for callers to handle

#### 🐛 Bug Fixes
- **Fixed admin login redirect loop** — login page now fetches `/me` after sign-in to determine platform role and routes `super_admin` users directly to `/admin`, bypassing `/dashboard` entirely
- **Fixed org registration display** — admin panel users endpoint (`GET /admin/users`) now enriches each user with their organization memberships (org name, slug, role)
- **Fixed organization count showing 0** — admin organizations endpoint (`GET /admin/organizations`) now queries the database directly instead of using `auth.api.listOrganizations()` which was unreliable
- **Fixed dashboard crash for users without orgs** — dashboard page now checks for active organization before making tenant-scoped API calls; shows a "No Active Organization" placeholder instead of crashing with `TENANT_REQUIRED`
- **Fixed auth provider bounce** — `/admin` paths are now excluded from the "no org → onboarding" redirect, preventing `super_admin` users from being incorrectly bounced to onboarding
- **Fixed localStorage leak on logout** — tenant ID is now cleared from `localStorage` on sign-out to prevent stale org context persisting across sessions

#### ✨ Improvements
- **Revamped admin panel UI** — users now display org membership badges inline; organizations section shows metadata (industry, cloud providers, asset count) and member cards with color-coded role badges
- **Streamlined onboarding** — removed admin login card from welcome panel (admins use regular `/login`); register page now redirects to onboarding chooser instead of directly to user signup
- **Added `clearActiveTenantId()` utility** to `apps/web/src/lib/api.ts` for proper session cleanup

#### Files Changed
| File | Change |
|------|--------|
| `apps/web/src/middleware.ts` | **New** — Server-side auth middleware |
| `apps/web/src/lib/api.ts` | Removed auto-redirects, added `clearActiveTenantId()` |
| `apps/web/src/components/providers/auth-provider.tsx` | `router.replace()`, admin path exclusion |
| `apps/web/src/app/login/page.tsx` | Role-based routing via `/me` fetch |
| `apps/web/src/app/(dashboard)/admin/page.tsx` | Org membership display, role badges |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Active org check, no-org placeholder |
| `apps/web/src/components/layout/header.tsx` | Clear tenant on logout |
| `apps/web/src/components/onboarding/welcome-panel.tsx` | Removed admin card |
| `apps/web/src/app/register/page.tsx` | Redirect to `/onboarding` chooser |
| `apps/web/src/app/onboarding/admin/page.tsx` | `router.replace()` |
| `apps/web/src/app/onboarding/organization/page.tsx` | `router.replace()` |
| `apps/api/src/routes/v1/index.ts` | Added `requireAuth()` to `/me`, `/onboarding` |
| `apps/api/src/routes/v1/admin.ts` | Enriched users/orgs with membership data |

---

## 📄 License

Private — All rights reserved.
