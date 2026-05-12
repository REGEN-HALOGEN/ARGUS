import { z } from 'zod';

// ─── Asset ───────────────────────────────────────────────────────

export const AssetSchema = z.object({
  id: z.string().uuid(),
  hostname: z.string().min(1),
  ip: z.string().ip().optional(),
  type: z.enum(['server', 'workstation', 'network_device', 'cloud_instance', 'container', 'database', 'application']),
  internetFacing: z.boolean().default(false),
  criticality: z.enum(['critical', 'high', 'medium', 'low']),
  os: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Asset = z.infer<typeof AssetSchema>;

// ─── CVE ─────────────────────────────────────────────────────────

export const CVESchema = z.object({
  id: z.string().uuid(),
  cveId: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'none']),
  cvss: z.number().min(0).max(10),
  exploitedInWild: z.boolean().default(false),
  description: z.string(),
  publishedDate: z.string().datetime(),
  affectedProducts: z.array(z.string()).default([]),
});

export type CVE = z.infer<typeof CVESchema>;

// ─── Threat Actor ────────────────────────────────────────────────

export const ThreatActorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  country: z.string().optional(),
  sophistication: z.enum(['advanced', 'intermediate', 'basic']),
  motivation: z.enum(['espionage', 'financial', 'hacktivism', 'destruction', 'unknown']).default('unknown'),
  targets: z.array(z.string()).default([]),
  firstSeen: z.string().datetime().optional(),
  lastSeen: z.string().datetime().optional(),
});

export type ThreatActor = z.infer<typeof ThreatActorSchema>;

// ─── Attack Technique ────────────────────────────────────────────

export const AttackTechniqueSchema = z.object({
  id: z.string().uuid(),
  techniqueId: z.string(),
  mitreId: z.string().regex(/^T\d{4}(\.\d{3})?$/),
  tactic: z.enum([
    'reconnaissance',
    'resource_development',
    'initial_access',
    'execution',
    'persistence',
    'privilege_escalation',
    'defense_evasion',
    'credential_access',
    'discovery',
    'lateral_movement',
    'collection',
    'command_and_control',
    'exfiltration',
    'impact',
  ]),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type AttackTechnique = z.infer<typeof AttackTechniqueSchema>;

// ─── Crown Jewel ─────────────────────────────────────────────────

export const CrownJewelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  importance: z.enum(['critical', 'high', 'medium']),
  businessImpact: z.enum(['catastrophic', 'major', 'moderate']),
  dataClassification: z.enum(['top_secret', 'secret', 'confidential', 'internal', 'public']).default('internal'),
});

export type CrownJewel = z.infer<typeof CrownJewelSchema>;

// ─── User ────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  email: z.string().email(),
  privilegeLevel: z.enum(['admin', 'analyst', 'viewer']),
  displayName: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});

export type User = z.infer<typeof UserSchema>;
