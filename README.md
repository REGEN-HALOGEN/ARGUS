<div align="center">
  <h1>🛡️ ARGUS</h1>
  <p><b>AI-powered Relationship Graph for Understanding Security Threats</b></p>
  <p>A modern, AI-native cybersecurity intelligence platform that models an organization's security posture as a living knowledge graph.</p>
</div>

---

## 📖 Overview

**ARGUS** is an advanced cybersecurity intelligence platform that integrates graph databases, vector search, and state-of-the-art AI (Google Gemini 2.0) to provide a comprehensive, real-time view of your organization's security posture. By modeling assets, CVEs, threat actors, and attack techniques as interconnected nodes, ARGUS enables proactive threat hunting, vulnerability management, and automated security analysis.

The platform is designed as a multi-tenant SaaS application with robust role-based access control, allowing multiple organizations to operate securely on a single platform instance.

---

## ✨ Key Features

### 🕸️ Living Security Knowledge Graph
Models Assets, CVEs, Threat Actors, Attack Techniques, Crown Jewels, and Users using **Neo4j**, enabling complex relationship queries, attack path analysis, and impact assessment across the entire security landscape.

### 🧠 AI-Native Analysis (Google Gemini 2.0)
- **Natural Language to Cypher** — Translates plain-English security questions into graph database queries (NL-to-Cypher) with read-only safety validation and blocklist enforcement.
- **AI Threat Briefings** — Automatically generates executive-level threat summaries by analyzing the knowledge graph for critical CVEs, active exploits, and attack paths.
- **Streaming Chat** — Real-time streamed AI responses for interactive security analysis conversations.
- **News Intelligence Summarization** — Gemini-powered analysis of cybersecurity news, extracting CVE IDs, threat actor names, and MITRE technique IDs, with graph entity matching to flag articles relevant to the organization's infrastructure.
- **Rate Limit Resilience** — Built-in retry logic with exponential backoff (capped at 30 s) for Gemini 429 rate-limit responses.

### 🗺️ Interactive 3D Organisation Map
Renders the security knowledge graph as an interactive **3D force-directed graph** using **React Three Fiber (R3F)** with **D3-force-3d** physics simulation. Features include:
- Color-coded entity spheres (Asset, CVE, Crown Jewel, Threat Actor, Attack Technique).
- Relationship-colored edge lines (HAS_VULNERABILITY, TARGETS, EXPLOITS, USES_TECHNIQUE, CONNECTED_TO, HOSTS).
- HTML-overlay tooltip panels on hover with entity metadata.
- Expand/Compress toggle for adjusting physics simulation distance.
- Full orbit controls (rotate, pan, zoom) with damping.
- Light/dark theme support.

### 📊 2D Graph Explorer (React Flow)
Full-featured 2D interactive attack graph powered by **@xyflow/react** with **dagre** auto-layout:
- **Custom Node Components** — Five distinct styled node types: Asset, CVE, Crown Jewel, Threat Actor, and Attack Technique — each with contextual metadata (OS, CVSS score, severity badge, internet-facing indicator, exploitation status, business impact, country, sophistication level, MITRE ID).
- **Intelligent CVE Deduplication** — Automatically groups multiple CVEs per asset, showing only the top-risk CVE while displaying a count badge on the asset node.
- **Styled Edge System** — Risk-aware edge styling: animated critical vulnerability links, dashed access-path lines, color-coded relationship types with inline labels.
- **Node Visibility Filters** — Toggle visibility of entity types with live node counts.
- **Layout Switching** — One-click toggle between horizontal (LR) and vertical (TB) dagre layouts.
- **Theme-Aware Rendering** — Complete dark and light mode palettes for nodes, edges, canvas, grid, and minimap.
- **MiniMap & Controls** — Embedded minimap with color-coded nodes, zoom/pan controls.

### 📰 AI-Enhanced Cybersecurity Newsfeed
Real-time top-10 daily cybersecurity news integrated into the sidebar as an "Intelligence Feed":
- Aggregated via RSS (The Hacker News and similar sources).
- Each article analyzed by Gemini to extract an AI summary, entity tags (CVEs, threat actors, MITRE IDs).
- **Target Match indicator** — Highlights articles where extracted entities match nodes already in the organization's graph.
- Auto-refreshes every 10 minutes on the client, cached for 6 hours server-side in Valkey.

### 🔍 CVE Intelligence Module
Dedicated vulnerability tracking page with:
- Paginated CVE listing sorted by CVSS score, sourced from Neo4j.
- **Debounced search** (500 ms) with text-match and full-text Lucene index support.
- **Multi-filter panel** — Filter by severity level (critical, high, medium, low) and active exploit status.
- Severity color-coded badges, CVSS scores, exploited-in-the-wild live indicators, affected asset counts.
- Direct NVD external links for each CVE.

