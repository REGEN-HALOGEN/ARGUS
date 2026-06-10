import { withCache } from '@argus/cache';
import { getNeo4jDriver } from '@argus/graph';
import { Hono } from 'hono';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const dashboardRoutes = new Hono<TenantEnv>();

// ─── Neo4j Connection Health Check ───────────────────────────────

async function verifyNeo4jConnection(): Promise<boolean> {
  try {
    const session = getNeo4jDriver().session();
    try {
      await session.run('RETURN 1 AS ok');
      return true;
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[Dashboard] Neo4j connection check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Helper: run a count query in its own session (with error handling)
async function countQuery(cypher: string, params?: Record<string, unknown>): Promise<number> {
  let session;
  try {
    session = getNeo4jDriver().session();
  } catch (error) {
    console.error('[Dashboard] Failed to create Neo4j session:', error instanceof Error ? error.message : error);
    return 0;
  }

  try {
    const result = await session.run(cypher, params);
    const val = result.records[0]?.get('count');
    return typeof val === 'object' && val?.toNumber ? val.toNumber() : Number(val ?? 0);
  } catch (error) {
    console.error('[Dashboard] countQuery failed:', error instanceof Error ? error.message : error);
    console.error('[Dashboard] Failed Cypher:', cypher);
    return 0;
  } finally {
    try {
      await session.close();
    } catch {
      // Ignore session close errors
    }
  }
}

// ─── Dashboard Stats ─────────────────────────────────────────────

dashboardRoutes.get('/stats', async (c) => {
  const tenantId = c.get('tenantId');

  try {
    const data = await withCache(`dashboard:${tenantId}:stats`, 30, async () => {
      // Run all queries with Promise.allSettled so one failure doesn't kill the others
      const results = await Promise.allSettled([
        countQuery('MATCH (a:Asset {tenantId: $tenantId}) RETURN count(a) AS count', { tenantId }),
        countQuery(
          "MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(c:CVE) WHERE c.severity = 'critical' RETURN count(DISTINCT c) AS count",
          { tenantId },
        ),
        countQuery('MATCH (t:ThreatActor) RETURN count(t) AS count'),
        countQuery(
          'MATCH (:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(c:CVE {exploitedInWild: true}) RETURN count(DISTINCT c) AS count',
          { tenantId },
        ),
        countQuery('MATCH (cj:CrownJewel {tenantId: $tenantId}) RETURN count(cj) AS count', {
          tenantId,
        }),
        countQuery(
          'MATCH (a:Asset {tenantId: $tenantId, internetFacing: true})-[:HAS_VULNERABILITY]->(c:CVE {exploitedInWild: true}) RETURN count(DISTINCT a) AS count',
          { tenantId },
        ),
        countQuery(
          'MATCH path = (entry:Asset {tenantId: $tenantId, internetFacing: true})-[*1..6]->(crown:CrownJewel {tenantId: $tenantId}) RETURN count(path) AS count',
          { tenantId },
        ),
      ]);

      // Extract values, defaulting to 0 for any that failed
      const getValue = (result: PromiseSettledResult<number>): number =>
        result.status === 'fulfilled' ? result.value : 0;

      const totalAssets = getValue(results[0]);
      const criticalVulnerabilities = getValue(results[1]);
      const activeThreatActors = getValue(results[2]);
      const activeExploits = getValue(results[3]);
      const crownJewels = getValue(results[4]);
      const exposedAssetsResult = getValue(results[5]);
      const attackPathsResult = getValue(results[6]);

      // Log any failures for debugging
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.warn(`[Dashboard] Stats query ${i} failed:`, result.reason);
        }
      });

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
  } catch (error) {
    console.error('[Dashboard] /stats endpoint failed:', error instanceof Error ? error.message : error);
    // Return zeroed-out stats instead of 500
    return c.json({
      success: true,
      data: {
        totalAssets: 0,
        criticalVulnerabilities: 0,
        activeThreatActors: 0,
        activeExploits: 0,
        crownJewels: 0,
        riskScore: 0,
      },
    });
  }
});

// ─── Recent Alerts (CVEs with exploits + threat actor activity) ──

dashboardRoutes.get('/alerts', async (c) => {
  const tenantId = c.get('tenantId');

  try {
    const data = await withCache(`dashboard:${tenantId}:alerts`, 30, async () => {
      let session;
      try {
        session = getNeo4jDriver().session();
      } catch (error) {
        console.error('[Dashboard] Failed to create Neo4j session for alerts:', error instanceof Error ? error.message : error);
        return [];
      }

      try {
        const result = await session.run(
          `
          MATCH (cv:CVE)
          OPTIONAL MATCH (t:ThreatActor)-[:EXPLOITS]->(cv)
          OPTIONAL MATCH (a:Asset {tenantId: $tenantId})-[:HAS_VULNERABILITY]->(cv)
          WITH cv, collect(DISTINCT t.name) AS actors, collect(DISTINCT a.hostname) AS assets
          WHERE size(assets) > 0
          RETURN cv, actors, assets
          ORDER BY cv.cvss DESC
          LIMIT 10
        `,
          { tenantId },
        );

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
            cvss:
              typeof cve.cvss === 'object' && cve.cvss?.toNumber
                ? cve.cvss.toNumber()
                : Number(cve.cvss),
            affectedAssets: assets,
            time: 'Recent',
          };
        });
      } catch (error) {
        console.error('[Dashboard] Alerts query failed:', error instanceof Error ? error.message : error);
        return [];
      } finally {
        try {
          await session.close();
        } catch {
          // Ignore session close errors
        }
      }
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[Dashboard] /alerts endpoint failed:', error instanceof Error ? error.message : error);
    return c.json({ success: true, data: [] });
  }
});

// ─── Top Attack Paths ────────────────────────────────────────────

dashboardRoutes.get('/attack-paths', async (c) => {
  const tenantId = c.get('tenantId');

  try {
    const data = await withCache(`dashboard:${tenantId}:attack-paths`, 30, async () => {
      let session;
      try {
        session = getNeo4jDriver().session();
      } catch (error) {
        console.error('[Dashboard] Failed to create Neo4j session for attack-paths:', error instanceof Error ? error.message : error);
        return [];
      }

      try {
        const result = await session.run(
          `
          MATCH path = (entry:Asset {tenantId: $tenantId, internetFacing: true})-[:CAN_ACCESS|CONNECTED_TO|HOSTS*1..6]->(crown:CrownJewel {tenantId: $tenantId})
          WITH path, entry, crown,
               [n IN nodes(path) | COALESCE(n.hostname, n.name, '')] AS nodeNames,
               length(path) AS hops
          WITH path, nodeNames, hops, entry, crown
          OPTIONAL MATCH (a)-[v:HAS_VULNERABILITY]->(c:CVE)
          WHERE a IN nodes(path) AND v.riskScore IS NOT NULL
          WITH nodeNames, hops, entry.hostname AS entryPoint, crown.name AS target,
               COALESCE(max(CASE WHEN v.riskScore IS NOT NULL
                 THEN CASE WHEN v.riskScore.low IS NOT NULL THEN v.riskScore.low ELSE v.riskScore END
                 ELSE 0 END), 0) AS maxRisk,
               count(DISTINCT c) AS vulnCount
          RETURN nodeNames, maxRisk, vulnCount, hops, entryPoint, target
          ORDER BY maxRisk DESC, hops ASC
          LIMIT 5
          `,
          { tenantId },
        );

        return result.records.map((record, i) => {
          const nodeNames = record.get('nodeNames') as string[];
          const maxRisk = record.get('maxRisk');
          const hops = record.get('hops');
          const vulnCount = record.get('vulnCount');
          const riskNum =
            typeof maxRisk === 'object' && maxRisk?.toNumber
              ? maxRisk.toNumber()
              : Number(maxRisk);
          const hopsNum = typeof hops === 'object' && hops?.toNumber ? hops.toNumber() : Number(hops);
          const vulnNum = typeof vulnCount === 'object' && vulnCount?.toNumber ? vulnCount.toNumber() : Number(vulnCount);

          return {
            id: i + 1,
            name: nodeNames.filter(Boolean).join(' \u2192 '),
            risk: Math.max(riskNum, Math.min(100, vulnNum * 15 + hopsNum * 5)),
            nodes: hopsNum + 1,
          };
        });
      } catch (error) {
        console.error('[Dashboard] Attack paths query failed:', error instanceof Error ? error.message : error);
        return [];
      } finally {
        try {
          await session.close();
        } catch {
          // Ignore session close errors
        }
      }
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[Dashboard] /attack-paths endpoint failed:', error instanceof Error ? error.message : error);
    return c.json({ success: true, data: [] });
  }
});
