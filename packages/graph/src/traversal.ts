import type { AttackPath, GraphData } from '@argus/types';
import { executeReadOnlyQuery, fetchGraphData } from './queries';

// ─── Defensive Sanitization ──────────────────────────────────────
// Neo4j Cypher does not support parameterized variable-length path
// expressions (*1..$param), so we must interpolate. This helper
// guarantees the value is a safe, bounded integer to prevent injection.

function sanitizeHops(value: unknown, min = 1, max = 10): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizeLimit(value: unknown, min = 1, max = 100): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ─── Shortest Path ───────────────────────────────────────────────

export async function findShortestPath(
  sourceId: string,
  targetId: string,
  maxHops = 10,
): Promise<GraphData> {
  const safeMaxHops = sanitizeHops(maxHops, 1, 15);
  const cypher = `
    MATCH path = shortestPath(
      (source)-[*..${safeMaxHops}]->(target)
    )
    WHERE elementId(source) = $sourceId
      AND elementId(target) = $targetId
    RETURN path
    LIMIT 1
  `;

  return fetchGraphData(cypher, { sourceId, targetId });
}

// ─── All Paths ───────────────────────────────────────────────────

export async function findAllPaths(
  sourceId: string,
  targetId: string,
  maxHops = 6,
  limit = 10,
): Promise<GraphData> {
  const safeMaxHops = sanitizeHops(maxHops, 1, 10);
  const safeLimit = sanitizeLimit(limit, 1, 50);
  const cypher = `
    MATCH path = (source)-[*..${safeMaxHops}]->(target)
    WHERE elementId(source) = $sourceId
      AND elementId(target) = $targetId
    RETURN path
    LIMIT ${safeLimit}
  `;

  return fetchGraphData(cypher, { sourceId, targetId });
}

// ─── Attack Paths to Crown Jewels ────────────────────────────────

export async function findAttackPathsToCrownJewels(maxHops = 8, limit = 20): Promise<AttackPath[]> {
  const safeMaxHops = sanitizeHops(maxHops, 1, 10);
  const safeLimit = sanitizeLimit(limit, 1, 50);
  const cypher = `
    MATCH path = (entry:Asset {internetFacing: true})-[*..${safeMaxHops}]->(crown:CrownJewel)
    WITH path, 
         reduce(score = 0, n IN nodes(path) | score + COALESCE(n.cvss, 0)) AS pathRisk,
         [r IN relationships(path) | type(r)] AS relTypes,
         [n IN nodes(path) | elementId(n)] AS pathNodeIds
    RETURN path, pathRisk, relTypes, pathNodeIds
    ORDER BY pathRisk DESC
    LIMIT ${safeLimit}
  `;

  const records = await executeReadOnlyQuery(cypher, {});

  const paths: AttackPath[] = [];

  for (const record of records) {
    // Extract actual node IDs from the path for the detail query
    const pathNodeIds = record.get('pathNodeIds') as string[];

    const graphData = pathNodeIds.length > 0
      ? await fetchGraphData(
          'MATCH (a)-[r]->(b) WHERE elementId(a) IN $nodeIds OR elementId(b) IN $nodeIds RETURN a, r, b LIMIT 100',
          { nodeIds: pathNodeIds },
        )
      : { nodes: [], edges: [] };

    paths.push({
      id: `path-${paths.length}`,
      name: `Attack Path ${paths.length + 1}`,
      nodes: graphData.nodes,
      edges: graphData.edges,
      riskScore: (record.get('pathRisk') as number) ?? 0,
      mitreTactics: [],
    });
  }

  return paths;
}

// ─── Neighborhood Query ──────────────────────────────────────────

export async function getNeighborhood(nodeId: string, depth = 2, limit = 50): Promise<GraphData> {
  const safeDepth = sanitizeHops(depth, 1, 5);
  const safeLimit = sanitizeLimit(limit, 1, 100);
  const cypher = `
    MATCH path = (center)-[*1..${safeDepth}]-(neighbor)
    WHERE elementId(center) = $nodeId
    RETURN path
    LIMIT ${safeLimit}
  `;

  return fetchGraphData(cypher, { nodeId });
}

// ─── Lateral Movement Paths ──────────────────────────────────────

export async function findLateralMovementPaths(
  entryPointId: string,
  maxHops = 6,
): Promise<GraphData> {
  const safeMaxHops = sanitizeHops(maxHops, 1, 8);
  const cypher = `
    MATCH path = (entry)-[:CONNECTED_TO|CAN_ACCESS|ENABLES_LATERAL_MOVEMENT*1..${safeMaxHops}]->(target)
    WHERE elementId(entry) = $entryPointId
    RETURN path
    LIMIT 30
  `;

  return fetchGraphData(cypher, { entryPointId });
}
