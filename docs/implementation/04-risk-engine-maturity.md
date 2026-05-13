# 📈 Risk Engine Maturity — Implementation Guide

> **Priority:** Medium-High  
> **Estimated Effort:** 2–3 days  
> **Files:** `packages/graph/src/risk.ts` (new), `apps/api/src/routes/v1/risk.ts` (new), `apps/api/src/routes/v1/dashboard.ts`

---

## Overview

The current risk engine in `dashboard.ts` uses a simple weighted sum of aggregate counts (exposed assets × 15, attack paths × 25, etc.) to produce a single global risk score. This guide covers building a **contextual, per-entity risk engine** that calculates individual risk scores based on graph topology, and adds **blast radius estimation** for impact analysis.

---

## Current State

| Component | Status |
|---|---|
| `apps/api/.../v1/dashboard.ts` → `/stats` | ✅ Global risk score (weighted sum + asymptotic curve) |
| `packages/types/src/graph.ts` → `RiskScoreSchema` | ✅ Type definition exists with `factors[]` array |
| Per-asset risk scoring | ❌ Not implemented |
| Per-CVE risk scoring | ❌ Not implemented |
| Blast radius calculation | ❌ Not implemented |
| Remediation priority ranking | ❌ Not implemented |
| Risk trend tracking over time | ❌ Not implemented |

---

## Risk Scoring Algorithm Design

### Factor Weights

| Factor | Weight | Description |
|---|---|---|
| CVSS Base Score | 0.25 | Raw vulnerability severity (normalized 0–100) |
| Exploit Availability | 0.20 | `exploitedInWild = true` → 100, false → 0 |
| Internet Exposure | 0.15 | Asset `internetFacing = true` → 100, false → 0 |
| Crown Jewel Proximity | 0.20 | Shortest path hops to nearest CrownJewel (fewer = higher risk) |
| Lateral Movement Potential | 0.10 | Number of outbound `ENABLES_LATERAL_MOVEMENT` or `CAN_ACCESS` edges |
| Threat Actor Targeting | 0.10 | Number of threat actors that `EXPLOITS` a CVE on this asset |

### Formula

```
entityRisk = Σ (factorValue × factorWeight) × 100
```

Where each `factorValue` is normalized to `[0, 1]`.

---

## Implementation Steps

### Step 1: Risk Calculator Module

