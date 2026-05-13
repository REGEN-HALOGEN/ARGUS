// ─── ARGUS Types ─────────────────────────────────────────────────
// Shared domain models, schemas, and type definitions

// Entities
export {
  AssetSchema,
  CVESchema,
  ThreatActorSchema,
  AttackTechniqueSchema,
  CrownJewelSchema,
  UserSchema,
} from './entities';
export type { Asset, CVE, ThreatActor, AttackTechnique, CrownJewel, User } from './entities';

// Graph
export { RelationshipType, GraphNodeTypeSchema, RiskScoreSchema } from './graph';
export type {
  GraphNodeType,
  GraphNode,
  GraphEdge,
  GraphData,
  AttackPath,
  RiskScore,
} from './graph';

// API
export { PaginationSchema, AIChatMessageSchema, AIChatRequestSchema } from './api';
export type {
  ApiResponse,
  ApiError,
  ApiMeta,
  Pagination,
  AIChatMessage,
  AIChatRequest,
  ThreatBrief,
  DashboardStats,
} from './api';

// Auth
export {
  APP_ROLES,
  LEGACY_ORG_ROLES,
  ORG_ROLE_ALIASES,
  ORG_ROLES,
  PLATFORM_ROLES,
  isOrgRole,
  isPlatformRole,
  normalizeOrgRole,
} from './auth';
export type { AppRole, LegacyOrgRole, OrgRole, PlatformRole } from './auth';
