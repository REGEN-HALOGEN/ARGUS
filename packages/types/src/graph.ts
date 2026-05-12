import { z } from 'zod';

// ─── Graph Relationship Types ────────────────────────────────────

export const RelationshipType = z.enum([
  'HAS_VULNERABILITY',
  'EXPLOITS',
  'TARGETS',
  'CONNECTED_TO',
  'CAN_ACCESS',
  'ENABLES_LATERAL_MOVEMENT',
  'USES_TECHNIQUE',
  'HOSTS',
  'MEMBER_OF_ATTACK_CHAIN',
]);

export type RelationshipType = z.infer<typeof RelationshipType>;

// ─── Graph Node ──────────────────────────────────────────────────

export const GraphNodeTypeSchema = z.enum([
  'asset',
  'cve',
  'threat_actor',
  'attack_technique',
  'crown_jewel',
  'user',
]);

export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
  riskScore?: number;
}

// ─── Graph Edge ──────────────────────────────────────────────────

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  properties?: Record<string, unknown>;
  weight?: number;
}

// ─── Graph Data ──────────────────────────────────────────────────

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Attack Path ─────────────────────────────────────────────────

export interface AttackPath {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  riskScore: number;
  mitreTactics: string[];
  description?: string;
}

// ─── Risk Score ──────────────────────────────────────────────────

export const RiskScoreSchema = z.object({
  entityId: z.string(),
  entityType: GraphNodeTypeSchema,
  score: z.number().min(0).max(100),
  factors: z.array(
    z.object({
      name: z.string(),
      weight: z.number(),
      value: z.number(),
      description: z.string().optional(),
    }),
  ),
  calculatedAt: z.string().datetime(),
});

export type RiskScore = z.infer<typeof RiskScoreSchema>;
