# 🔍 External Data Ingestion — Implementation Guide

> **Priority:** Highest  
> **Estimated Effort:** 3–5 days  
> **Package:** `packages/ingestion` (new) + `apps/api/src/routes/v1/ingestion.ts`

---

## Overview

ARGUS currently relies entirely on **seed data** (`scripts/seed.ts`) for its knowledge graph. This guide covers building a real-time data ingestion pipeline that pulls from four public cybersecurity APIs and populates Neo4j and Qdrant automatically.

---

## Current State

| Component | Status |
|---|---|
| `scripts/seed.ts` | ✅ Hardcoded demo data (8 assets, 5 CVEs, 3 actors) |
| `packages/ai/src/embeddings.ts` | ✅ Qdrant indexing for CVEs exists (`indexCVE()`) |
| `packages/graph/src/schema.ts` | ✅ Neo4j constraints & indexes defined |
| `.env` → `NVD_API_KEY` | ✅ Env var placeholder exists but is empty |
| Live API integration | ❌ Not implemented |
| Scheduled sync workers | ❌ Not implemented |
| Data deduplication | ❌ Not implemented |

---

## Data Sources & API Details

### 1. NVD (National Vulnerability Database)

- **API Endpoint:** `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Auth:** API key via `NVD_API_KEY` header (`apiKey`)
- **Rate Limits:** 5 requests/30s (without key), 50 requests/30s (with key)
- **Docs:** https://nvd.nist.gov/developers/vulnerabilities

**What to ingest:**
- CVE ID, description, CVSS v3.1 base score, severity
- Published/modified dates
- Affected CPE (Common Platform Enumeration) configurations
- Known exploited status (cross-reference with CISA KEV)

**Query Parameters:**
```
?pubStartDate=2024-01-01T00:00:00.000&pubEndDate=2024-12-31T23:59:59.999
?lastModStartDate=...&lastModEndDate=...
?resultsPerPage=100&startIndex=0
?keywordSearch=remote+code+execution
```

### 2. MITRE ATT&CK

- **Data Source:** STIX 2.1 bundles from GitHub
- **URL:** `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json`
- **Auth:** None
- **Format:** STIX 2.1 JSON bundle

**What to ingest:**
- Attack Techniques (type: `attack-pattern`)
- Tactics (mapped via `kill_chain_phases`)
- Technique → Tactic relationships
- External references (MITRE IDs like `T1190`)

### 3. CISA KEV (Known Exploited Vulnerabilities)

- **API Endpoint:** `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Auth:** None
- **Rate Limits:** None (static JSON)

**What to ingest:**
- CVE IDs that are actively exploited
- Date added to catalog
- Required remediation action
- Cross-reference with NVD CVEs to set `exploitedInWild = true`

### 4. AlienVault OTX (Open Threat Exchange)

- **API Endpoint:** `https://otx.alienvault.com/api/v1/pulses/subscribed`
- **Auth:** API key via `X-OTX-API-KEY` header
- **Rate Limits:** 10,000 requests/hour
- **Docs:** https://otx.alienvault.com/api

**What to ingest:**
- Threat actor profiles (pulses tagged with adversary names)
- Indicator of Compromise (IOC) associations
- CVE references within pulses

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Ingestion Scheduler                │
│         (Bun.setInterval / cron-like)           │
└────────┬──────┬──────┬──────┬───────────────────┘
         │      │      │      │
    ┌────▼──┐ ┌─▼───┐ ┌▼────┐ ┌▼─────┐
    │  NVD  │ │MITRE│ │CISA │ │ OTX  │
    │Fetcher│ │Fetch│ │Fetch│ │Fetch │
    └───┬───┘ └──┬──┘ └──┬──┘ └──┬───┘
        │        │       │       │
    ┌───▼────────▼───────▼───────▼───┐
    │       Data Transformer         │
    │   (Normalize → ARGUS Schema)   │
    └───────────┬────────────────────┘
                │
    ┌───────────▼────────────────────┐
    │       Graph Writer             │
    │  Neo4j MERGE (deduplicate)     │
    │  + Qdrant upsert (embeddings) │
    └────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the `packages/ingestion` package

