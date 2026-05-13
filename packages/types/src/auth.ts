export const PLATFORM_ROLES = ['super_admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORG_ROLES = ['org_admin', 'operator', 'analyst', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const LEGACY_ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type LegacyOrgRole = (typeof LEGACY_ORG_ROLES)[number];

export const APP_ROLES = [...PLATFORM_ROLES, ...ORG_ROLES] as const;
export type AppRole = PlatformRole | OrgRole;

export const ORG_ROLE_ALIASES: Record<LegacyOrgRole, OrgRole> = {
  owner: 'org_admin',
  admin: 'org_admin',
  member: 'viewer',
};

export function normalizeOrgRole(role?: string | null): OrgRole | null {
  if (!role) return null;
  if ((ORG_ROLES as readonly string[]).includes(role)) return role as OrgRole;
  if ((LEGACY_ORG_ROLES as readonly string[]).includes(role)) {
    return ORG_ROLE_ALIASES[role as LegacyOrgRole];
  }
  return null;
}

export function isPlatformRole(role?: string | null): role is PlatformRole {
  return Boolean(role && (PLATFORM_ROLES as readonly string[]).includes(role));
}

export function isOrgRole(role?: string | null): role is OrgRole {
  return Boolean(role && (ORG_ROLES as readonly string[]).includes(role));
}
