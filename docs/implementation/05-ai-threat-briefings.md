# 📰 AI Threat Briefings — Implementation Guide

> **Priority:** Medium  
> **Estimated Effort:** 2 days  
> **Files:** `apps/api/src/routes/v1/ai.ts`, `apps/web/src/app/(dashboard)/dashboard/page.tsx`, new briefing components

---

## Overview

The API already has a `/api/v1/ai/threat-brief` endpoint that generates a single AI briefing. This guide covers building a **full briefing system** with daily summaries, weekly reports, historical tracking, and a dedicated UI widget on the dashboard — making ARGUS feel like a production SOC (Security Operations Center) tool.

---

## Current State

| Component | Status |
|---|---|
| `apps/api/.../v1/ai.ts` → `GET /threat-brief` | ✅ Generates single briefing from current graph data |
| `packages/ai/src/prompts.ts` → `GENERATE_THREAT_BRIEF` | ✅ Prompt template exists |
| `packages/ai/src/prompts.ts` → `THREAT_BRIEFING` | ✅ System prompt exists |
| Briefing history storage | ❌ Not implemented |
| Scheduled auto-generation | ❌ Not implemented |
| Weekly summary aggregation | ❌ Not implemented |
| Dashboard briefing widget | ❌ Not implemented |
| Dedicated briefings page | ❌ Not implemented |
| Email/notification delivery | ❌ Not implemented |

---

## Architecture

```
┌─────────────────────────────┐
│    Briefing Scheduler       │
│  (daily 08:00, weekly Mon)  │
└──────────┬──────────────────┘
           │
    ┌──────▼──────────────────┐
    │  Data Gatherer          │
    │  - Neo4j stats delta    │
    │  - New CVEs since last  │
    │  - Risk score changes   │
    │  - New threat activity  │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │  AI Briefing Generator  │
    │  - Daily summary        │
    │  - Weekly report        │
    │  - Recommendations      │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │  Storage (Valkey + Neo4j)│
    │  - Briefing history     │
    │  - Comparison baselines │
    └─────────────────────────┘
```

---

## Implementation Steps

### Step 1: Briefing Data Collector

```typescript
// packages/ai/src/briefing.ts

import { executeReadOnlyQuery } from '@argus/graph';
import { chat, SYSTEM_PROMPTS, buildPrompt, USER_PROMPTS } from './services';

export interface BriefingData {
  // Current stats
  totalAssets: number;
  totalCVEs: number;
  criticalCVEs: number;
  exploitedCVEs: number;
  threatActors: number;

  // Deltas (vs last briefing)
  newCVEsSinceLastBrief: any[];
  riskScoreChange: number;
  newThreatActivity: any[];

  // Top concerns
  topExploitedCVEs: any[];
  internetFacingWithCritical: any[];
  attackPathCount: number;
}

export async function gatherBriefingData(): Promise<BriefingData> {
  const queries = {
    totalAssets: 'MATCH (a:Asset) RETURN count(a) AS count',
    totalCVEs: 'MATCH (c:CVE) RETURN count(c) AS count',
    criticalCVEs: "MATCH (c:CVE) WHERE c.severity = 'critical' RETURN count(c) AS count",
    exploitedCVEs: 'MATCH (c:CVE) WHERE c.exploitedInWild = true RETURN count(c) AS count',
    threatActors: 'MATCH (t:ThreatActor) RETURN count(t) AS count',
    attackPaths: 'MATCH path = (a:Asset {internetFacing: true})-[*1..6]->(c:CrownJewel) RETURN count(path) AS count',
  };

  const counts: Record<string, number> = {};
  for (const [key, cypher] of Object.entries(queries)) {
    const records = await executeReadOnlyQuery(cypher);
    const val = records[0]?.get('count');
    counts[key] = val?.toNumber?.() ?? Number(val ?? 0);
  }

  // Get top exploited CVEs with details
  const exploitedRecords = await executeReadOnlyQuery(`
    MATCH (c:CVE) WHERE c.exploitedInWild = true
    OPTIONAL MATCH (t:ThreatActor)-[:EXPLOITS]->(c)
    OPTIONAL MATCH (a:Asset)-[:HAS_VULNERABILITY]->(c)
    RETURN c.cveId AS cveId, c.cvss AS cvss, c.description AS description,
           collect(DISTINCT t.name) AS actors,
           collect(DISTINCT a.hostname) AS assets
    ORDER BY c.cvss DESC
    LIMIT 5
  `);

  const topExploitedCVEs = exploitedRecords.map((r) => ({
    cveId: r.get('cveId'),
    cvss: r.get('cvss')?.toNumber?.() ?? Number(r.get('cvss')),
    description: r.get('description'),
    actors: r.get('actors').filter(Boolean),
    assets: r.get('assets').filter(Boolean),
  }));

  // Get internet-facing assets with critical vulnerabilities
  const exposedRecords = await executeReadOnlyQuery(`
    MATCH (a:Asset {internetFacing: true})-[:HAS_VULNERABILITY]->(c:CVE)
    WHERE c.severity IN ['critical', 'high']
    RETURN a.hostname AS hostname, a.criticality AS criticality,
           collect(c.cveId) AS cves
    LIMIT 10
  `);

  const internetFacingWithCritical = exposedRecords.map((r) => ({
    hostname: r.get('hostname'),
    criticality: r.get('criticality'),
    cves: r.get('cves'),
  }));

  return {
    totalAssets: counts.totalAssets,
    totalCVEs: counts.totalCVEs,
    criticalCVEs: counts.criticalCVEs,
    exploitedCVEs: counts.exploitedCVEs,
    threatActors: counts.threatActors,
    newCVEsSinceLastBrief: [], // TODO: Track with timestamps
    riskScoreChange: 0,       // TODO: Compare with stored baseline
    newThreatActivity: [],     // TODO: Track with timestamps
    topExploitedCVEs,
    internetFacingWithCritical,
    attackPathCount: counts.attackPaths,
  };
}
```

