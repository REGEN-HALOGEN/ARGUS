import type { Context, Next } from 'hono';
import { isPlatformRole, normalizeOrgRole, type OrgRole, type PlatformRole } from '@argus/types';
import { auth } from '../auth';
import { AppError } from './error-handler';

export type Role = OrgRole | PlatformRole;

type AuthSession = {
  session: {
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    role?: string | null;
  };
};

export async function getAuthSession(headers: Headers): Promise<AuthSession> {
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    const origin = headers.get('origin');
    const isVercel = origin?.endsWith('.vercel.app');
    
    console.warn(`[AUTH-SESSION-FAIL] No session found. Origin: ${origin} | IsVercel: ${isVercel}`);
    
    // If we're on Vercel and it's a known issue, we might want to handle it, 
    // but for now let's just throw a more descriptive error.
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required. Please ensure cookies are enabled.');
  }

  return session as AuthSession;
}

export function getRequestedTenant(c: Context, session: AuthSession): string {
  const tenantId = c.req.header('x-tenant-id') ?? session.session.activeOrganizationId;

  if (!tenantId) {
    throw new AppError(400, 'TENANT_REQUIRED', 'An active organization is required');
  }

  return tenantId;
}

async function getMembership(headers: Headers, tenantId: string) {
  try {
    return await auth.api.getActiveMember({
      headers,
      query: { organizationId: tenantId },
    });
  } catch {
    return null;
  }
}

export async function getTenantContext(c: Context) {
  const session = await getAuthSession(c.req.raw.headers);
  const tenantId = getRequestedTenant(c, session);
  const membership = await getMembership(c.req.raw.headers, tenantId);
  const orgRole = normalizeOrgRole(membership?.role);

  if (!membership || !orgRole) {
    throw new AppError(
      403,
      'TENANT_FORBIDDEN',
      'User is not a member of the requested organization',
    );
  }

  return {
    session,
    tenantId,
    membership,
    orgRole,
    platformRole: isPlatformRole(session.user.role) ? session.user.role : null,
  };
}

export function requireAuth() {
  return async (c: Context, next: Next) => {
    const session = await getAuthSession(c.req.raw.headers);
    const platformRole = isPlatformRole(session.user.role) ? session.user.role : null;

    c.set('userId', session.user.id);
    c.set('platformRole', platformRole);
    c.set('userRole', platformRole);

    await next();
  };
}

export function requireTenant() {
  return async (c: Context, next: Next) => {
    const { session, tenantId, membership, orgRole, platformRole } = await getTenantContext(c);

    c.set('tenantId', tenantId);
    c.set('userId', session.user.id);
    c.set('userRole', orgRole);
    c.set('orgRole', orgRole);
    c.set('platformRole', platformRole);
    c.set('membershipId', membership.id);

    await next();
  };
}

export function requireOrgRole(...roles: OrgRole[]) {
  return async (c: Context, next: Next) => {
    const orgRole = c.get('orgRole') as OrgRole | undefined;

    if (!orgRole || !roles.includes(orgRole)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions', {
        required: roles,
        current: orgRole ?? 'none',
      });
    }

    await next();
  };
}

export function requirePlatformAdmin() {
  return async (c: Context, next: Next) => {
    const session = await getAuthSession(c.req.raw.headers);
    const platformRole = isPlatformRole(session.user.role) ? session.user.role : null;

    if (platformRole !== 'super_admin') {
      throw new AppError(403, 'FORBIDDEN', 'Platform administrator permissions required', {
        required: ['super_admin'],
        current: session.user.role ?? 'none',
      });
    }

    c.set('userId', session.user.id);
    c.set('platformRole', platformRole);
    c.set('userRole', platformRole);

    await next();
  };
}

export const requireRole = requireOrgRole;