```
packages/ingestion/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Public exports
    ├── scheduler.ts      # Cron-like scheduler
    ├── fetchers/
    │   ├── nvd.ts        # NVD API client
    │   ├── mitre.ts      # MITRE ATT&CK STIX parser
    │   ├── cisa-kev.ts   # CISA KEV fetcher
    │   └── otx.ts        # AlienVault OTX client
    ├── transformers/
    │   ├── cve.ts        # NVD → ARGUS CVE schema
    │   ├── technique.ts  # STIX → ARGUS AttackTechnique
    │   └── actor.ts      # OTX → ARGUS ThreatActor
    └── writers/
        ├── neo4j.ts      # Batch MERGE operations
        └── qdrant.ts     # Vector upserts
```

**`package.json`:**
```json
{
  "name": "@argus/ingestion",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "dependencies": {
    "@argus/config": "workspace:*",
    "@argus/graph": "workspace:*",
    "@argus/ai": "workspace:*",
    "@argus/types": "workspace:*",
    "@argus/cache": "workspace:*"
  }
}
```

### Step 2: NVD Fetcher Implementation

```typescript
// packages/ingestion/src/fetchers/nvd.ts

import { getEnv } from '@argus/config';

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

export interface NVDResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: NVDVulnerability[];
}

export interface NVDVulnerability {
  cve: {
    id: string;
    descriptions: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: {
        cvssData: { baseScore: number; baseSeverity: string };
      }[];
    };
    published: string;
    lastModified: string;
  };
}

export async function fetchNVDCVEs(options: {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  startIndex?: number;
  resultsPerPage?: number;
}): Promise<NVDResponse> {
  const env = getEnv();
  const params = new URLSearchParams();

  if (options.startDate) params.set('pubStartDate', options.startDate);
  if (options.endDate) params.set('pubEndDate', options.endDate);
  if (options.keyword) params.set('keywordSearch', options.keyword);
  params.set('startIndex', String(options.startIndex ?? 0));
  params.set('resultsPerPage', String(options.resultsPerPage ?? 50));

  const headers: Record<string, string> = {};
  if (env.NVD_API_KEY) {
    headers['apiKey'] = env.NVD_API_KEY;
  }

  const res = await fetch(`${NVD_BASE}?${params}`, { headers });

  if (!res.ok) {
    throw new Error(`NVD API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Paginated fetch — handles the NVD 2000-result limit
export async function fetchAllNVDCVEs(options: {
  startDate: string;
  endDate: string;
}): Promise<NVDVulnerability[]> {
  const all: NVDVulnerability[] = [];
  let startIndex = 0;
  const pageSize = 100;

  while (true) {
    const res = await fetchNVDCVEs({
      startDate: options.startDate,
      endDate: options.endDate,
      startIndex,
      resultsPerPage: pageSize,
    });

    all.push(...res.vulnerabilities);

    if (startIndex + pageSize >= res.totalResults) break;
    startIndex += pageSize;

    // Respect rate limits: ~6s between requests without API key
    await new Promise((r) => setTimeout(r, 6000));
  }

  return all;
}
```

### Step 3: CISA KEV Fetcher

```typescript
// packages/ingestion/src/fetchers/cisa-kev.ts

const CISA_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export interface CISAKEVEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: 'Known' | 'Unknown';
}