### Step 2: Briefing Generator

```typescript
// packages/ai/src/briefing.ts (continued)

export interface ThreatBriefing {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  executiveSummary: string;
  keyFindings: string;
  riskAssessment: string;
  recommendations: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  stats: {
    totalAssets: number;
    criticalCVEs: number;
    exploitedCVEs: number;
    attackPaths: number;
  };
  generatedAt: string;
}

export async function generateDailyBriefing(): Promise<ThreatBriefing> {
  const data = await gatherBriefingData();

  const prompt = `Generate a concise DAILY security briefing based on:

## Current Infrastructure Status
- Total monitored assets: ${data.totalAssets}
- Total CVEs tracked: ${data.totalCVEs}
- Critical CVEs: ${data.criticalCVEs}
- Actively exploited CVEs: ${data.exploitedCVEs}
- Known threat actors: ${data.threatActors}
- Attack paths to crown jewels: ${data.attackPathCount}

## Top Actively Exploited Vulnerabilities
${data.topExploitedCVEs.map((c) =>
  `- ${c.cveId} (CVSS ${c.cvss}): ${c.description}
   Exploited by: ${c.actors.join(', ') || 'Unknown'}
   Affected: ${c.assets.join(', ') || 'None mapped'}`
).join('\n')}

## Internet-Facing Assets with Critical Vulnerabilities
${data.internetFacingWithCritical.map((a) =>
  `- ${a.hostname} (${a.criticality}): ${a.cves.join(', ')}`
).join('\n')}

Structure your response as JSON with these fields:
{
  "executiveSummary": "2-3 sentence overview",
  "keyFindings": "Bullet-point key findings as a markdown list",
  "riskAssessment": "1 paragraph risk assessment",
  "recommendations": ["action item 1", "action item 2", ...],
  "severity": "critical|high|medium|low"
}

Return ONLY the JSON object.`;

  const response = await chat(
    [{ role: 'user', content: prompt }],
    {
      systemPrompt: SYSTEM_PROMPTS.THREAT_BRIEFING,
      temperature: 0.3,
      maxTokens: 2000,
    },
  );

  let parsed: any;
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? response);
  } catch {
    parsed = {
      executiveSummary: response.substring(0, 300),
      keyFindings: response,
      riskAssessment: '',
      recommendations: [],
      severity: 'medium',
    };
  }

  return {
    id: crypto.randomUUID(),
    type: 'daily',
    title: `Daily Threat Briefing — ${new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })}`,
    executiveSummary: parsed.executiveSummary,
    keyFindings: parsed.keyFindings,
    riskAssessment: parsed.riskAssessment,
    recommendations: parsed.recommendations ?? [],
    severity: parsed.severity ?? 'medium',
    stats: {
      totalAssets: data.totalAssets,
      criticalCVEs: data.criticalCVEs,
      exploitedCVEs: data.exploitedCVEs,
      attackPaths: data.attackPathCount,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function generateWeeklyBriefing(): Promise<ThreatBriefing> {
  // Similar to daily but with longer time range and trend analysis
  const briefing = await generateDailyBriefing();
  briefing.type = 'weekly';
  briefing.title = `Weekly Intelligence Report — Week of ${new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })}`;
  return briefing;
}
```

### Step 3: Briefing Storage & API Routes

