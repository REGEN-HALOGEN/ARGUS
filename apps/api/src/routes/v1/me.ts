import { normalizeOrgRole } from '@argus/types';
import { Hono } from 'hono';
import { auth } from '../../auth';
import { getAuthSession } from '../../middleware/auth';
import { AppError } from '../../middleware/error-handler';

export const meRoutes = new Hono();

meRoutes.get('/', async (c) => {
  let session;
  try {
    session = await getAuthSession(c.req.raw.headers);
  } catch (err) {
    // Re-throw AppErrors (e.g. 401) as-is; wrap anything else
    if (err instanceof AppError) throw err;
    console.error('[ME] Session retrieval failed:', err);
    throw new AppError(401, 'SESSION_ERROR', 'Unable to verify session');
  }

  let activeOrganizationId = session.session.activeOrganizationId ?? null;

  // Fetch organizations the user belongs to
  const organizations = await auth.api
    .listOrganizations({ headers: c.req.raw.headers })
    .catch((err: unknown) => {
      console.error('[ME] Failed to list organizations:', err);
      return [];
    });

  // ── Auto-set active organization ───────────────────────────────
  // If the user belongs to organizations but doesn't have one active
  // (happens after fresh login — Better Auth doesn't restore it),
  // automatically activate their first organization.
  if (!activeOrganizationId && Array.isArray(organizations) && organizations.length > 0) {
    const firstOrg = organizations[0];
    try {
      await auth.api.setActiveOrganization({
        headers: c.req.raw.headers,
        body: { organizationId: firstOrg.id },
      });
      activeOrganizationId = firstOrg.id;
      console.log(`[ME] Auto-activated organization ${firstOrg.id} for user ${session.user.id}`);
    } catch (err) {
      console.error('[ME] Failed to auto-set active organization:', err);
    }
  }

  // Fetch the user's role within the active organization
  const activeMember = activeOrganizationId
    ? await auth.api
        .getActiveMember({
          headers: c.req.raw.headers,
          query: { organizationId: activeOrganizationId },
        })
        .catch(() => null)
    : null;

  return c.json({
    success: true,
    data: {
      user: session.user,
      platformRole: session.user.role === 'super_admin' ? 'super_admin' : null,
      activeOrganizationId,
      activeOrgRole: normalizeOrgRole(activeMember?.role),
      rawOrgRole: activeMember?.role ?? null,
      organizations,
    },
  });
});
