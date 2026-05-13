# Implementation guide: Supabase Postgres auth + optional Docker (implementation2)

This document is the executable checklist for the migration summarized in `migrationplan.md`. It matches what the codebase now implements.

## Prerequisites

- A **Supabase** project (or any PostgreSQL 14+ instance).
- In Supabase: **Project Settings → Database** → copy the Postgres URI (prefer the **direct** connection for a long-lived Bun API, or **session pooler** if you tune pool size).
- Optional managed services (no local Docker): **Neo4j Aura**, **Qdrant Cloud**, **Upstash Redis** — set the same env vars as in `.env.example`.

## Step 1 — Environment variables

1. Copy `.env.example` to `.env`.
2. Set **`DATABASE_URL`** to your Supabase Postgres connection string (include `?sslmode=require` if the host requires SSL).
3. Set **`BETTER_AUTH_URL`** to your API’s public auth base, e.g. `http://localhost:4000` (the API normalizes this to `/api/v1/auth`).
4. Set **`WEB_URL`** to the Next.js origin (used for CORS and Better Auth `trustedOrigins`).
5. Set **`NEO4J_URI`**, **`QDRANT_URL`**, **`QDRANT_API_KEY`** (if using Qdrant Cloud), **`VALKEY_URL`** (or a `rediss://` Upstash URL here).

`@argus/config` loads the nearest `.env` by walking up from `process.cwd()` on the first `getEnv()` call.

## Step 2 — Better Auth on PostgreSQL

- `apps/api/src/auth-db-pool.ts` — singleton `pg` `Pool` from `DATABASE_URL`.
- `apps/api/src/auth.ts` — `betterAuth({ database: pool, experimental: { joins: true }, ... })`.
- On API startup, **`getMigrations`** runs and creates/updates Better Auth tables on Postgres (same behavior as before on SQLite).

## Step 3 — Raw SQL call sites

- `apps/api/src/routes/v1/admin.ts` — member enrichment uses **parameterized** Postgres queries via `getAuthDbPool()`.
- `apps/api/src/routes/v1/onboarding.ts` — owner `member` row uses **`INSERT` / `SELECT`** with Postgres quoting for camelCase columns.
- `scripts/seed-admin.ts` — admin reset + role update use **`pg`** and `information_schema` for optional columns.

## Step 4 — Remove SQLite

- Removed **`better-sqlite3`** and **`bun:sqlite`** usage from the API and scripts.
- Removed root **`bun-sqlite.d.ts`**.
- Local **`argus-auth.db`** is obsolete; `*.db` remains in `.gitignore`.

## Step 5 — Qdrant Cloud

- `packages/ai/src/embeddings.ts` — `QdrantClient` is built with `url` and optional **`apiKey`** from `QDRANT_API_KEY`.

## Step 6 — Docker optional

- Compose file stays at `docker/docker-compose.yml` for **optional local** Neo4j, Qdrant, and Valkey.
- Root scripts renamed to:
  - `bun run infra:docker:up`
  - `bun run infra:docker:down`
  - `bun run infra:docker:logs`

## Step 7 — Verify

From repo root (with `.env` filled):

```bash
bun install
bun run typecheck
bun run dev:api
```

Then:

1. Hit `GET http://localhost:4000/api/health`.
2. Register or run `bun run scripts/seed-admin.ts` (requires `DATABASE_URL` and `BETTER_AUTH_*`).
3. Sign in via the web app; create an organization (onboarding).

## Step 8 — Data migration from old SQLite (optional)

If you have an existing `argus-auth.db`:

1. Export tables (e.g. with `sqlite3 .dump` or CSV export) for all Better Auth models you use.
2. Align types (especially dates and booleans) to Postgres.
3. Import into Supabase (`psql`, `COPY`, or a one-off script).
4. Start the API once so Better Auth migrations can add any missing columns; reconcile conflicts manually if needed.

## Files touched by this migration

| Area | Files |
|------|--------|
| Config / env | `packages/config/src/env.ts`, `packages/config/src/load-root-env.ts`, `packages/config/src/index.ts`, `.env.example` |
| Auth DB | `apps/api/src/auth-db-pool.ts`, `apps/api/src/auth.ts` |
| Routes | `apps/api/src/routes/v1/admin.ts`, `apps/api/src/routes/v1/onboarding.ts` |
| API entry | `apps/api/src/index.ts` |
| Scripts | `scripts/seed-admin.ts` |
| Test harness | `apps/api/src/test-auth.ts` |
| AI / Qdrant | `packages/ai/src/embeddings.ts` |
| Deps | `apps/api/package.json`, `bun.lock` |
| Infra docs | `docker/README.md`, `README.md`, `package.json` (scripts), `run.bat` |

## Rollback

Reintroduce SQLite only by reverting the git commit that applied this guide; keep a backup of `argus-auth.db` if you still rely on it.