```typescript
// packages/graph/src/risk.ts

import { executeReadOnlyQuery } from './queries';
import type { RiskScore, GraphNodeType } from '@argus/types';

// ─── Factor Weights ──────────────────────────────────────────────

const WEIGHTS = {
  cvss: 0.25,
  exploitAvailability: 0.20,
  internetExposure: 0.15,
  crownJewelProximity: 0.20,
  lateralMovement: 0.10,
  threatActorTargeting: 0.10,
} as const;

// ─── Per-Asset Risk Score ────────────────────────────────────────

export async function calculateAssetRisk(assetId: string): Promise<RiskScore> {
  const [
    assetProps,
    vulnerabilities,
    crownJewelDistance,
    lateralPaths,
    threatActors,
  ] = await Promise.all([
    getAssetProperties(assetId),
    getAssetVulnerabilities(assetId),
    getShortestCrownJewelDistance(assetId),
    getLateralMovementCount(assetId),
    getTargetingThreatActors(assetId),
  ]);

  // Factor 1: Highest CVSS on this asset (normalized to 0-1)
  const maxCvss = Math.max(...vulnerabilities.map((v) => v.cvss), 0);
  const cvssNormalized = maxCvss / 10;

  // Factor 2: Exploit availability (any CVE exploited in wild?)
  const exploitAvailability = vulnerabilities.some((v) => v.exploitedInWild) ? 1 : 0;

  // Factor 3: Internet exposure
  const internetExposure = assetProps.internetFacing ? 1 : 0;

  // Factor 4: Crown Jewel proximity (inverse of distance)
  // Distance 1 = 1.0, Distance 2 = 0.75, Distance 3 = 0.5, etc.
  // No path = 0
  const crownJewelProximity = crownJewelDistance === null
    ? 0
    : Math.max(0, 1 - (crownJewelDistance - 1) * 0.25);

  // Factor 5: Lateral movement potential (capped at 5 paths)
  const lateralMovement = Math.min(lateralPaths / 5, 1);

  // Factor 6: Threat actor targeting (capped at 3 actors)
  const threatActorTargeting = Math.min(threatActors / 3, 1);

  // Calculate weighted score
  const rawScore =
    cvssNormalized * WEIGHTS.cvss +
    exploitAvailability * WEIGHTS.exploitAvailability +
    internetExposure * WEIGHTS.internetExposure +
    crownJewelProximity * WEIGHTS.crownJewelProximity +
    lateralMovement * WEIGHTS.lateralMovement +
    threatActorTargeting * WEIGHTS.threatActorTargeting;

  const score = Math.round(rawScore * 100);

  return {
    entityId: assetId,
    entityType: 'asset',
    score,
    factors: [
      { name: 'CVSS Base Score', weight: WEIGHTS.cvss, value: cvssNormalized, description: `Highest CVSS: ${maxCvss}` },
      { name: 'Exploit Availability', weight: WEIGHTS.exploitAvailability, value: exploitAvailability, description: exploitAvailability ? 'Actively exploited CVE present' : 'No known exploits' },
      { name: 'Internet Exposure', weight: WEIGHTS.internetExposure, value: internetExposure, description: internetExposure ? 'Internet-facing' : 'Internal only' },
      { name: 'Crown Jewel Proximity', weight: WEIGHTS.crownJewelProximity, value: crownJewelProximity, description: crownJewelDistance ? `${crownJewelDistance} hops to nearest crown jewel` : 'No path to crown jewels' },
      { name: 'Lateral Movement', weight: WEIGHTS.lateralMovement, value: lateralMovement, description: `${lateralPaths} outbound movement paths` },
      { name: 'Threat Actor Targeting', weight: WEIGHTS.threatActorTargeting, value: threatActorTargeting, description: `${threatActors} threat actors targeting this asset` },
    ],
    calculatedAt: new Date().toISOString(),
  };
}

// ─── Blast Radius Estimation ─────────────────────────────────────

export interface BlastRadius {
  compromisedAssetId: string;
  reachableAssets: Array<{
    id: string;
    hostname: string;
    criticality: string;
    hops: number;
  }>;
  reachableCrownJewels: Array<{
    id: string;
    name: string;
    hops: number;
  }>;
  totalReachable: number;
  maxDepth: number;
  impactScore: number; // 0-100
}

export async function calculateBlastRadius(
  assetId: string,
  maxHops = 6,
): Promise<BlastRadius> {
  const session = (await import('./driver')).getSession();

  try {
    // Find all assets reachable from the compromised asset
    const assetsResult = await session.run(
      `MATCH path = (source)-[:CONNECTED_TO|CAN_ACCESS|ENABLES_LATERAL_MOVEMENT*1..${maxHops}]->(target:Asset)
       WHERE elementId(source) = $assetId
       RETURN DISTINCT target.hostname AS hostname,
              elementId(target) AS id,
              target.criticality AS criticality,
              length(path) AS hops
       ORDER BY hops`,
      { assetId },
    );

    // Find crown jewels in the blast radius
    const crownResult = await session.run(
      `MATCH path = (source)-[*1..${maxHops}]->(crown:CrownJewel)
       WHERE elementId(source) = $assetId
       RETURN DISTINCT crown.name AS name,
              elementId(crown) AS id,
              length(path) AS hops
       ORDER BY hops`,
      { assetId },
    );

    const reachableAssets = assetsResult.records.map((r) => ({
      id: r.get('id'),
      hostname: r.get('hostname'),
      criticality: r.get('criticality'),
      hops: r.get('hops')?.toNumber?.() ?? Number(r.get('hops')),
    }));

    const reachableCrownJewels = crownResult.records.map((r) => ({
      id: r.get('id'),
      name: r.get('name'),
      hops: r.get('hops')?.toNumber?.() ?? Number(r.get('hops')),
    }));

    // Impact score: based on number and criticality of reachable assets + crown jewels
    const criticalReachable = reachableAssets.filter((a) => a.criticality === 'critical').length;
    const highReachable = reachableAssets.filter((a) => a.criticality === 'high').length;
    const crownJewelReachable = reachableCrownJewels.length;

    const impactScore = Math.min(100, Math.round(
      crownJewelReachable * 30 +
      criticalReachable * 15 +
      highReachable * 8 +
      reachableAssets.length * 3
    ));

    return {
      compromisedAssetId: assetId,
      reachableAssets,
      reachableCrownJewels,
      totalReachable: reachableAssets.length,
      maxDepth: Math.max(0, ...reachableAssets.map((a) => a.hops)),
      impactScore,
    };
  } finally {
    await session.close();
  }
}

// ─── Remediation Priority ────────────────────────────────────────

export interface RemediationItem {
  entityId: string;
  entityType: 'asset' | 'cve';
  label: string;
  riskScore: number;
  reason: string;
  suggestedAction: string;
}

export async function getRemediationPriority(limit = 10): Promise<RemediationItem[]> {
  const session = (await import('./driver')).getSession();

  try {
    const result = await session.run(`
      MATCH (a:Asset)-[:HAS_VULNERABILITY]->(c:CVE)
      OPTIONAL MATCH (a)-[*1..4]->(crown:CrownJewel)
      WITH a, c,
           CASE WHEN crown IS NOT NULL THEN true ELSE false END AS reachesCrown,
           count(DISTINCT crown) AS crownCount
      WITH a, c, reachesCrown, crownCount,
           (c.cvss * 10) +
           (CASE WHEN c.exploitedInWild THEN 30 ELSE 0 END) +
           (CASE WHEN a.internetFacing THEN 20 ELSE 0 END) +
           (CASE WHEN reachesCrown THEN crownCount * 15 ELSE 0 END)
           AS priority
      RETURN a.hostname AS hostname, elementId(a) AS assetId,
             c.cveId AS cveId, elementId(c) AS cveNodeId,
             c.cvss AS cvss, c.exploitedInWild AS exploited,
             a.internetFacing AS internetFacing,
             reachesCrown, priority
      ORDER BY priority DESC
      LIMIT $limit
    `, { limit: neo4j.int(limit) });

    return result.records.map((r) => {
      const hostname = r.get('hostname');
      const cveId = r.get('cveId');
      const exploited = r.get('exploited');
      const internetFacing = r.get('internetFacing');
      const reachesCrown = r.get('reachesCrown');

      const reasons: string[] = [];
      if (exploited) reasons.push('actively exploited');
      if (internetFacing) reasons.push('internet-facing');
      if (reachesCrown) reasons.push('path to crown jewels');

      return {
        entityId: r.get('assetId'),
        entityType: 'asset' as const,
        label: `${hostname} — ${cveId}`,
        riskScore: r.get('priority')?.toNumber?.() ?? Number(r.get('priority')),
        reason: reasons.join(', '),
        suggestedAction: `Patch ${cveId} on ${hostname}`,
      };
    });
  } finally {
    await session.close();
  }
}

// ─── Helper Queries ──────────────────────────────────────────────

async function getAssetProperties(assetId: string) {
  const records = await executeReadOnlyQuery(
    'MATCH (a:Asset) WHERE elementId(a) = $assetId RETURN a',
    { assetId },
  );
  return records[0]?.get('a')?.properties ?? { internetFacing: false };
}

async function getAssetVulnerabilities(assetId: string) {
  const records = await executeReadOnlyQuery(
    `MATCH (a:Asset)-[:HAS_VULNERABILITY]->(c:CVE)
     WHERE elementId(a) = $assetId
     RETURN c.cvss AS cvss, c.exploitedInWild AS exploitedInWild`,
    { assetId },
  );
  return records.map((r) => ({
    cvss: r.get('cvss')?.toNumber?.() ?? Number(r.get('cvss') ?? 0),
    exploitedInWild: r.get('exploitedInWild') ?? false,
  }));
}

async function getShortestCrownJewelDistance(assetId: string): Promise<number | null> {
  const records = await executeReadOnlyQuery(
    `MATCH path = shortestPath((a)-[*..8]->(c:CrownJewel))
     WHERE elementId(a) = $assetId
     RETURN length(path) AS distance
     ORDER BY distance
     LIMIT 1`,
    { assetId },
  );
  if (records.length === 0) return null;
  const dist = records[0].get('distance');
  return dist?.toNumber?.() ?? Number(dist);
}

async function getLateralMovementCount(assetId: string): Promise<number> {
  const records = await executeReadOnlyQuery(
    `MATCH (a)-[:CONNECTED_TO|CAN_ACCESS|ENABLES_LATERAL_MOVEMENT]->(target)
     WHERE elementId(a) = $assetId
     RETURN count(target) AS count`,
    { assetId },
  );
  const val = records[0]?.get('count');
  return val?.toNumber?.() ?? Number(val ?? 0);
}

async function getTargetingThreatActors(assetId: string): Promise<number> {
  const records = await executeReadOnlyQuery(
    `MATCH (t:ThreatActor)-[:TARGETS]->(a:Asset)
     WHERE elementId(a) = $assetId
     RETURN count(t) AS count`,
    { assetId },
  );
  const val = records[0]?.get('count');
  return val?.toNumber?.() ?? Number(val ?? 0);
}
```

