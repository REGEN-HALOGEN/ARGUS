import { normalizeOrgRole } from '@argus/types';
import { Hono } from 'hono';
import { auth } from '../../auth';
import { getAuthSession } from '../../middleware/auth';

export const meRoutes = new Hono();

meRoutes.get('/', async (c) => {
  const session = await getAuthSession(c.req.raw.headers);
  const activeOrganizationId = session.session.activeOrganizationId ?? null;
  const organizations = await auth.api
    .listOrganizations({ headers: c.req.raw.headers })
    .catch(() => []);
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
