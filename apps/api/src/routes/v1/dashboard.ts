import { Hono } from 'hono';
import { getNeo4jDriver } from '@argus/graph';
import { withCache } from '@argus/cache';

export const dashboardRoutes = new Hono();

// Helper: run a count query in its own session
async function countQuery(cypher: string): Promise<number> {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(cypher);
    const val = result.records[0]?.get('count');
    return typeof val === 'object' && val?.toNumber ? val.toNumber() : Number(val ?? 0);
  } finally {
    await session.close();
  }
}

// ─── Dashboard Stats ─────────────────────────────────────────────

dashboardRoutes.get('/stats', async (c) => {
  const data = await withCache('dashboard:stats', 30, async () => {
    const [
      totalAssets,
      criticalVulnerabilities,
      activeThreatActors,
      activeExploits,
      crownJewels,
      exposedAssetsResult,
      attackPathsResult
    ] = await Promise.all([
      countQuery('MATCH (a:Asset) RETURN count(a) AS count'),
      countQuery("MATCH (c:CVE) WHERE c.severity = 'critical' RETURN count(c) AS count"),
      countQuery('MATCH (t:ThreatActor) RETURN count(t) AS count'),
      countQuery('MATCH (c:CVE) WHERE c.exploitedInWild = true RETURN count(c) AS count'),
      countQuery('MATCH (cj:CrownJewel) RETURN count(cj) AS count'),
      countQuery('MATCH (a:Asset {internetFacing: true})-[:HAS_VULNERABILITY]->(c:CVE {exploitedInWild: true}) RETURN count(DISTINCT a) AS count'),
      countQuery('MATCH path = (entry:Asset {internetFacing: true})-[*1..6]->(crown:CrownJewel) RETURN count(path) AS count'),
    ]);

    // Custom Risk Engine Algorithm
    // Weight parameters
    const W_EXPOSED_ASSET = 15;
    const W_ATTACK_PATH = 25;
    const W_CRITICAL_VULN = 5;
    const W_THREAT_ACTOR = 8;
    
    let rawRisk = 0;
    rawRisk += exposedAssetsResult * W_EXPOSED_ASSET;
    rawRisk += attackPathsResult * W_ATTACK_PATH;
    rawRisk += criticalVulnerabilities * W_CRITICAL_VULN;
    rawRisk += activeThreatActors * W_THREAT_ACTOR;

    // Apply asymptotic curve so it approaches 100 but never exceeds it
    const normalizedRisk = Math.round(100 * (1 - Math.exp(-rawRisk / 100)));

    return {
      totalAssets,
      criticalVulnerabilities,
      activeThreatActors,
      activeExploits,
      crownJewels,
      riskScore: Math.max(10, normalizedRisk), // Ensure a minimum base risk
    };
  });

  return c.json({ success: true, data });
});

// ─── Recent Alerts (CVEs with exploits + threat actor activity) ──

dashboardRoutes.get('/alerts', async (c) => {
  const data = await withCache('dashboard:alerts', 30, async () => {
    const session = getNeo4jDriver().session();
    try {
      const result = await session.run(`
        MATCH (cv:CVE)
        OPTIONAL MATCH (t:ThreatActor)-[:EXPLOITS]->(cv)
        OPTIONAL MATCH (a:Asset)-[:HAS_VULNERABILITY]->(cv)
        WITH cv, collect(DISTINCT t.name) AS actors, collect(DISTINCT a.hostname) AS assets
        RETURN cv, actors, assets
        ORDER BY cv.cvss DESC
        LIMIT 10
      `);

      return result.records.map((record, i) => {
        const cve = record.get('cv').properties;
        const actors = record.get('actors').filter(Boolean);
        const assets = record.get('assets').filter(Boolean);

        return {
          id: i + 1,
          severity: cve.severity,
          title: `${cve.cveId}: ${cve.description}`,
          source: actors.length > 0 ? `Threat Actor: ${actors[0]}` : 'CVE Feed',
          exploited: cve.exploitedInWild,
          cvss: typeof cve.cvss === 'object' && cve.cvss?.toNumber ? cve.cvss.toNumber() : Number(cve.cvss),
          affectedAssets: assets,
          time: 'Recent',
        };
      });
    } finally {
      await session.close();
    }
  });

  return c.json({ success: true, data });
});

// ─── Top Attack Paths ────────────────────────────────────────────

dashboardRoutes.get('/attack-paths', async (c) => {
  const data = await withCache('dashboard:attack-paths', 30, async () => {
    const session = getNeo4jDriver().session();
    try {
      const result = await session.run(`
        MATCH path = (entry:Asset {internetFacing: true})-[rels*1..6]->(crown:CrownJewel)
        WITH path, entry, crown,
             [n IN nodes(path) | COALESCE(n.hostname, n.cveId, n.name, '')] AS nodeNames,
             reduce(score = 0, n IN nodes(path) | score + COALESCE(n.cvss, 0)) AS pathRisk,
             length(path) AS hops
        RETURN nodeNames, pathRisk, hops, entry.hostname AS entryPoint, crown.name AS target
        ORDER BY pathRisk DESC
        LIMIT 5
      `);

      return result.records.map((record, i) => {
        const nodeNames = record.get('nodeNames') as string[];
        const pathRisk = record.get('pathRisk');
        const hops = record.get('hops');
        const riskNum = typeof pathRisk === 'object' && pathRisk?.toNumber ? pathRisk.toNumber() : Number(pathRisk);
        const hopsNum = typeof hops === 'object' && hops?.toNumber ? hops.toNumber() : Number(hops);

        const normalizedRisk = Math.min(100, Math.round((riskNum / 20) * 100));

        return {
          id: i + 1,
          name: nodeNames.filter(Boolean).join(' \u2192 '),
          risk: normalizedRisk,
          nodes: hopsNum + 1,
        };
      });
    } finally {
      await session.close();
    }
  });

  return c.json({ success: true, data });
});