export async function fetchCISAKEV(): Promise<CISAKEVEntry[]> {
  const res = await fetch(CISA_KEV_URL);
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`);

  const data = await res.json();
  return data.vulnerabilities ?? [];
}

// Returns a Set of CVE IDs known to be exploited
export async function getExploitedCVEIds(): Promise<Set<string>> {
  const entries = await fetchCISAKEV();
  return new Set(entries.map((e) => e.cveID));
}
```

### Step 4: MITRE ATT&CK Fetcher

```typescript
// packages/ingestion/src/fetchers/mitre.ts

const MITRE_ATTACK_URL =
  'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

export interface STIXAttackPattern {
  type: 'attack-pattern';
  id: string;
  name: string;
  description: string;
  external_references: { source_name: string; external_id: string; url?: string }[];
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
}

export async function fetchMITRETechniques(): Promise<STIXAttackPattern[]> {
  const res = await fetch(MITRE_ATTACK_URL);
  if (!res.ok) throw new Error(`MITRE fetch failed: ${res.status}`);

  const bundle = await res.json();
  return bundle.objects.filter(
    (obj: any) => obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated,
  );
}

// Extracts the MITRE ID (e.g., "T1190") from external references
export function extractMitreId(technique: STIXAttackPattern): string | null {
  const ref = technique.external_references.find(
    (r) => r.source_name === 'mitre-attack',
  );
  return ref?.external_id ?? null;
}

// Extracts the primary tactic from kill chain phases
export function extractTactic(technique: STIXAttackPattern): string {
  const phase = technique.kill_chain_phases?.find(
    (p) => p.kill_chain_name === 'mitre-attack',
  );
  return phase?.phase_name ?? 'unknown';
}
```

### Step 5: Neo4j Graph Writer (MERGE-based Deduplication)

```typescript
// packages/ingestion/src/writers/neo4j.ts

import { getNeo4jDriver } from '@argus/graph';

// Use MERGE instead of CREATE to prevent duplicates
export async function upsertCVE(cve: {
  cveId: string;
  severity: string;
  cvss: number;
  exploitedInWild: boolean;
  description: string;
  publishedDate: string;
}) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MERGE (c:CVE {cveId: $cveId})
       SET c.severity = $severity,
           c.cvss = $cvss,
           c.exploitedInWild = $exploitedInWild,
           c.description = $description,
           c.publishedDate = $publishedDate,
           c.updatedAt = datetime()`,
      cve,
    );
  } finally {
    await session.close();
  }
}

export async function upsertTechnique(technique: {
  mitreId: string;
  name: string;
  tactic: string;
  description?: string;
}) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MERGE (t:AttackTechnique {mitreId: $mitreId})
       SET t.name = $name,
           t.tactic = $tactic,
           t.description = $description,
           t.updatedAt = datetime()`,
      technique,
    );
  } finally {
    await session.close();
  }
}

// Batch operations for performance
export async function batchUpsertCVEs(cves: any[]) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `UNWIND $cves AS cve
       MERGE (c:CVE {cveId: cve.cveId})
       SET c += cve, c.updatedAt = datetime()`,
      { cves },
    );
  } finally {
    await session.close();
  }
}

// Mark CVEs as exploited from CISA KEV
export async function markExploitedCVEs(cveIds: string[]) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `UNWIND $cveIds AS id
       MATCH (c:CVE {cveId: id})
       SET c.exploitedInWild = true`,
      { cveIds },
    );
  } finally {
    await session.close();
  }
}
```

### Step 6: Ingestion Scheduler

```typescript
// packages/ingestion/src/scheduler.ts

import { fetchAllNVDCVEs } from './fetchers/nvd';
import { fetchCISAKEV } from './fetchers/cisa-kev';
import { fetchMITRETechniques, extractMitreId, extractTactic } from './fetchers/mitre';
import { batchUpsertCVEs, markExploitedCVEs, upsertTechnique } from './writers/neo4j';
import { indexCVE } from '@argus/ai';

export interface SyncResult {
  source: string;
  itemsSynced: number;
  errors: string[];
  duration: number;
}

export async function syncNVD(): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    // Fetch CVEs from the last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const vulns = await fetchAllNVDCVEs({
      startDate: weekAgo.toISOString(),
      endDate: now.toISOString(),
    });

    // Transform and write
    const cves = vulns.map((v) => ({
      cveId: v.cve.id,
      description: v.cve.descriptions.find((d) => d.lang === 'en')?.value ?? '',
      cvss: v.cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseScore ?? 0,
      severity: (v.cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseSeverity ?? 'none').toLowerCase(),
      exploitedInWild: false,
      publishedDate: v.cve.published,
    }));

    await batchUpsertCVEs(cves);

    // Index in Qdrant for semantic search
    for (const cve of cves) {
      await indexCVE(cve.cveId, cve.description, cve.severity, cve.cvss);
    }

    return { source: 'NVD', itemsSynced: cves.length, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push((e as Error).message);
    return { source: 'NVD', itemsSynced: 0, errors, duration: Date.now() - start };
  }
}

export async function syncCISAKEV(): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const entries = await fetchCISAKEV();
    const cveIds = entries.map((e) => e.cveID);
    await markExploitedCVEs(cveIds);

    return { source: 'CISA-KEV', itemsSynced: cveIds.length, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push((e as Error).message);
    return { source: 'CISA-KEV', itemsSynced: 0, errors, duration: Date.now() - start };
  }
}

export async function syncMITRE(): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const techniques = await fetchMITRETechniques();

    for (const t of techniques) {
      const mitreId = extractMitreId(t);
      if (!mitreId) continue;

      await upsertTechnique({
        mitreId,
        name: t.name,
        tactic: extractTactic(t),
        description: t.description?.substring(0, 500),
      });
    }

    return { source: 'MITRE', itemsSynced: techniques.length, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push((e as Error).message);
    return { source: 'MITRE', itemsSynced: 0, errors, duration: Date.now() - start };
  }
}

// Master sync: runs all sources
export async function runFullSync(): Promise<SyncResult[]> {
  console.info('[Ingestion] Starting full sync...');
  const results = await Promise.allSettled([
    syncNVD(),
    syncCISAKEV(),
    syncMITRE(),
  ]);

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: 'Unknown', itemsSynced: 0, errors: [r.reason], duration: 0 },
  );
}

// Schedule periodic sync (every 6 hours)
export function startScheduler() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  // Initial sync after 30s startup delay
  setTimeout(() => runFullSync(), 30_000);

  // Periodic sync
  setInterval(() => runFullSync(), SIX_HOURS);

  console.info('[Ingestion] Scheduler started — syncing every 6 hours');
}
```