### Step 2: Risk API Routes

```typescript
// apps/api/src/routes/v1/risk.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { calculateAssetRisk, calculateBlastRadius, getRemediationPriority } from '@argus/graph';
import { withCache } from '@argus/cache';

export const riskRoutes = new Hono();

// Per-asset risk score
riskRoutes.get('/asset/:assetId', async (c) => {
  const assetId = c.req.param('assetId');

  const data = await withCache(`risk:asset:${assetId}`, 120, () =>
    calculateAssetRisk(assetId),
  );

  return c.json({ success: true, data });
});

// Blast radius for a compromised asset
riskRoutes.get('/blast-radius/:assetId', async (c) => {
  const assetId = c.req.param('assetId');

  const data = await withCache(`risk:blast:${assetId}`, 120, () =>
    calculateBlastRadius(assetId),
  );

  return c.json({ success: true, data });
});

// Top remediation priorities
riskRoutes.get('/remediation', async (c) => {
  const data = await withCache('risk:remediation', 120, () =>
    getRemediationPriority(10),
  );

  return c.json({ success: true, data });
});

// All assets ranked by risk
riskRoutes.get('/rankings', async (c) => {
  const data = await withCache('risk:rankings', 120, async () => {
    // Get all asset IDs
    const { executeReadOnlyQuery } = await import('@argus/graph');
    const records = await executeReadOnlyQuery(
      'MATCH (a:Asset) RETURN elementId(a) AS id LIMIT 100',
    );
    const assetIds = records.map((r) => r.get('id') as string);

    // Calculate risk for each
    const scores = await Promise.all(
      assetIds.map((id) => calculateAssetRisk(id)),
    );

    return scores.sort((a, b) => b.score - a.score);
  });

  return c.json({ success: true, data });
});
```

