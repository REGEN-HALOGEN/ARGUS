import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PaginationSchema } from '@argus/types';
import { getNeo4jDriver } from '@argus/graph';

export const assetsRoutes = new Hono();

// ─── List Assets ─────────────────────────────────────────────────

assetsRoutes.get('/', zValidator('query', PaginationSchema), async (c) => {
  const { page, limit } = c.req.valid('query');
  const skip = (page - 1) * limit;

  const session = getNeo4jDriver().session();
  try {
    const dataResult = await session.run(
      `MATCH (a:Asset) RETURN a ORDER BY a.criticality SKIP ${skip} LIMIT ${limit}`,
    );
    const countResult = await session.run('MATCH (a:Asset) RETURN count(a) AS total');

    const assets = dataResult.records.map((r) => r.get('a').properties);
    const total = countResult.records[0]?.get('total')?.toNumber?.() ?? 0;

    return c.json({
      success: true,
      data: assets,
      meta: { page, limit, total, hasMore: skip + limit < total },
    });
  } finally {
    await session.close();
  }
});

// ─── Get Asset ───────────────────────────────────────────────────

assetsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run('MATCH (a:Asset {id: $id}) RETURN a', { id });
    const record = result.records[0];
    if (!record) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } }, 404);

    return c.json({ success: true, data: record.get('a').properties });
  } finally {
    await session.close();
  }
});

// ─── Get Asset Vulnerabilities ───────────────────────────────────

assetsRoutes.get('/:id/vulnerabilities', async (c) => {
  const id = c.req.param('id');
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      'MATCH (a:Asset {id: $id})-[:HAS_VULNERABILITY]->(c:CVE) RETURN c ORDER BY c.cvss DESC',
      { id },
    );
    const cves = result.records.map((r) => r.get('c').properties);
    return c.json({ success: true, data: cves });
  } finally {
    await session.close();
  }
});
