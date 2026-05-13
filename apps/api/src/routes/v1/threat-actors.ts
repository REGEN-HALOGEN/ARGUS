import { Hono } from 'hono';
import { getNeo4jDriver } from '@argus/graph';
import { withCache } from '@argus/cache';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const threatActorsRoutes = new Hono<TenantEnv>();

// ─── List Threat Actors ──────────────────────────────────────────

threatActorsRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const data = await withCache(`tenant:${tenantId}:threat-actors:list`, 300, async () => {
    const session = getNeo4jDriver().session();
    try {
      const result = await session.run(`
        MATCH (t:ThreatActor)
        OPTIONAL MATCH (t)-[:EXPLOITS]->(c:CVE)
        OPTIONAL MATCH (t)-[:USES_TECHNIQUE]->(tech:AttackTechnique)
        OPTIONAL MATCH (t)-[:EXPLOITS]->(:CVE)<-[:HAS_VULNERABILITY]-(a:Asset {tenantId: $tenantId})
        RETURN t,
               count(DISTINCT c) AS cveCount,
               count(DISTINCT tech) AS techniqueCount,
               count(DISTINCT a) AS targetedAssets
        ORDER BY t.sophistication, t.name
      `, { tenantId });

      return result.records.map((r) => {
        const props = r.get('t').properties;
        const toNum = (v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as Record<string, unknown>)) ? (v as { toNumber: () => number }).toNumber() : Number(v);
        return {
          ...props,
          cveCount: toNum(r.get('cveCount')),
          techniqueCount: toNum(r.get('techniqueCount')),
          targetedAssets: toNum(r.get('targetedAssets')),
        };
      });
    } finally {
      await session.close();
    }
  });

  return c.json({ success: true, data });
});

// ─── Get Threat Actor ────────────────────────────────────────────

threatActorsRoutes.get('/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'));
  const tenantId = c.get('tenantId');
  try {
    const data = await withCache(`tenant:${tenantId}:threat-actors:${name}`, 300, async () => {
      const session = getNeo4jDriver().session();
      try {
        const result = await session.run(
          `MATCH (t:ThreatActor {name: $name})
           OPTIONAL MATCH (t)-[:EXPLOITS]->(c:CVE)
           OPTIONAL MATCH (t)-[:USES_TECHNIQUE]->(tech:AttackTechnique)
           OPTIONAL MATCH (t)-[:EXPLOITS]->(cv:CVE)<-[:HAS_VULNERABILITY]-(a:Asset {tenantId: $tenantId})
           RETURN t,
                  collect(DISTINCT c {.cveId, .severity, .cvss}) AS cves,
                  collect(DISTINCT tech {.mitreId, .name, .tactic}) AS techniques,
                  collect(DISTINCT a {.hostname, .ip, .role, .criticality}) AS targets`,
          { name, tenantId },
        );

        const record = result.records[0];
        if (!record) return null;

        const toNum = (v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as Record<string, unknown>)) ? (v as { toNumber: () => number }).toNumber() : Number(v);

        return {
          ...record.get('t').properties,
          cves: record.get('cves'),
          techniques: record.get('techniques'),
          targets: record.get('targets').map((target: any) => ({
            ...target,
            criticality: target.criticality !== undefined ? toNum(target.criticality) : undefined
          })),
        };
      } finally {
        await session.close();
      }
    });

    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Threat actor not found' } }, 404);

    return c.json({ success: true, data });
  } catch (error) {
    console.error(`[API Error] /threat-actors/:name for ${name}:`, error);
    throw error;
  }
});
