# 🛠️ DevOps & Production Readiness — Implementation Guide

> **Priority:** Medium  
> **Estimated Effort:** 2–3 days  
> **Files:** `docker/`, `docker-compose.yml`, `Dockerfile` (new), CI/CD configs

---

## Overview

ARGUS currently runs in development mode with `bun run dev` and relies on `docker-compose.yml` only for infrastructure services (Neo4j, Qdrant, Valkey). This guide covers building **production Docker images**, **multi-stage builds**, **health monitoring**, **CI/CD pipelines**, and **environment hardening** for a deployment-ready ARGUS.

---

## Current State

| Component | Status |
|---|---|
| `docker/docker-compose.yml` | ✅ Neo4j, Qdrant, Valkey with health checks |
| `run.bat` | ✅ Windows dev startup script |
| Docker images for app services | ❌ No Dockerfiles for API or Web |
| CI/CD pipeline | ❌ Not configured |
| Production environment config | ❌ Only `.env` for development |
| Health check endpoints | ✅ Basic `/api/health` exists |
| Structured logging | ❌ Using `console.log/info/warn` |
| Graceful shutdown | ❌ Not implemented |
| Monitoring / metrics | ❌ Not implemented |

---

## Implementation Steps

### Step 1: API Dockerfile (Multi-Stage Build)

```dockerfile
# apps/api/Dockerfile

# ─── Stage 1: Install dependencies ──────────────────────────────
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock bunfig.toml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/graph/package.json ./packages/graph/
COPY packages/ai/package.json ./packages/ai/
COPY packages/cache/package.json ./packages/cache/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile --production

# ─── Stage 2: Build ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Type checking (optional, can skip for faster builds)
# RUN bun run typecheck

# ─── Stage 3: Production ────────────────────────────────────────
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 argus && \
    adduser --system --uid 1001 argus

# Copy only what's needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

# SQLite auth database directory
RUN mkdir -p /app/apps/data && chown argus:argus /app/apps/data

USER argus

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["bun", "run", "apps/api/src/index.ts"]
```

### Step 2: Web Dockerfile (Next.js Multi-Stage)

```dockerfile
# apps/web/Dockerfile

# ─── Stage 1: Dependencies ──────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY apps/web/package.json ./
RUN npm install --frozen-lockfile

# ─── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: Production ────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 argus && \
    adduser --system --uid 1001 argus

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER argus

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]
```

**Note:** For standalone output, add to `apps/web/next.config.ts`:

```typescript
const nextConfig = {
  output: 'standalone',
  // ... existing config
};
```

### Step 3: Full Production Docker Compose

```yaml
# docker/docker-compose.prod.yml

services:
  # ─── ARGUS API ──────────────────────────────────────────────────
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: argus-api
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      WEB_URL: http://web:3000
      API_URL: http://api:4000
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: ${NEO4J_PASSWORD}
      QDRANT_URL: http://qdrant:6333
      VALKEY_URL: redis://valkey:6379
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: http://api:4000
      NVD_API_KEY: ${NVD_API_KEY}
    depends_on:
      neo4j:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      valkey:
        condition: service_healthy
    volumes:
      - api_data:/app/apps/data
    networks:
      - argus-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

  # ─── ARGUS Web ──────────────────────────────────────────────────
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    container_name: argus-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    depends_on:
      - api
    networks:
      - argus-network
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"

  # ─── Neo4j ─────────────────────────────────────────────────────
  neo4j:
    image: neo4j:5-community
    container_name: argus-neo4j
    restart: unless-stopped
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc"]'
      NEO4J_server_memory_heap_initial__size: 512m
      NEO4J_server_memory_heap_max__size: 1g
      NEO4J_server_memory_pagecache_size: 512m
      NEO4J_dbms_security_procedures_unrestricted: apoc.*
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p ${NEO4J_PASSWORD} 'RETURN 1'"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks:
      - argus-network
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"

  # ─── Qdrant ────────────────────────────────────────────────────
  qdrant:
    image: qdrant/qdrant:latest
    container_name: argus-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:6333/healthz || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - argus-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

  # ─── Valkey ────────────────────────────────────────────────────
  valkey:
    image: valkey/valkey:8-alpine
    container_name: argus-valkey
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    command: valkey-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    networks:
      - argus-network
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"

volumes:
  api_data:
    driver: local
  neo4j_data:
    driver: local
  neo4j_logs:
    driver: local
  qdrant_data:
    driver: local
  valkey_data:
    driver: local

networks:
  argus-network:
    name: argus-network
    driver: bridge
```

