import { SYSTEM_PROMPTS, USER_PROMPTS, buildPrompt, chat, indexCVE } from '@argus/ai';
import { getCacheClient } from '@argus/cache';
import { fetchCISAKEV } from './fetchers/cisa-kev';
import { extractMitreId, extractTactic, fetchMITRETechniques } from './fetchers/mitre';
import { fetchTopNews } from './fetchers/news';
import { fetchAllNVDCVEs } from './fetchers/nvd';
import {
  batchUpsertCVEs,
  checkEntityPresence,
  markExploitedCVEs,
  upsertTechnique,
} from './writers/neo4j';

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

    // AI Summarization & Entity Extraction
    console.info(`[Ingestion] Analyzing ${news.length} news items...`);
    for (const item of news) {
      try {
        const response = await chat(
          [
            {
              role: 'user',
              content: buildPrompt(USER_PROMPTS.SUMMARIZE_NEWS, {
                title: item.title,
                snippet: item.contentSnippet ?? '',
              }),
            },
          ],
          {
            systemPrompt: SYSTEM_PROMPTS.NEWS_SUMMARY,
            maxTokens: 300,
            temperature: 0.1,
          },
        );

        // Extract JSON using a more robust method
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        item.summary = parsed.summary;
        const entities: string[] = parsed.entities || [];
        item.entities = entities;

        if (entities.length > 0) {
          const matches = await checkEntityPresence(entities);
          item.hasMatch = matches.length > 0;
        }
      } catch (e) {
        console.warn(`[AI-NEWS] Failed to analyze news: ${item.title}`, e);
        item.summary = item.contentSnippet; // Fallback
      }
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

  // Periodic sync only — use POST /api/v1/ingestion/sync for manual trigger
  setInterval(() => runFullSync(), SIX_HOURS);

  console.info(
    '[Ingestion] Scheduler started — syncing every 6 hours (use API to trigger manually)',
  );
}