### Step 7: API Routes for Manual Sync Control

```typescript
// apps/api/src/routes/v1/ingestion.ts

import { Hono } from 'hono';
import { runFullSync, syncNVD, syncCISAKEV, syncMITRE } from '@argus/ingestion';

export const ingestionRoutes = new Hono();

// Trigger full sync manually
ingestionRoutes.post('/sync', async (c) => {
  const results = await runFullSync();
  return c.json({ success: true, data: results });
});

// Trigger individual source sync
ingestionRoutes.post('/sync/:source', async (c) => {
  const source = c.req.param('source');

  const syncFn = {
    nvd: syncNVD,
    cisa: syncCISAKEV,
    mitre: syncMITRE,
  }[source];

  if (!syncFn) {
    return c.json({ success: false, error: { code: 'INVALID_SOURCE', message: `Unknown source: ${source}` } }, 400);
  }

  const result = await syncFn();
  return c.json({ success: true, data: result });
});

// Get last sync status
ingestionRoutes.get('/status', async (c) => {
  // TODO: Store last sync results in Valkey cache
  return c.json({ success: true, data: { message: 'Implement sync status tracking' } });
});
```

### Step 8: Register in API Routes

In `apps/api/src/routes/v1/index.ts`, add:

```typescript
import { ingestionRoutes } from './ingestion';

// ... existing routes ...
v1Routes.route('/ingestion', ingestionRoutes);
```

### Step 9: Environment Updates

Add to `.env` and `.env.example`:

```env
# ─── Data Ingestion ──────────────────────────────────────────────
NVD_API_KEY=your-nvd-api-key
OTX_API_KEY=your-alienvault-otx-api-key
INGESTION_INTERVAL_HOURS=6
```

Update `packages/config/src/env.ts`:

```typescript
// Add to envSchema
OTX_API_KEY: z.string().optional(),
INGESTION_INTERVAL_HOURS: z.coerce.number().default(6),
```

---

## Testing Strategy

1. **Unit Tests:** Mock API responses for each fetcher
2. **Integration Test:** Run against local Neo4j (Docker) with a small NVD query
3. **E2E Test:** Trigger `/api/v1/ingestion/sync` and verify graph node counts increase
4. **Rate Limit Test:** Verify NVD fetcher respects 6s delay between paginated requests

---

## Rollout Checklist

- [ ] Create `packages/ingestion` package
- [ ] Implement NVD fetcher with pagination and rate limiting
- [ ] Implement CISA KEV fetcher
- [ ] Implement MITRE ATT&CK STIX parser
- [ ] Implement AlienVault OTX fetcher (stretch goal)
- [ ] Implement Neo4j MERGE-based writer with batch support
- [ ] Implement Qdrant vector indexing for new CVEs
- [ ] Create scheduler with configurable interval
- [ ] Add `/api/v1/ingestion/sync` API route
- [ ] Add sync status tracking in Valkey cache
- [ ] Update `.env.example` with new API key placeholders
- [ ] Add to workspace `package.json` dependencies
- [ ] Write integration tests against Docker Neo4j