### Step 4: Production Environment File

```env
# docker/.env.production

# ─── Application ──────────────────────────────────────────────────
NODE_ENV=production
PORT=4000

# ─── Neo4j ────────────────────────────────────────────────────────
NEO4J_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE

# ─── AI ───────────────────────────────────────────────────────────
GEMINI_API_KEY=your-production-gemini-key

# ─── Auth ─────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=CHANGE_ME_RANDOM_64_CHAR_SECRET

# ─── NVD ──────────────────────────────────────────────────────────
NVD_API_KEY=your-nvd-api-key
```

### Step 5: Enhanced Health Check Endpoint

```typescript
// apps/api/src/routes/v1/health.ts (new file)

import { Hono } from 'hono';
import { getNeo4jDriver } from '@argus/graph';
import { getCacheClient } from '@argus/cache';

export const healthRoutes = new Hono();

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

healthRoutes.get('/', async (c) => {
  const services: ServiceHealth[] = [];

  // Check Neo4j
  const neo4jHealth = await checkNeo4j();
  services.push(neo4jHealth);

  // Check Valkey
  const valkeyHealth = await checkValkey();
  services.push(valkeyHealth);

  // Check Qdrant
  const qdrantHealth = await checkQdrant();
  services.push(qdrantHealth);

  const overallStatus = services.every((s) => s.status === 'healthy')
    ? 'healthy'
    : services.some((s) => s.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return c.json({
    status: overallStatus,
    service: 'argus-api',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
  }, statusCode);
});

// Liveness probe (is the process alive?)
healthRoutes.get('/live', (c) => {
  return c.json({ status: 'alive' });
});

// Readiness probe (can we accept traffic?)
healthRoutes.get('/ready', async (c) => {
  try {
    const session = getNeo4jDriver().session();
    await session.run('RETURN 1');
    await session.close();
    return c.json({ status: 'ready' });
  } catch {
    return c.json({ status: 'not_ready' }, 503);
  }
});

async function checkNeo4j(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const session = getNeo4jDriver().session();
    await session.run('RETURN 1');
    await session.close();
    return { name: 'neo4j', status: 'healthy', latencyMs: Date.now() - start };
  } catch (e) {
    return { name: 'neo4j', status: 'unhealthy', latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

async function checkValkey(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const client = getCacheClient();
    await client.ping();
    return { name: 'valkey', status: 'healthy', latencyMs: Date.now() - start };
  } catch (e) {
    return { name: 'valkey', status: 'degraded', latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

async function checkQdrant(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(`${process.env.QDRANT_URL ?? 'http://localhost:6333'}/healthz`);
    return {
      name: 'qdrant',
      status: res.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return { name: 'qdrant', status: 'degraded', latencyMs: Date.now() - start, error: (e as Error).message };
  }
}
```

### Step 6: Structured Logging

```typescript
// packages/config/src/logger.ts (new file)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry); // Structured JSON for production
  }
  // Pretty format for development
  const icon = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[entry.level];
  return `${icon} [${entry.service}] ${entry.message}`;
}

export function createLogger(service: string) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      ...meta,
    };

    const formatted = formatLog(entry);

    switch (level) {
      case 'debug': console.debug(formatted); break;
      case 'info': console.info(formatted); break;
      case 'warn': console.warn(formatted); break;
      case 'error': console.error(formatted); break;
    }
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  };
}
```

