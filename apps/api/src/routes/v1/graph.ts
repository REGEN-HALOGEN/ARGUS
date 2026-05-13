import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { fetchGraphData } from '@argus/graph';
import { withCache } from '@argus/cache';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const graphRoutes = new Hono<TenantEnv>();

// ─── Get Full Graph ──────────────────────────────────────────────

graphRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  try {
    const data = await withCache(`tenant:${tenantId}:graph:full`, 60, () =>
      fetchGraphData(
        `
        MATCH (n)-[r]->(m)
        WHERE n.tenantId = $tenantId
           OR m.tenantId = $tenantId
           OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(n) }
           OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(m) }
        RETURN n, r, m
        LIMIT 200
        `,
        { tenantId },
      ),
    );
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({
      success: true,
      data: { nodes: [], edges: [] },
    });
  }
});

// ─── Get Node by ID ──────────────────────────────────────────────

graphRoutes.get('/node/:nodeId', async (c) => {
  const nodeId = c.req.param('nodeId');
  const tenantId = c.get('tenantId');
  try {
    const data = await withCache(`tenant:${tenantId}:graph:node:${nodeId}`, 60, () =>
      fetchGraphData(
        `
        MATCH (n)
        WHERE elementId(n) = $nodeId
          AND (
            n.tenantId = $tenantId
            OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(n) }
          )
        RETURN n
        `,
        { nodeId, tenantId },
      ),
    );
    if (data.nodes.length === 0) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } },
        404,
      );
    }
    return c.json({ success: true, data: data.nodes[0] });
  } catch {
    return c.json(
      { success: false, error: { code: 'QUERY_ERROR', message: 'Failed to fetch node' } },
      500,
    );
  }
});

// ─── Get Neighborhood ────────────────────────────────────────────

graphRoutes.get(
  '/node/:nodeId/neighborhood',
  zValidator(
    'query',
    z.object({
      depth: z.coerce.number().int().min(1).max(5).default(2),
    }),
  ),
  async (c) => {
    const nodeId = c.req.param('nodeId');
    const tenantId = c.get('tenantId');
    const { depth } = c.req.valid('query');
    try {
      const data = await withCache(
        `tenant:${tenantId}:graph:node:${nodeId}:neighborhood:${depth}`,
        60,
        () =>
          fetchGraphData(
            `
          MATCH path = (n)-[*1..${depth}]-(m)
          WHERE elementId(n) = $nodeId
            AND (
              n.tenantId = $tenantId
              OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(n) }
            )
            AND (
              m.tenantId = $tenantId
              OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(m) }
            )
          RETURN path
          LIMIT 100
          `,
            { nodeId, tenantId },
          ),
      );
      return c.json({ success: true, data });
    } catch {
      return c.json({ success: true, data: { nodes: [], edges: [] } });
    }
  },
);

// ─── Find Attack Paths (specific source → target) ────────────────

graphRoutes.post(
  '/attack-paths',
  zValidator(
    'json',
    z.object({
      sourceId: z.string(),
      targetId: z.string(),
      maxHops: z.number().int().min(1).max(10).default(6),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    try {
      const data = await withCache(
        `tenant:${tenantId}:graph:paths:${body.sourceId}:${body.targetId}:${body.maxHops}`,
        60,
        () =>
          fetchGraphData(
            `
            MATCH path = (source)-[*1..${body.maxHops}]->(target)
            WHERE elementId(source) = $sourceId
              AND elementId(target) = $targetId
              AND source.tenantId = $tenantId
              AND target.tenantId = $tenantId
            RETURN path
            LIMIT 50
            `,
            { sourceId: body.sourceId, targetId: body.targetId, tenantId },
          ),
      );
      return c.json({
        success: true,
        data: {
          ...data,
          source: body.sourceId,
          target: body.targetId,
        },
      });
    } catch {
      return c.json({
        success: true,
        data: { nodes: [], edges: [], source: body.sourceId, target: body.targetId },
      });
    }
  },
);

// ─── Find Attack Paths to Crown Jewels ───────────────────────────

graphRoutes.get('/attack-paths/crown-jewels', async (c) => {
  const tenantId = c.get('tenantId');
  try {
    const paths = await withCache(`tenant:${tenantId}:graph:paths:crown-jewels`, 60, () =>
      fetchGraphData(
        `
        MATCH path = (entry:Asset {tenantId: $tenantId, internetFacing: true})-[*1..8]->(crown:CrownJewel {tenantId: $tenantId})
        RETURN path
        LIMIT 10
        `,
        { tenantId },
      ),
    );
    return c.json({ success: true, data: paths });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