### Step 3: Register Routes

Add to `apps/api/src/routes/v1/index.ts`:

```typescript
import { riskRoutes } from './risk';

// ... existing routes
v1Routes.route('/risk', riskRoutes);
```

### Step 4: Update Dashboard to Use Per-Entity Scores

The existing dashboard `/stats` endpoint can be enhanced to also return the top-5 highest-risk assets:

```typescript
// Add to dashboard.ts → /stats route

// After calculating the global riskScore, also fetch top risky assets:
const topRiskyAssets = await getRemediationPriority(5);

return {
  totalAssets,
  criticalVulnerabilities,
  activeThreatActors,
  activeExploits,
  crownJewels,
  riskScore: Math.max(10, normalizedRisk),
  topRemediations: topRiskyAssets, // NEW
};
```

---

## Rollout Checklist

- [ ] Create `packages/graph/src/risk.ts` with `calculateAssetRisk()`
- [ ] Implement `calculateBlastRadius()` with graph traversal
- [ ] Implement `getRemediationPriority()` with weighted ranking
- [ ] Create `apps/api/src/routes/v1/risk.ts` with 4 endpoints
- [ ] Register risk routes in API router
- [ ] Update dashboard `/stats` to include `topRemediations`
- [ ] Add risk factor breakdown visualization to frontend
- [ ] Add blast radius visualization (concentric rings in graph view)
- [ ] Cache risk scores in Valkey with 2-minute TTL
- [ ] Export `calculateAssetRisk` and `calculateBlastRadius` from `@argus/graph`
- [ ] Write unit tests for risk factor normalization
- [ ] Test with varying graph topologies (isolated assets, fully-connected)
