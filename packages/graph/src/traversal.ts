import type { AttackPath, GraphData } from '@argus/types';
import { executeReadOnlyQuery, fetchGraphData } from './queries';

// ─── Shortest Path ───────────────────────────────────────────────

export async function findShortestPath(
  sourceId: string,
  targetId: string,
  maxHops = 10,
): Promise<GraphData> {
  const cypher = `
    MATCH path = shortestPath(
      (source)-[*..${maxHops}]->(target)
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
  const cypher = `
    MATCH path = (source)-[*..${maxHops}]->(target)
    WHERE elementId(source) = $sourceId
      AND elementId(target) = $targetId
    RETURN path
    LIMIT ${limit}
  `;

  return fetchGraphData(cypher, { sourceId, targetId });
}

// ─── Attack Paths to Crown Jewels ────────────────────────────────

export async function findAttackPathsToCrownJewels(maxHops = 8, limit = 20): Promise<AttackPath[]> {
  const cypher = `
    MATCH path = (entry:Asset {internetFacing: true})-[*..${maxHops}]->(crown:CrownJewel)
    WITH path, 
         reduce(score = 0, n IN nodes(path) | score + COALESCE(n.cvss, 0)) AS pathRisk,
         [r IN relationships(path) | type(r)] AS relTypes
    RETURN path, pathRisk, relTypes
    ORDER BY pathRisk DESC
    LIMIT ${limit}
  `;

  const records = await executeReadOnlyQuery(cypher, {});

  const paths: AttackPath[] = [];

  for (const record of records) {
    const graphData = await fetchGraphData(
      'MATCH path = (a)-[r]->(b) WHERE elementId(a) IN $nodeIds OR elementId(b) IN $nodeIds RETURN a, r, b LIMIT 100',
      { nodeIds: [] },
    );

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
  const cypher = `
    MATCH path = (center)-[*1..${depth}]-(neighbor)
    WHERE elementId(center) = $nodeId
    RETURN path
    LIMIT ${limit}
  `;

  return fetchGraphData(cypher, { nodeId });
}

// ─── Lateral Movement Paths ──────────────────────────────────────

export async function findLateralMovementPaths(
  entryPointId: string,
  maxHops = 6,
): Promise<GraphData> {
  const cypher = `
    MATCH path = (entry)-[:CONNECTED_TO|CAN_ACCESS|ENABLES_LATERAL_MOVEMENT*1..${maxHops}]->(target)
    WHERE elementId(entry) = $entryPointId
    RETURN path
    LIMIT 30
  `;

  return fetchGraphData(cypher, { entryPointId });
}
