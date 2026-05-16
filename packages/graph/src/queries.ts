import type { GraphData, GraphEdge, GraphNode } from '@argus/types';
import type { Record as Neo4jRecord } from 'neo4j-driver';
import { getSession } from './driver';

// ─── Query Executor ──────────────────────────────────────────────

export async function executeQuery<T = Neo4jRecord>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    return result.records as unknown as T[];
  } finally {
    await session.close();
  }
}

// ─── Read-Only Query (for AI-generated Cypher) ───────────────────

export async function executeReadOnlyQuery(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<Neo4jRecord[]> {
  const session = getSession();
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records;
  } finally {
    await session.close();
  }
}

// ─── Graph Data Fetcher ──────────────────────────────────────────

export async function fetchGraphData(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<GraphData> {
  const records = await executeReadOnlyQuery(cypher, params);

  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  // biome-ignore lint/suspicious/noExplicitAny: Neo4j entities are runtime-shaped.
  const addNode = (v: any) => {
    if (!v?.labels || !v?.properties) return;
    const id = v.elementId ?? v.identity?.toString();
    if (id && !nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        type: mapLabel(v.labels[0]),
        label: v.properties.name ?? v.properties.hostname ?? v.properties.cveId ?? id,
        properties: v.properties,
      });
    }
  };

  // biome-ignore lint/suspicious/noExplicitAny: Neo4j entities are runtime-shaped.
  const addEdge = (v: any) => {
    if (!v?.type || !v?.startNodeElementId) return;
    const id = v.elementId ?? v.identity?.toString();
    if (id && !edgesMap.has(id)) {
      edgesMap.set(id, {
        id,
        source: v.startNodeElementId,
        target: v.endNodeElementId,
        type: v.type,
        properties: v.properties ?? {},
      });
    }
  };

  for (const record of records) {
    for (const value of record.values()) {
      // biome-ignore lint/suspicious/noExplicitAny: Neo4j record values are untyped
      const v = value as any;

      if (v?.segments) {
        for (const segment of v.segments) {
          addNode(segment.start);
          addNode(segment.end);
          addEdge(segment.relationship);
        }
      } else {
        addNode(v);
        addEdge(v);
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}

// ─── Label Mapper ────────────────────────────────────────────────

function mapLabel(label: string): GraphNode['type'] {
  const mapping: Record<string, GraphNode['type']> = {
    Asset: 'asset',
    CVE: 'cve',
    ThreatActor: 'threat_actor',
    AttackTechnique: 'attack_technique',
    CrownJewel: 'crown_jewel',
    User: 'user',
  };
  return mapping[label] ?? 'asset';
}