### ⚔️ Threat Actor Intelligence
Expandable APT profile cards with:
- Country, sophistication level (advanced/intermediate/basic), motivation labels.
- ATT&CK technique count and targeted asset count per actor.
- **Expandable detail panel** — lazy-loaded on click: intelligence brief, list of targeted assets within the organization's context, exploited CVEs with CVSS badges.

### 📋 Threat Dashboard
Central command view with:
- **Stat cards** — Total Assets, Critical CVEs, Threat Actors, Risk Score (animated Framer Motion stagger).
- **Recent Alerts** — Severity-tagged alerts with source attribution and timestamps.
- **Top Attack Paths** — Ranked paths with animated risk progress bars and node counts.
- **AI Insight Banner** — Live Gemini-generated threat brief with CVE analysis count and critical asset count; links to the AI Analyst for full analysis.
- **No Active Organization** — Graceful placeholder with onboarding CTA when user has no org context.

### 🤖 AI Analyst Chat Interface
Full-featured conversational AI assistant:
- Chat interface with user/assistant message bubbles, Markdown rendering (code blocks, Cypher syntax highlighting).
- **NL-to-Cypher pipeline** — Translates questions into graph queries, executes them, and returns interpreted results.
- **Streaming fallback** — If NL-to-Cypher returns no interpretation, transparently falls back to a streaming chat response.
- **Suggested prompts** — Pre-built queries ("Show attack paths to production database", "Which CVEs are actively exploited?", etc.).
- Session reset button for new conversation threads.

### ⌨️ Command Palette (⌘K / Ctrl+K)
Global keyboard-triggered command palette with:
- Fuzzy search across all navigation commands.
- Arrow-key navigation with visual selection indicator.
- Instant page routing on selection.

### ⚙️ Settings Dashboard
Three-panel settings interface with animated sidebar navigation:
- **Appearance** — Theme toggle (Light / Dark / System) with instant application.
- **Access Control** — Displays current user's platform role, organization role, email, and name. Shows the complete RBAC role hierarchy (Super Admin → Org Admin → Operator → Analyst → Viewer) with scope badges.
- **Database Health** — Live health checks against all backend services (Neo4j, Valkey/Redis, Supabase/PostgreSQL, Google Gemini) with connection status indicators, latency measurements, URI display, and refresh capability.

### 🔐 Secure Multi-Tenant Authentication
- **Better Auth** with PostgreSQL (Supabase) for session management and RBAC.
- **Multi-tenancy** — Organization-scoped data isolation via `x-tenant-id` headers and `tenantId` graph properties.
- **Next.js middleware** for route classification (public/protected).
- **Client-side auth guards** — `AuthProvider` context with automatic `/me` endpoint hydration, role-based redirects, and organization activation sync.
- **Self-healing LocalStorage** — `apiFetch` intercepts `403 Forbidden` / `TENANT_FORBIDDEN` responses and auto-clears stale tenant IDs from localStorage, preventing error overlays.

### 🛡️ Super Admin Platform Management
Full platform administration suite restricted to `super_admin` role:
- **User Management** — View all platform users with inline organization membership badges. Per-user actions: assign to organization (with role selection), reset password (with random password generator), delete user (cascade deletion across sessions, accounts, members, invitations via `information_schema` introspection).
- **Organization Management** — View all organizations with metadata (industry, cloud providers, estimated asset count), member lists with color-coded role badges, and direct "Add Member" capability.
- **Animated Modals** — Framer Motion animated modal dialogs for all destructive or sensitive actions with confirmation flows and error handling.

### 📡 Automated Data Ingestion Pipeline
Background ingestion system with scheduler and manual trigger:
- **NVD Sync** — Fetches CVEs from the past 7 days via the National Vulnerability Database API, transforms and upserts into Neo4j.
- **CISA KEV Sync** — Fetches the Known Exploited Vulnerabilities catalog and marks matching CVEs as `exploitedInWild` in the graph.
- **MITRE ATT&CK Sync** — Fetches MITRE technique definitions and upserts `AttackTechnique` nodes with tactic classification.
- **News Sync** — Fetches top 10 cybersecurity news, runs AI summarization and entity extraction, checks entity presence against graph, caches results in Valkey.
- **Scheduler** — Runs full sync every 6 hours automatically; manual trigger available via `POST /api/v1/ingestion/sync`.

