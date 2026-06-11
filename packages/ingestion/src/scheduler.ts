import { getCacheClient } from '@argus/cache';
import { getNeo4jDriver } from '@argus/graph';
import { fetchCISAKEV } from './fetchers/cisa-kev';
import { extractMitreId, extractTactic, fetchMITRETechniques } from './fetchers/mitre';
import { fetchTopNews } from './fetchers/news';
import { fetchAllNVDCVEs } from './fetchers/nvd';
import {
  batchUpsertCVEs,
  markExploitedCVEs,
  upsertTechnique,
} from './writers/neo4j';

export async function autoLinkCVEsToAssets(cves: any[]) {
  const session = getNeo4jDriver().session();
  try {
    for (const cve of cves) {
      const desc = (cve.description || '').toLowerCase();
      // Match servers by OS
      const osList = ['ubuntu', 'windows', 'debian', 'rhel', 'centos', 'amazon linux'];
      for (const os of osList) {
        if (desc.includes(os)) {
          const cvss = Number(cve.cvss || 0);
          await session.run(
            `MATCH (s:Asset {type: 'server'})
             WHERE toLower(s.os) CONTAINS $os
             MATCH (c:CVE {cveId: $cveId})
             MERGE (s)-[r:HAS_VULNERABILITY]->(c)
             SET r.riskScore = $riskScore, r.riskRating = $riskRating`,
            {
              os,
              cveId: cve.cveId,
              riskScore: Math.min(100, Math.round(cvss * 10)),
              riskRating: cve.severity || (cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low'),
            }
          );
        }
      }
      
      // Match databases by DB type/purpose
      const dbList = ['postgresql', 'mongodb', 'mysql', 'redis'];
      for (const db of dbList) {
        if (desc.includes(db)) {
          const cvss = Number(cve.cvss || 0);
          await session.run(
            `MATCH (s:Asset {type: 'database'})
             WHERE toLower(s.dbType) CONTAINS $db OR toLower(s.purpose) CONTAINS $db
             MATCH (c:CVE {cveId: $cveId})
             MERGE (s)-[r:HAS_VULNERABILITY]->(c)
             SET r.riskScore = $riskScore, r.riskRating = $riskRating`,
            {
              db,
              cveId: cve.cveId,
              riskScore: Math.min(100, Math.round(cvss * 10)),
              riskRating: cve.severity || (cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low'),
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('[Ingestion] Failed to auto-link CVEs to assets:', error);
  } finally {
    await session.close();
  }
}

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

    // Auto-link newly fetched CVEs to assets
    await autoLinkCVEsToAssets(cves);

    // CVEs are automatically indexed by Neo4j's full-text index (cve_fulltext)

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

    return {
      source: 'MITRE',
      itemsSynced: techniques.length,
      errors,
      duration: Date.now() - start,
    };
  } catch (e) {
    errors.push((e as Error).message);
    return { source: 'MITRE', itemsSynced: 0, errors, duration: Date.now() - start };
  }
}

export async function syncNews(): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const news = await fetchTopNews(10);

    // Skip AI summarization during background ingestion to preserve Gemini quota.
    // AI summarization will only be triggered by explicit user prompts in the Analyst.
    console.info(`[Ingestion] Fetching 10 news items (skipping background AI analysis)...`);
    for (const item of news) {
      item.summary = item.contentSnippet;
    }

    const client = getCacheClient();

    if (client.status === 'ready') {
      // Cache for 6 hours
      await client.setex('cache:news:top10', 6 * 60 * 60, JSON.stringify(news));
    } else {
      errors.push('Cache client not ready');
    }

    return { source: 'News', itemsSynced: news.length, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push((e as Error).message);
    return { source: 'News', itemsSynced: 0, errors, duration: Date.now() - start };
  }
}

// Master sync: runs all sources
export async function runFullSync(): Promise<SyncResult[]> {
  console.info('[Ingestion] Starting full sync...');
  const results = await Promise.allSettled([syncNVD(), syncCISAKEV(), syncMITRE(), syncNews()]);

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: 'Unknown', itemsSynced: 0, errors: [String(r.reason)], duration: 0 },
  );
}

// Schedule periodic sync (every 6 hours)
export function startScheduler() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const STARTUP_DELAY = 30_000; // 30s — let DB connections establish first

  // Initial sync after startup delay
  setTimeout(() => {
    console.info('[Ingestion] Running initial sync after startup...');
    runFullSync().catch((err) =>
      console.error('[Ingestion] Initial sync failed:', err),
    );
  }, STARTUP_DELAY);

  // Periodic sync only — use POST /api/v1/ingestion/sync for manual trigger
  setInterval(() => runFullSync(), SIX_HOURS);

  console.info(
    '[Ingestion] Scheduler started — initial sync in 30s, then every 6 hours (use API to trigger manually)',
  );
}
