import { z } from 'zod';

// ─── API Response Envelope ───────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

// ─── Pagination ──────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ─── AI Chat ─────────────────────────────────────────────────────

export const AIChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      cypherQuery: z.string().optional(),
      graphData: z.unknown().optional(),
      citations: z.array(z.string()).optional(),
      reasoning: z.string().optional(),
    })
    .optional(),
});

export type AIChatMessage = z.infer<typeof AIChatMessageSchema>;

export const AIChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  context: z
    .object({
      selectedNodes: z.array(z.string()).optional(),
      activeFilters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;

// ─── Threat Brief ────────────────────────────────────────────────

export interface ThreatBrief {
  id: string;
  title: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedAssets: number;
  relatedCVEs: string[];
  recommendations: string[];
  generatedAt: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────

export interface DashboardStats {
  totalAssets: number;
  criticalVulnerabilities: number;
  activeThreatActors: number;
  riskScore: number;
  attackPaths: number;
  recentAlerts: number;
}
