import { getNeo4jDriver } from '@argus/graph';
import { PaginationSchema } from '@argus/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const assetsRoutes = new Hono<TenantEnv>();

// ─── List Assets ─────────────────────────────────────────────────

assetsRoutes.get('/', zValidator('query', PaginationSchema), async (c) => {
  const { page, limit } = c.req.valid('query');
  const tenantId = c.get('tenantId');
  const skip = (page - 1) * limit;

  const session = getNeo4jDriver().session();
  try {
    const dataResult = await session.run(
      'MATCH (a:Asset {tenantId: $tenantId}) RETURN a ORDER BY a.criticality SKIP $skip LIMIT $limit',
      { tenantId, skip, limit },
    );
    const countResult = await session.run(
      'MATCH (a:Asset {tenantId: $tenantId}) RETURN count(a) AS total',
      {
        tenantId,
      },
    );

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
  const tenantId = c.get('tenantId');
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run('MATCH (a:Asset {id: $id, tenantId: $tenantId}) RETURN a', {
      id,
      tenantId,
    });
    const record = result.records[0];
    if (!record)
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
        404,
      );

    return c.json({ success: true, data: record.get('a').properties });
  } finally {
    await session.close();
  }
});

// ─── Get Asset Vulnerabilities ───────────────────────────────────

assetsRoutes.get('/:id/vulnerabilities', async (c) => {
  const id = c.req.param('id');
  const tenantId = c.get('tenantId');
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      'MATCH (a:Asset {id: $id, tenantId: $tenantId})-[:HAS_VULNERABILITY]->(c:CVE) RETURN c ORDER BY c.cvss DESC',
      { id, tenantId },
    );
    const cves = result.records.map((r) => r.get('c').properties);
    return c.json({ success: true, data: cves });
  } finally {
    await session.close();
  }
});
