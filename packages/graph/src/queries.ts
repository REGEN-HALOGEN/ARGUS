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

// ─── Full-Text CVE Search ────────────────────────────────────────

/**
 * Sanitize user input for Lucene full-text query syntax.
 * Escapes special characters that could cause query parse errors.
 */
function sanitizeLuceneQuery(query: string): string {
  // Escape Lucene special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
  return query.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

export interface CVESearchResult {
  cveId: string;
  description: string;
  severity: string;
  cvss: number;
  exploitedInWild: boolean;
  score: number;
}

/**
 * Search CVEs using Neo4j's built-in full-text index (Lucene-backed).
 * Supports fuzzy matching by appending ~ to each term.
 * Falls back to wildcard search if full-text index is not yet created.
 */
export async function searchCVEsFullText(
  query: string,
  limit = 10,
): Promise<CVESearchResult[]> {
  const session = getSession();
  try {
    // Build a fuzzy Lucene query: each word gets ~ for fuzzy matching
    const sanitized = sanitizeLuceneQuery(query.trim());
    const terms = sanitized.split(/\s+/).filter(Boolean);
    const luceneQuery = terms.map((t) => `${t}~`).join(' ');

    const result = await session.run(
      `CALL db.index.fulltext.queryNodes('cve_fulltext', $query)
       YIELD node, score
       RETURN node, score
       ORDER BY score DESC
       LIMIT $limit`,
      { query: luceneQuery, limit: typeof limit === 'number' ? limit : 10 },
    );

    return result.records.map((record) => {
      const props = record.get('node').properties;
      const score = record.get('score');
      return {
        cveId: props.cveId,
        description: props.description,
        severity: props.severity,
        cvss: typeof props.cvss === 'object' && props.cvss?.toNumber
          ? props.cvss.toNumber()
          : Number(props.cvss ?? 0),
        exploitedInWild: props.exploitedInWild ?? false,
        score: typeof score === 'object' && score?.toNumber
          ? score.toNumber()
          : Number(score ?? 0),
      };
    });
  } catch (error) {
    // Fallback: if full-text index doesn't exist yet, use CONTAINS
    console.warn('[Graph] Full-text search failed, falling back to CONTAINS:', (error as Error).message);
    try {
      const result = await session.run(
        `MATCH (cv:CVE)
         WHERE cv.cveId CONTAINS $query OR toLower(cv.description) CONTAINS toLower($query)
         RETURN cv
         ORDER BY cv.cvss DESC
         LIMIT $limit`,
        { query: query.trim(), limit },
      );

      return result.records.map((record) => {
        const props = record.get('cv').properties;
        return {
          cveId: props.cveId,
          description: props.description,
          severity: props.severity,
          cvss: typeof props.cvss === 'object' && props.cvss?.toNumber
            ? props.cvss.toNumber()
            : Number(props.cvss ?? 0),
          exploitedInWild: props.exploitedInWild ?? false,
          score: 1, // No relevance score for CONTAINS fallback
        };
      });
    } catch (fallbackError) {
      console.error('[Graph] CVE search fallback also failed:', (fallbackError as Error).message);
      return [];
    }
  } finally {
    await session.close();
  }
}