### 🎨 Premium Design System
- **Glassmorphism UI** — Frosted-glass card components with backdrop blur and subtle ring borders.
- **Glow effects** — Contextual CSS glow classes (primary, threat, accent) on stat cards and interactive elements.
- **Framer Motion animations** — Staggered mount animations, hover scale effects, slide-in transitions, layout animations for sidebar indicator.
- **Custom color system** — Semantic design tokens (primary, threat, warning, accent, success) in HSL with opacity variants.
- **Custom scrollbar** — Styled thin scrollbar matching the design system.
- **Inter font** — Google Fonts Inter for premium typography.
- **Responsive sidebar** — Collapsible sidebar with animated label transitions and keyboard shortcut badges.

---

## 🏗️ Architecture & Stack

### Stack Highlights

| Layer | Technology | Description |
|-------|------------|-------------|
| **Runtime** | [Bun](https://bun.sh/) | Fast all-in-one JS runtime |
| **Frontend** | [Next.js 15](https://nextjs.org/), React 19 | React framework with TailwindCSS v4 |
| **UI** | [shadcn/ui](https://ui.shadcn.com/), Framer Motion | Accessible, animated component system |
| **3D Visualization** | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber), [@react-three/drei](https://github.com/pmndrs/drei), [D3-force-3d](https://github.com/vasturiano/d3-force-3d) | 3D organisation map with physics simulation |
| **2D Graph** | [@xyflow/react](https://reactflow.dev/), [dagre](https://github.com/dagrejs/dagre) | Interactive 2D attack graph with auto-layout |
| **Backend** | [Hono](https://hono.dev/) | Ultrafast web framework for the Edge |
| **Graph DB** | [Neo4j 5](https://neo4j.com/) | Native graph database for security models |
| **Vector DB** | [Qdrant](https://qdrant.tech/) | Vector similarity search engine |
| **Cache** | [Valkey](https://valkey.io/) | Redis-compatible high-performance cache |
| **AI** | [Google Gemini](https://deepmind.google/technologies/gemini/) | `gemini-2.0-flash` & `flash-lite` |
| **Auth** | [Better Auth](https://better-auth.com/) | Comprehensive authentication framework |
| **Auth DB** | [Supabase](https://supabase.com/) (PostgreSQL) | Managed PostgreSQL for user/session/org data |
| **Validation** | [Zod](https://zod.dev/) | TypeScript-first schema validation |
| **Linting** | [Biome](https://biomejs.dev/) | Fast formatter and linter |

### Project Structure

ARGUS is structured as a monorepo using Bun workspaces:

```text
argus/
├── apps/
│   ├── web/                           # Next.js 15 frontend dashboard
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (dashboard)/       # Protected dashboard route group
│   │   │   │   │   ├── admin/         # Super admin platform management
│   │   │   │   │   ├── analyst/       # AI analyst chat interface
│   │   │   │   │   ├── cve/           # CVE intelligence explorer
│   │   │   │   │   ├── dashboard/     # Threat dashboard overview
│   │   │   │   │   ├── graph/         # 2D graph explorer (React Flow)
│   │   │   │   │   ├── org-map/       # 3D organisation map (R3F)
│   │   │   │   │   ├── settings/      # Platform settings & health
│   │   │   │   │   ├── threats/       # Threat actor intelligence
│   │   │   │   │   └── layout.tsx     # Dashboard shell (sidebar + header)
│   │   │   │   ├── login/             # Authentication login page
│   │   │   │   ├── register/          # User registration page
│   │   │   │   ├── onboarding/        # Multi-step onboarding flow
│   │   │   │   │   ├── admin/         # Admin onboarding
│   │   │   │   │   ├── organization/  # Organization setup
│   │   │   │   │   └── user/          # User onboarding
│   │   │   │   ├── globals.css        # Design system & tokens
│   │   │   │   └── layout.tsx         # Root layout
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar.tsx    # RBAC-aware navigation sidebar
│   │   │   │   │   ├── header.tsx     # Top header with org switcher
│   │   │   │   │   ├── news-widget.tsx# AI-enhanced news feed widget
│   │   │   │   │   └── command-palette.tsx # ⌘K command palette
│   │   │   │   ├── providers/
│   │   │   │   │   └── auth-provider.tsx  # Auth context & role routing
│   │   │   │   ├── onboarding/        # Onboarding step components
│   │   │   │   └── ui/               # Shared UI primitives
│   │   │   │       ├── spinner.tsx    # Loading spinner
│   │   │   │       ├── markdown.tsx   # Markdown renderer
│   │   │   │       ├── logo.tsx       # ARGUS logo component
│   │   │   │       ├── globe.tsx      # Animated globe (COBE)
│   │   │   │       ├── theme-toggle.tsx # Theme switcher
│   │   │   │       └── background-ripple-effect.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            # apiFetch wrapper, tenant management
│   │   │   │   ├── auth.ts           # Better Auth client
│   │   │   │   └── utils.ts          # Utility helpers
│   │   │   └── middleware.ts          # Next.js edge middleware
│   │   └── public/                    # Static assets (images, loader SVG)
│   │
│   └── api/                           # Hono backend API service
│       └── src/
│           ├── index.ts               # Server entrypoint & CORS config
│           ├── auth.ts                # Better Auth server instance
│           ├── auth-db-pool.ts        # PostgreSQL connection pool
│           ├── middleware/
│           │   ├── auth.ts            # Auth guards (requireAuth, requireTenant, requirePlatformAdmin, requireOrgRole)
│           │   └── error-handler.ts   # Global error handler
│           └── routes/v1/
│               ├── index.ts           # V1 route aggregator & middleware wiring
│               ├── admin.ts           # Platform admin (users, orgs, members)
│               ├── ai.ts             # AI endpoints (NL-to-Cypher, threat brief, chat stream)
│               ├── assets.ts          # Asset management
│               ├── auth.ts            # Auth passthrough
│               ├── cve.ts             # CVE listing, search, semantic search, detail
│               ├── dashboard.ts       # Dashboard stats, alerts, attack paths
│               ├── graph.ts           # Full graph data retrieval
│               ├── health.ts          # Service health checks (Neo4j, Valkey, Supabase, Gemini)
│               ├── ingestion.ts       # Manual ingestion trigger
│               ├── me.ts              # Current user profile & org context
│               ├── news.ts            # Cached news feed
│               ├── onboarding.ts      # Organization creation & setup
│               ├── organization.ts    # Org settings & members
│               └── threat-actors.ts   # Threat actor listing & detail
│
├── packages/
│   ├── ai/                            # Google Gemini SDK & AI clients
│   │   └── src/
│   │       ├── client.ts              # Gemini model initialization
│   │       ├── services.ts            # chat(), streamChat(), nlToCypher()
│   │       ├── prompts.ts             # System prompts & user prompt templates
│   │       └── index.ts              # Package exports
│   │
│   ├── cache/                         # Valkey/Redis cache abstraction
│   │   └── src/
│   │       ├── client.ts              # Redis client singleton
│   │       ├── cache.ts               # withCache() helper for TTL caching
│   │       └── index.ts
│   │
│   ├── config/                        # Environment validation (Zod)
│   │   └── src/                       # Zod schema for all env vars
│   │
│   ├── graph/                         # Neo4j connection & query engine
│   │   └── src/
│   │       ├── driver.ts              # Neo4j driver singleton
│   │       ├── schema.ts             # Schema initialization (constraints, indexes, full-text)
│   │       ├── queries.ts            # Reusable Cypher query functions
│   │       ├── traversal.ts          # Graph traversal utilities
│   │       └── index.ts
│   │
│   ├── ingestion/                     # External data ingestion pipeline
│   │   └── src/
│   │       ├── scheduler.ts           # Sync orchestrator & 6-hour scheduler
│   │       ├── fetchers/
│   │       │   ├── nvd.ts             # NVD API client
│   │       │   ├── cisa-kev.ts        # CISA KEV catalog fetcher
│   │       │   ├── mitre.ts           # MITRE ATT&CK technique fetcher
│   │       │   └── news.ts            # RSS cybersecurity news aggregator
│   │       ├── writers/
│   │       │   └── neo4j.ts           # Neo4j upsert writers
│   │       └── index.ts
│   │
│   ├── types/                         # Shared Zod schemas & TypeScript types
│   │   └── src/
│   │       ├── entities.ts            # Entity schemas (Asset, CVE, ThreatActor, etc.)
│   │       ├── graph.ts               # Graph data types
│   │       ├── api.ts                 # API response/pagination schemas
│   │       ├── auth.ts               # Role types & helpers
│   │       └── index.ts
│   │
│   └── ui/                            # Shared design system & tokens
│
├── docker/                            # Optional local Docker stack
│   ├── docker-compose.yml             # Neo4j, Qdrant, Valkey containers
│   └── README.md
│
├── scripts/                           # Database seeding & initialization
│   ├── seed.ts                        # Neo4j graph seed data
│   ├── seed-all.ts                    # Full seed (auth users, org, graph)
│   ├── seed-admin.ts                  # Admin user creation
│   ├── seed-threat-actors.ts          # Threat actor data seeding
│   ├── migrate-default-tenant.ts      # Tenant migration script
│   └── test-supabase.ts              # PostgreSQL connectivity test
│
├── docs/
│   ├── architecture.md                # Architecture overview
│   └── implementation/                # Implementation phase documents
│       ├── 01-external-data-ingestion.md
│       ├── 02-attack-path-simulation.md
│       ├── 03-ai-analyst-enhancements.md
│       ├── 04-risk-engine-maturity.md
│       ├── 05-ai-threat-briefings.md
│       ├── 06-advanced-security.md
│       ├── 07-devops-production-readiness.md
│       └── 08-upgrade-multi-tenancy.md
│
├── Dockerfile.api                     # Production API container
├── DEPLOYMENT.md                      # Deployment guide
├── biome.json                         # Biome linter/formatter config
├── bunfig.toml                        # Bun configuration
├── tsconfig.json                      # Root TypeScript config
└── package.json                       # Workspace root
```

---

## 🔐 Security Architecture

### Authentication & Authorization

ARGUS implements a layered security model:

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Edge Middleware                    │
│            Route classification (public / protected)         │
├──────────────────────────────────────────────────────────────┤
│                   Client-Side Auth Guard                     │
│      AuthProvider → /me endpoint → role-based redirects      │
├──────────────────────────────────────────────────────────────┤
│                   Hono API Middleware                         │
│  requireAuth() → requireTenant() → requireOrgRole()          │
│  requirePlatformAdmin() for /admin/* routes                  │
├──────────────────────────────────────────────────────────────┤
│                   Better Auth (Session)                      │
│  Cookie-based sessions, PostgreSQL-backed                    │
├──────────────────────────────────────────────────────────────┤
│                   Multi-Tenant Isolation                     │
│  x-tenant-id header + tenantId property on graph nodes       │
└──────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Super Admin** | Platform-wide | Full platform management, user CRUD, org management, all dashboard features |
| **Org Admin** | Organization | Full org access, ingestion control, all views |
| **Operator** | Organization | Read/Write access, ingestion trigger, graph/threats/CVE access |
| **Analyst** | Organization | Read + AI access, graph explorer, threat actors, CVE, AI analyst |
| **Viewer** | Organization | Read-only dashboard, org map, CVE list, AI analyst, settings |

### Sidebar Navigation Filtering

Navigation items are dynamically filtered based on the user's role:
- Dashboard, Organisation Map, AI Analyst, CVE Intelligence, Settings → Viewer+
- Graph Explorer, Threat Actors → Analyst+
- Platform Admin → Super Admin only
- News Widget → Hidden for Super Admin (admin sees platform management instead)

### API Middleware Chain

| Middleware | Applied To | Effect |
|-----------|-----------|--------|
| `requireAuth()` | `/me`, `/onboarding`, `/news`, `/health` | Validates session, sets `userId` |
| `requireTenant()` | `/graph`, `/ai`, `/cve`, `/assets`, `/dashboard`, `/threat-actors`, `/organization` | Validates org membership, sets `tenantId`, `orgRole` |
| `requirePlatformAdmin()` | `/admin/*` | Validates `super_admin` role |
| `requireOrgRole('operator', 'org_admin')` | `/ingestion/*` | Restricts ingestion trigger to operators+ |

### Self-Healing Session Management

- `apiFetch` wrapper intercepts `403 Forbidden` / `TENANT_FORBIDDEN` responses.
- Automatically calls `clearActiveTenantId()` to scrub stale org context from localStorage.
- Prevents cascading error overlays when a user's organization membership changes.

---

## 🗄️ Graph Data Model (Neo4j)

### Node Labels

| Label | Key Properties | Description |
|-------|---------------|-------------|
| `Asset` | `id`, `hostname`, `ipAddress`, `os`, `type`, `criticality`, `internetFacing`, `tenantId` | Network assets (servers, databases, endpoints) |
| `CVE` | `cveId`, `description`, `cvss`, `severity`, `exploitedInWild`, `publishedDate` | Common Vulnerabilities and Exposures |
| `ThreatActor` | `name`, `country`, `sophistication`, `motivation`, `description` | APT groups and threat actors |
| `AttackTechnique` | `mitreId`, `name`, `tactic`, `description` | MITRE ATT&CK techniques |
| `CrownJewel` | `id`, `name`, `businessImpact`, `tenantId` | Critical business assets |
| `User` | `email`, `name` | Platform users |

### Relationship Types

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| `HAS_VULNERABILITY` | `Asset → CVE` | Asset affected by vulnerability |
| `EXPLOITS` | `ThreatActor → CVE` | Actor known to exploit vulnerability |
| `TARGETS` | `ThreatActor → Asset` | Actor targets specific asset |
| `USES_TECHNIQUE` | `ThreatActor → AttackTechnique` | Actor uses ATT&CK technique |
| `CONNECTED_TO` | `Asset → Asset` | Network connectivity |
| `CAN_ACCESS` | `Asset → Asset` | Logical access path |
| `HOSTS` | `Asset → CrownJewel` | Asset hosts a crown jewel |
| `ENABLES_LATERAL_MOVEMENT` | `Asset → Asset` | Lateral movement path |
| `MEMBER_OF_ATTACK_CHAIN` | — | Attack chain membership |

### Constraints & Indexes

- **Uniqueness constraints** on `Asset.id`, `CVE.cveId`, `ThreatActor.name`, `AttackTechnique.mitreId`, `CrownJewel.id`, `User.email`.
- **Property indexes** on `Asset.type`, `Asset.tenantId`, `Asset.criticality`, `Asset.internetFacing`, `CrownJewel.tenantId`, `CVE.severity`, `CVE.exploitedInWild`, `CVE.cvss`, `ThreatActor.country`, `AttackTechnique.tactic`.
- **Full-text index** (`cve_fulltext`) on `CVE.cveId`, `CVE.description`, `CVE.severity` — Lucene-backed for semantic-like search.

---

## 🤖 AI System Design

### Models Used

| Use Case | Model | Temperature | Max Tokens |
|----------|-------|-------------|------------|
| Security Analysis (Chat) | `gemini-2.0-flash` | 0.3 | 4,096 |
| NL-to-Cypher Translation | `gemini-2.0-flash` | 0.1 | 4,096 |
| Threat Briefing Generation | `gemini-2.0-flash` | 0.3 | 4,096 |
| News Summarization | `gemini-2.0-flash` | 0.1 | 300 |

### System Prompts

| Prompt | Purpose |
|--------|---------|
| `SECURITY_ANALYST` | Core analyst persona — interprets graph data, identifies attack paths, provides remediation |
| `NL_TO_CYPHER` | Converts natural language to read-only Cypher queries with schema awareness |
| `THREAT_BRIEFING` | Generates executive-level threat intelligence briefings |
| `RISK_ASSESSMENT` | Calculates numerical risk scores (0–100) with justification |
| `NEWS_SUMMARY` | Extracts JSON `{summary, entities}` from news articles |

### Safety Controls

- **Cypher Blocklist** — Blocks `CREATE`, `DELETE`, `SET`, `MERGE`, `REMOVE`, `DETACH`, `DROP`, `CALL`, `LOAD`, `FOREACH` keywords in generated queries.
- **UNSAFE_QUERY sentinel** — Model is instructed to return this if the query is outside safe boundaries.
- **Rate-limit retry** — Automatic retry with exponential backoff on Gemini 429 responses.

---

## 📡 API Endpoints Reference

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| `*` | `/api/v1/auth/*` | Better Auth routes (login, register, session) |

### Authenticated (requireAuth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/me` | Current user profile, platform role, active org, org role |
| `GET/POST` | `/api/v1/onboarding/*` | Organization creation & setup flow |
| `GET` | `/api/v1/news` | Cached cybersecurity news feed |
| `GET` | `/api/v1/health/services` | Live health check for all backend services |

### Tenant-Scoped (requireTenant)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/graph` | Full graph data (nodes + edges) for the tenant |
| `POST` | `/api/v1/ai/nl-to-cypher` | Natural language to Cypher translation + execution |
| `POST` | `/api/v1/ai/chat/stream` | Streaming AI chat response |
| `GET` | `/api/v1/ai/threat-brief` | AI-generated threat briefing |
| `GET` | `/api/v1/cve?page=&limit=` | Paginated CVE list sorted by CVSS |
| `GET` | `/api/v1/cve/search?q=` | Text-match CVE search |
| `GET` | `/api/v1/cve/semantic-search?q=` | Full-text Lucene CVE search |
| `GET` | `/api/v1/cve/:cveId` | CVE detail with affected assets & exploiting actors |
| `GET` | `/api/v1/threat-actors` | List all threat actors |
| `GET` | `/api/v1/threat-actors/:name` | Threat actor detail with CVEs, techniques, targets |
| `GET` | `/api/v1/dashboard/stats` | Dashboard statistics |
| `GET` | `/api/v1/dashboard/alerts` | Recent security alerts |
| `GET` | `/api/v1/dashboard/attack-paths` | Top attack paths with risk scores |
| `GET` | `/api/v1/assets` | Asset listing |
| `GET/PUT` | `/api/v1/organization/*` | Organization settings |

### Operator+ (requireOrgRole)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/ingestion/sync` | Manually trigger full data ingestion |

### Platform Admin (requirePlatformAdmin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/users` | List all platform users with org memberships |
| `POST` | `/api/v1/admin/users/:id/reset-password` | Reset user password |
| `DELETE` | `/api/v1/admin/users/:id` | Cascade-delete user |
| `GET` | `/api/v1/admin/organizations` | List all organizations with metadata & members |
| `POST` | `/api/v1/admin/organizations/members` | Assign user to organization with role |

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

**Required environment variables:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler recommended) |
| `NEO4J_URI` | Neo4j bolt connection URI |
| `NEO4J_USER` / `NEO4J_PASSWORD` | Neo4j credentials |
| `VALKEY_URL` | Redis-compatible cache URL |
| `GEMINI_API_KEY` | Google Gemini API key |
| `BETTER_AUTH_SECRET` | Authentication secret key |
| `BETTER_AUTH_URL` | Auth server URL (API base) |
| `QDRANT_URL` | Qdrant vector DB URL |
| `NVD_API_KEY` | (Optional) NVD API key for higher rate limits |

### 3. Start infrastructure

Either configure **managed** Neo4j, Qdrant, and Redis (Valkey-compatible) URLs in `.env`, or start the **optional** local Docker stack:

```bash
bun run infra:docker:up
```

See `docker/README.md` for details.

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
*(This command creates `admin@argus.local` / `user@argus.local` and an organization, saving the login details to `default.txt` locally).*

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

| Command | Description |
|---------|-------------|
| `bun run dev` | Starts all applications in development mode |
| `bun run dev:web` | Starts only the Next.js frontend |
| `bun run dev:api` | Starts only the Hono API server |
| `bun run build` | Builds all applications and packages |
| `bun run build:web` | Builds only the Next.js frontend |
| `bun run build:api` | Builds only the API server |
| `bun run lint` | Runs Biome to check for linting errors |
| `bun run lint:fix` | Auto-fixes linting errors |
| `bun run format` | Formats all codebase using Biome |
| `bun run check` | Runs Biome check with auto-fix |
| `bun run typecheck` | Runs TypeScript compiler checks across the monorepo |
| `bun run infra:docker:up` | Starts optional local Docker (Neo4j, Qdrant, Valkey) |
| `bun run infra:docker:down` | Stops that Docker stack |
| `bun run infra:docker:logs` | Follows Docker service logs |
| `bun run db:init` | Initializes Neo4j schema (constraints, indexes) |
| `bun run db:seed` | Seeds Neo4j with example security data |
| `bun run db:migrate:tenant` | Runs tenant migration script |
| `bun run db:test:pg` | Tests PostgreSQL/Supabase connectivity |
| `bun run clean` | Removes all `node_modules` for a fresh installation |

---

## 🚀 Deployment (Hybrid Cloud)

For production, we recommend a hybrid deployment strategy:
- **Frontend (Web)**: Deploy `apps/web` to **Vercel** for optimal Edge performance.
- **Backend (API)**: Deploy `apps/api` to **Railway** (or Render) using the provided `Dockerfile.api`. This ensures background schedulers and long-running processes remain active.

See `DEPLOYMENT.md` for full instructions.

### Production Considerations
- **Supabase Connection Pooling** — Use Supavisor pooler URLs (`*.pooler.supabase.com:5432`) to handle serverless connection limits and IPv6/DNS issues.
- **Cross-Origin Cookie Handling** — Hybrid deployment (Vercel + Railway) requires `SameSite=None` cookies; Next.js edge middleware defers auth checks to client-side guards since it cannot access Railway session cookies.
- **Hydration Warning Suppression** — Root `<body>` tag includes suppression for dark/light mode provider hydration mismatches.

---

## 📋 Changelog

### 2026-06-10 — Comprehensive Feature Documentation Update

#### 📝 Documentation
- **Complete README rewrite** covering all current platform features, architecture, API endpoints, security model, graph data model, AI system design, and deployment configuration.

---

### 2026-05-27 — Organisation Map, Graph Explorer & Dashboard Enhancements

#### ✨ New Features
- **3D Organisation Map (`/org-map`)**: New page with interactive 3D force-directed graph visualization powered by React Three Fiber and D3-force-3d. Renders all graph entities as color-coded spheres with physics-based layout, orbit controls, expand/compress toggle, HTML tooltip overlays on hover, and entity type legend.
- **2D Graph Explorer (`/graph`)**: Full-featured React Flow-based graph explorer with five custom node types (Asset, CVE, Crown Jewel, Threat Actor, Attack Technique), dagre auto-layout (LR/TB toggle), intelligent CVE deduplication, risk-aware animated edge styling, node type visibility filters, minimap, legend, and complete light/dark theme support.
- **CVE Intelligence Page (`/cve`)**: Dedicated CVE explorer with paginated CVSS-sorted listing, debounced search, multi-filter panel (severity + exploit status), severity badges, and NVD external links.
- **Threat Actors Page (`/threats`)**: Expandable APT profile cards with country, sophistication, motivation, ATT&CK technique counts, targeted assets, and lazy-loaded detail panel (intelligence brief, targeted assets in org context, exploited CVEs).
- **AI Analyst Chat (`/analyst`)**: Conversational AI interface with NL-to-Cypher pipeline, streaming fallback, Markdown rendering, suggested prompts, session reset.
- **Settings Dashboard (`/settings`)**: Three-panel settings with Appearance (theme toggle), Access Control (RBAC display), and Database Health (live checks for Neo4j, Valkey, Supabase, Gemini with latency).
- **Command Palette (⌘K)**: Global keyboard shortcut command palette for instant navigation with fuzzy search and arrow-key selection.
- **AI-Enhanced News Widget**: Sidebar intelligence feed with Gemini-powered summaries, entity extraction, target match indicators, and 10-minute auto-refresh.
- **Dashboard AI Insight Banner**: Live Gemini threat briefing on the dashboard with CVE analysis count and critical asset display.
- **CVE Semantic Search API**: Full-text Lucene-backed CVE search endpoint (`/cve/semantic-search`).
- **Service Health API**: Live health check endpoint (`/health/services`) testing Neo4j, Valkey, Supabase, and Gemini connectivity with latency measurements.
- **Data Ingestion Pipeline**: Automated NVD, CISA KEV, MITRE ATT&CK, and news sync with 6-hour scheduler and manual API trigger.

#### 🔧 Improvements
- **CVE Caching** — All CVE list, search, and detail endpoints wrapped with `withCache()` for 5-minute TTL.
- **Tenant-scoped queries** — CVE affected asset counts filtered by `tenantId` for multi-tenant isolation.
- **AI Rate Limit Handling** — `withRetry()` helper for Gemini API calls with exponential backoff.
- **Premium Loading Screen** — Full-screen animated loader with spinning SVG, gradient glows, and cybersecurity-themed messaging during auth initialization.

---

### 2026-05-18 — Platform Administration & Self-Healing Architecture

#### ✨ New Features
- **Super Admin User Management Suite**:
  - **Secure User Deletion**: Added direct database cascade deletion logic in Hono that dynamically scans PostgreSQL table schemas (checking `information_schema.columns`) before safely purging related sessions, accounts, members, invitations, and user records. This avoids SQL errors when optional schema columns are absent.
  - **Admin Password Resets**: Super admins can now securely reset passwords for any registered user on the platform, supported by random-password generation and client-side length validation.
  - **Organization Assignments**: Super admins can now assign any registered user to any organization with custom roles (`owner`, `admin`, `member`) directly inside the Admin Panel.

#### 🔴 Stability & Self-Healing
- **Self-Healing LocalStorage Active Org Sync**: Configured `apiFetch` to intercept any `403 Forbidden` or `TENANT_FORBIDDEN` response codes and automatically trigger `clearActiveTenantId()`. Stale or invalid organization context cached in local storage is dynamically scrubbed, allowing the application to heal its session instantly without throwing unhandled red overlay screens.
- **Global News Access**: Configured `/news` API endpoint to require general authentication only (`requireAuth()`) rather than organization scoping (`requireTenant()`). This ensures platform administrators or users without active organization memberships can access general threat intel feeds without triggering active organization required failures.
- **Header Isolation for Admin Endpoints**: Automatically strip `x-tenant-id` and `x-organization-id` headers inside all platform-level `/admin` API routes before invoking Better Auth list methods, isolating platform actions from tenant-level constraints.
- **Hydration Warning Suppression**: Added hydration mismatch suppression on the root layout `<body>` tag to cleanly handle dynamic classes injected by dark/light mode providers on initial load.

---

### 2026-05-14 — Cloud Deployment Readiness

#### ✨ Improvements
- **Hybrid Cloud Deployment Support**: Created `Dockerfile.api` to enable deploying the Bun-based Hono backend to Railway/Render.
- **Supabase Connection Pooling**: Updated database connection strategy to use Supavisor pooler URLs (`aws-1-ap-southeast-2.pooler.supabase.com:5432`) to resolve IPv6/DNS issues and handle serverless connection limits.
- **Deployment Documentation**: Updated deployment guides for hosting the Next.js frontend on Vercel and the API on Railway.

---

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

---

## 📄 License

Private — All rights reserved.