```typescript
// apps/api/src/routes/v1/briefings.ts

import { Hono } from 'hono';
import { generateDailyBriefing, generateWeeklyBriefing, type ThreatBriefing } from '@argus/ai';
import { withCache } from '@argus/cache';
import { getCacheClient } from '@argus/cache';

export const briefingRoutes = new Hono();

const BRIEFING_HISTORY_KEY = 'briefings:history';

// Generate a new daily briefing
briefingRoutes.post('/daily', async (c) => {
  const briefing = await generateDailyBriefing();

  // Store in history (keep last 30)
  await storeBriefing(briefing);

  return c.json({ success: true, data: briefing });
});

// Generate a new weekly briefing
briefingRoutes.post('/weekly', async (c) => {
  const briefing = await generateWeeklyBriefing();
  await storeBriefing(briefing);
  return c.json({ success: true, data: briefing });
});

// Get latest briefing
briefingRoutes.get('/latest', async (c) => {
  const briefing = await withCache('briefing:latest', 3600, () =>
    generateDailyBriefing(),
  );
  return c.json({ success: true, data: briefing });
});

// Get briefing history
briefingRoutes.get('/history', async (c) => {
  const client = getCacheClient();
  try {
    const raw = await client.lrange(BRIEFING_HISTORY_KEY, 0, 29);
    const briefings = raw.map((r) => JSON.parse(r));
    return c.json({ success: true, data: briefings });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// Get a specific briefing by ID
briefingRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const client = getCacheClient();
  try {
    const raw = await client.lrange(BRIEFING_HISTORY_KEY, 0, 99);
    const briefing = raw.map((r) => JSON.parse(r)).find((b: any) => b.id === id);
    if (!briefing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Briefing not found' } }, 404);
    }
    return c.json({ success: true, data: briefing });
  } catch {
    return c.json({ success: false, error: { code: 'STORAGE_ERROR', message: 'Failed to retrieve briefing' } }, 500);
  }
});

async function storeBriefing(briefing: ThreatBriefing) {
  const client = getCacheClient();
  try {
    await client.lpush(BRIEFING_HISTORY_KEY, JSON.stringify(briefing));
    await client.ltrim(BRIEFING_HISTORY_KEY, 0, 29); // Keep last 30
  } catch (err) {
    console.warn('[Briefings] Failed to store briefing history:', err);
  }
}
```

### Step 4: Dashboard Briefing Widget

```typescript
// apps/web/src/components/dashboard/briefing-card.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, AlertTriangle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch, API_BASE } from '@/lib/api';

interface Briefing {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  executiveSummary: string;
  severity: string;
  recommendations: string[];
  stats: {
    totalAssets: number;
    criticalCVEs: number;
    exploitedCVEs: number;
    attackPaths: number;
  };
  generatedAt: string;
}

export function BriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBriefing = async () => {
    try {
      const data = await apiFetch<Briefing>('/briefings/latest');
      setBriefing(data);
    } catch (error) {
      console.error('Failed to load briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/briefings/daily`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setBriefing(data.data);
    } catch (error) {
      console.error('Failed to regenerate briefing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadBriefing(); }, []);

  const severityColors: Record<string, string> = {
    critical: 'from-threat-500/20 to-threat-500/5 ring-threat-500/20',
    high: 'from-orange-500/20 to-orange-500/5 ring-orange-500/20',
    medium: 'from-warning-500/20 to-warning-500/5 ring-warning-500/20',
    low: 'from-success-500/20 to-success-500/5 ring-success-500/20',
  };

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
        severityColors[briefing.severity] ?? severityColors.medium
      } p-6 ring-1`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08]">
            <FileText className="h-5 w-5 text-slate-200" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{briefing.title}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Generated {new Date(briefing.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={regenerate}
          disabled={refreshing}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Executive Summary */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {briefing.executiveSummary}
      </p>

      {/* Top Recommendations */}
      {briefing.recommendations.length > 0 && (
        <div className="space-y-1.5 mb-4">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Top Recommendations
          </h4>
          {briefing.recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 text-warning-400 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-400">{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* View Full Briefing */}
      <button className="flex items-center gap-1 text-xs font-medium text-primary-300 hover:text-primary-200">
        View full briefing <ChevronRight className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
```

### Step 5: Briefing Scheduler

Add to the API server startup in `apps/api/src/index.ts`:

```typescript
// Schedule daily briefing generation
import { generateDailyBriefing } from '@argus/ai';

// Generate a briefing at startup (after 60s delay for DB connections)
if (env.NODE_ENV === 'production') {
  setTimeout(async () => {
    try {
      await generateDailyBriefing();
      console.info('[Briefings] Initial daily briefing generated');
    } catch (e) {
      console.warn('[Briefings] Failed to generate initial briefing:', e);
    }
  }, 60_000);
}
```

### Step 6: Register Routes

Add to `apps/api/src/routes/v1/index.ts`:

```typescript
import { briefingRoutes } from './briefings';

v1Routes.route('/briefings', briefingRoutes);
```

---

## Rollout Checklist

- [ ] Create `packages/ai/src/briefing.ts` with data gatherer and generator
- [ ] Create `apps/api/src/routes/v1/briefings.ts` with 5 endpoints
- [ ] Register briefing routes in API router
- [ ] Build `BriefingCard` dashboard widget
- [ ] Add briefing widget to dashboard page layout
- [ ] Store briefing history in Valkey (last 30)
- [ ] Add "Regenerate" button to force new briefing
- [ ] Add timestamp tracking for "new since last briefing" delta calculations
- [ ] Consider adding a dedicated `/briefings` page for full history
- [ ] Add notification support (browser notifications for critical briefings)
- [ ] Export `generateDailyBriefing`, `generateWeeklyBriefing` from `@argus/ai`