### Step 7: Graceful Shutdown

```typescript
// Add to apps/api/src/index.ts

import { getNeo4jDriver } from '@argus/graph';
import { CacheClient } from '@argus/cache';

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.info(`\n[${signal}] Shutting down ARGUS API gracefully...`);

  try {
    // Close Neo4j driver
    const driver = getNeo4jDriver();
    await driver.close();
    console.info('  ✓ Neo4j connection closed');
  } catch {}

  try {
    // Close Valkey connection
    CacheClient.close();
    console.info('  ✓ Valkey connection closed');
  } catch {}

  console.info('  ✓ Shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

### Step 8: GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run lint

      - name: Type check
        run: bun run typecheck

  build:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4

      - name: Build API Docker image
        run: docker build -f apps/api/Dockerfile -t argus-api:${{ github.sha }} .

      - name: Build Web Docker image
        run: docker build -f apps/web/Dockerfile -t argus-web:${{ github.sha }} .

  integration-test:
    runs-on: ubuntu-latest
    needs: build
    services:
      neo4j:
        image: neo4j:5-community
        env:
          NEO4J_AUTH: neo4j/test_password
        ports:
          - 7687:7687
          - 7474:7474
      valkey:
        image: valkey/valkey:8-alpine
        ports:
          - 6379:6379
      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6333:6333

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Wait for services
        run: |
          sleep 10
          curl -f http://localhost:7474 || exit 1
          curl -f http://localhost:6333/healthz || exit 1

      - name: Seed database
        run: bun run scripts/seed.ts
        env:
          NEO4J_URI: bolt://localhost:7687
          NEO4J_USER: neo4j
          NEO4J_PASSWORD: test_password
          QDRANT_URL: http://localhost:6333

      - name: Run API tests
        run: bun test
        env:
          NEO4J_URI: bolt://localhost:7687
          NEO4J_USER: neo4j
          NEO4J_PASSWORD: test_password
          QDRANT_URL: http://localhost:6333
          VALKEY_URL: redis://localhost:6379
```

### Step 9: Makefile / Script Shortcuts

```makefile
# Makefile (at project root)

.PHONY: dev prod build test seed clean

# Development
dev:
	docker compose -f docker/docker-compose.yml up -d
	bun run dev

# Production (full stack)
prod:
	docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.production up -d --build

# Build images
build:
	docker compose -f docker/docker-compose.prod.yml build

# Seed database
seed:
	bun run scripts/seed.ts

# Run tests
test:
	bun test

# Stop all services
clean:
	docker compose -f docker/docker-compose.yml down
	docker compose -f docker/docker-compose.prod.yml down

# View logs
logs:
	docker compose -f docker/docker-compose.prod.yml logs -f --tail=100
```

---

## Rollout Checklist

- [ ] Create `apps/api/Dockerfile` with multi-stage build
- [ ] Create `apps/web/Dockerfile` with Next.js standalone output
- [ ] Create `docker/docker-compose.prod.yml` for full-stack production
- [ ] Create `docker/.env.production` template
- [ ] Add `output: 'standalone'` to Next.js config
- [ ] Implement enhanced health check endpoints (`/health`, `/health/live`, `/health/ready`)
- [ ] Create structured logger module
- [ ] Replace all `console.log/info/warn` calls with structured logger
- [ ] Implement graceful shutdown with connection cleanup
- [ ] Create GitHub Actions CI workflow
- [ ] Create `Makefile` with dev/prod/build/test shortcuts
- [ ] Add resource limits to all Docker services
- [ ] Configure Neo4j memory settings for production
- [ ] Set up `.dockerignore` to exclude `node_modules`, `.git`, etc.
- [ ] Test full `docker compose up` from scratch on a clean machine
- [ ] Document deployment instructions in main `README.md`
