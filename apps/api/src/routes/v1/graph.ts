import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { fetchGraphData, getNeighborhood, findAllPaths, findAttackPathsToCrownJewels } from '@argus/graph';
import { withCache } from '@argus/cache';

export const graphRoutes = new Hono();

// ─── Get Full Graph ──────────────────────────────────────────────

graphRoutes.get('/', async (c) => {
  try {
    const data = await withCache('graph:full', 60, () =>
      fetchGraphData('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 200')
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
  try {
    const data = await withCache(`graph:node:${nodeId}`, 60, () =>
      fetchGraphData(
        'MATCH (n) WHERE elementId(n) = $nodeId RETURN n',
        { nodeId },
      )
    );
    if (data.nodes.length === 0) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } }, 404);
    }
    return c.json({ success: true, data: data.nodes[0] });
  } catch {
    return c.json({ success: false, error: { code: 'QUERY_ERROR', message: 'Failed to fetch node' } }, 500);
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
    const { depth } = c.req.valid('query');
    try {
      const data = await withCache(`graph:node:${nodeId}:neighborhood:${depth}`, 60, () =>
        getNeighborhood(nodeId, depth)
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
    try {
      const data = await withCache(
        `graph:paths:${body.sourceId}:${body.targetId}:${body.maxHops}`,
        60,
        () => findAllPaths(body.sourceId, body.targetId, body.maxHops)
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
      return c.json({ success: true, data: { nodes: [], edges: [], source: body.sourceId, target: body.targetId } });
    }
  },
);

// ─── Find Attack Paths to Crown Jewels ───────────────────────────

graphRoutes.get('/attack-paths/crown-jewels', async (c) => {
  try {
    const paths = await withCache('graph:paths:crown-jewels', 60, () =>
      findAttackPathsToCrownJewels(8, 10)
    );
    return c.json({ success: true, data: paths });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
