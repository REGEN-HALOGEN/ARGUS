import { withCache } from '@argus/cache';
import { fetchGraphData } from '@argus/graph';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const graphRoutes = new Hono<TenantEnv>();

// ─── Tenant Boundary Helper ──────────────────────────────────────
// A node is visible to a tenant if:
//   1. node.tenantId = $tenantId  (directly owned by tenant)
//   2. node.tenantId IS NULL      (global/shared, no owner)
//   3. node is connected to a tenant-owned Asset via HAS_VULNERABILITY
//      (handles shared CVEs whose tenantId was overwritten by another
//       tenant's MERGE during onboarding)

// ─── Get Full Graph ──────────────────────────────────────────────

graphRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  try {
    const data = await withCache(`tenant:${tenantId}:graph:full`, 60, () =>
      fetchGraphData(
        `
        CALL {
          // 1. Core Tenant Topology
          MATCH (n)-[r]->(m)
          WHERE n.tenantId = $tenantId AND m.tenantId = $tenantId
          RETURN n, r, m
          
          UNION
          
          // 2. Top 3 CVEs per Asset
          MATCH (n:Asset {tenantId: $tenantId})-[r:HAS_VULNERABILITY]->(m:CVE)
          WITH n, r, m ORDER BY coalesce(r.riskScore, 0) DESC
          WITH n, collect({r: r, m: m})[..3] as topVulns
          UNWIND topVulns as tv
          RETURN n, tv.r as r, tv.m as m
        
          UNION
        
          // 3. Threat Actors exploiting those top CVEs
          MATCH (n:Asset {tenantId: $tenantId})-[rVuln:HAS_VULNERABILITY]->(m:CVE)
          WITH n, rVuln, m ORDER BY coalesce(rVuln.riskScore, 0) DESC
          WITH n, collect(m)[..3] as topCVEs
          UNWIND topCVEs as cve
          MATCH (ta:ThreatActor)-[r:EXPLOITS]->(cve)
          RETURN ta as n, r, cve as m
        
          UNION
        
          // 4. Attack Techniques used by those Threat Actors
          MATCH (n:Asset {tenantId: $tenantId})-[rVuln:HAS_VULNERABILITY]->(m:CVE)
          WITH n, rVuln, m ORDER BY coalesce(rVuln.riskScore, 0) DESC
          WITH n, collect(m)[..3] as topCVEs
          UNWIND topCVEs as cve
          MATCH (ta:ThreatActor)-[:EXPLOITS]->(cve)
          MATCH (ta)-[r:USES_TECHNIQUE]->(tech:AttackTechnique)
          RETURN ta as n, r, tech as m
        }
        RETURN n, r, m
        LIMIT 500
        `,
        { tenantId },
      ),
    );
    return c.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GRAPH] Failed to fetch graph data:', message);
    return c.json({
      success: false,
      error: { code: 'GRAPH_FETCH_ERROR', message },
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
            OR n.tenantId IS NULL
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
              OR n.tenantId IS NULL
              OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(n) }
            )
            AND (
              m.tenantId = $tenantId
              OR m.tenantId IS NULL
              OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(m) }
            )
            AND ALL(x IN nodes(path) WHERE
              x.tenantId = $tenantId
              OR x.tenantId IS NULL
              OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(x) }
            )
          RETURN path
          LIMIT 100
          `,
            { nodeId, tenantId },
          ),
      );
      return c.json({ success: true, data });
    } catch (error) {
      console.error('[Graph] Neighborhood query failed:', error);
      return c.json({ success: false, error: { code: 'GRAPH_QUERY_FAILED', message: 'Failed to load neighborhood data' }, data: { nodes: [], edges: [] } }, 500);
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
      const safeMaxHops = Math.max(1, Math.min(10, Math.floor(Number(body.maxHops))));
      const data = await withCache(
        `tenant:${tenantId}:graph:paths:${body.sourceId}:${body.targetId}:${safeMaxHops}`,
        60,
        () =>
          fetchGraphData(
            `
            MATCH path = (source)-[*1..${safeMaxHops}]->(target)
            WHERE elementId(source) = $sourceId
              AND elementId(target) = $targetId
              AND source.tenantId = $tenantId
              AND target.tenantId = $tenantId
              AND ALL(x IN nodes(path) WHERE
                x.tenantId = $tenantId
                OR x.tenantId IS NULL
                OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(x) }
              )
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
    } catch (error) {
      console.error('[Graph] Attack path query failed:', error);
      return c.json({
        success: false,
        error: { code: 'GRAPH_QUERY_FAILED', message: 'Failed to find attack paths' },
        data: { nodes: [], edges: [], source: body.sourceId, target: body.targetId },
      }, 500);
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
        WHERE ALL(x IN nodes(path) WHERE
          x.tenantId = $tenantId
          OR x.tenantId IS NULL
          OR EXISTS { MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(x) }
        )
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

// reload

