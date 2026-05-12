import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PaginationSchema } from '@argus/types';
import { getNeo4jDriver } from '@argus/graph';
import { withCache } from '@argus/cache';
import { searchCVEs } from '@argus/ai';

export const cveRoutes = new Hono();

// ─── List CVEs ───────────────────────────────────────────────────

cveRoutes.get('/', zValidator('query', PaginationSchema), async (c) => {
  const { page, limit } = c.req.valid('query');
  const skip = (page - 1) * limit;

  const data = await withCache(`cve:list:${page}:${limit}`, 300, async () => {
    const session = getNeo4jDriver().session();
    try {
      const dataResult = await session.run(
        `MATCH (cv:CVE)
         OPTIONAL MATCH (a:Asset)-[:HAS_VULNERABILITY]->(cv)
         WITH cv, count(a) AS affectedCount
         RETURN cv, affectedCount
         ORDER BY cv.cvss DESC
         SKIP ${skip} LIMIT ${limit}`,
      );
      const countResult = await session.run('MATCH (c:CVE) RETURN count(c) AS total');

      const cves = dataResult.records.map((r) => {
        const props = r.get('cv').properties;
        const affected = r.get('affectedCount');
        return {
          ...props,
          affectedAssets: typeof affected === 'object' && affected?.toNumber ? affected.toNumber() : Number(affected),
        };
      });

      const total = countResult.records[0]?.get('total')?.toNumber?.() ?? 0;

      return { cves, total };
    } finally {
      await session.close();
    }
  });

  return c.json({
    success: true,
    data: data.cves,
    meta: { page, limit, total: data.total, hasMore: skip + limit < data.total },
  });
});

// ─── Semantic Search CVEs ────────────────────────────────────────

cveRoutes.get('/semantic-search', async (c) => {
  const query = c.req.query('q') ?? '';
  if (!query) return c.json({ success: true, data: [], meta: { query } });

  const cves = await withCache(`cve:semantic:${query}`, 300, async () => {
    const qdrantResults = await searchCVEs(query, 5);
    return qdrantResults.map(r => r.payload);
  });

  return c.json({ success: true, data: cves, meta: { query } });
});

// ─── Get CVE ─────────────────────────────────────────────────────

cveRoutes.get('/:cveId', async (c) => {
  const cveId = c.req.param('cveId');
  const data = await withCache(`cve:${cveId}`, 300, async () => {
    const session = getNeo4jDriver().session();
    try {
      const result = await session.run(
        `MATCH (cv:CVE {cveId: $cveId})
         OPTIONAL MATCH (a:Asset)-[:HAS_VULNERABILITY]->(cv)
         OPTIONAL MATCH (t:ThreatActor)-[:EXPLOITS]->(cv)
         RETURN cv, collect(DISTINCT a.hostname) AS assets, collect(DISTINCT t.name) AS actors`,
        { cveId },
      );
      const record = result.records[0];
      if (!record) return null;

      return {
        ...record.get('cv').properties,
        affectedAssets: record.get('assets').filter(Boolean),
        exploitedBy: record.get('actors').filter(Boolean),
      };
    } finally {
      await session.close();
    }
  });

  if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'CVE not found' } }, 404);

  return c.json({ success: true, data });
});

// ─── Search CVEs ─────────────────────────────────────────────────

cveRoutes.get('/search', async (c) => {
  const query = c.req.query('q') ?? '';
  if (!query) return c.json({ success: true, data: [], meta: { query } });

  const cves = await withCache(`cve:search:${query}`, 300, async () => {
    const session = getNeo4jDriver().session();
    try {
      const result = await session.run(
        `MATCH (cv:CVE)
         WHERE cv.cveId CONTAINS $query OR toLower(cv.description) CONTAINS toLower($query)
         OPTIONAL MATCH (a:Asset)-[:HAS_VULNERABILITY]->(cv)
         WITH cv, count(a) AS affectedCount
         RETURN cv, affectedCount
         ORDER BY cv.cvss DESC
         LIMIT 20`,
        { query },
      );

      return result.records.map((r) => {
        const props = r.get('cv').properties;
        const affected = r.get('affectedCount');
        return {
          ...props,
          affectedAssets: typeof affected === 'object' && affected?.toNumber ? affected.toNumber() : Number(affected),
        };
      });
    } finally {
      await session.close();
    }
  });

  return c.json({ success: true, data: cves, meta: { query } });
});
