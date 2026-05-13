import { ORG_ROLES } from '@argus/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../../auth';
import { requireOrgRole } from '../../middleware/auth';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const organizationRoutes = new Hono<TenantEnv>();

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default('viewer'),
  resend: z.boolean().optional(),
});

const UpdateMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ORG_ROLES),
});

organizationRoutes.get('/current', async (c) => {
  const organization = await auth.api.getFullOrganization({
    headers: c.req.raw.headers,
    query: { organizationId: c.get('tenantId') },
  });

  return c.json({ success: true, data: organization });
});

organizationRoutes.get('/members', requireOrgRole('operator', 'org_admin'), async (c) => {
  const members = await auth.api.listMembers({
    headers: c.req.raw.headers,
    query: {
      organizationId: c.get('tenantId'),
      limit: c.req.query('limit') ?? '50',
      offset: c.req.query('offset') ?? '0',
    },
  });

  return c.json({ success: true, data: members });
});

organizationRoutes.post(
  '/invites',
  requireOrgRole('org_admin'),
  zValidator('json', InviteMemberSchema),
  async (c) => {
    const body = c.req.valid('json');
    const invitation = await auth.api.createInvitation({
      headers: c.req.raw.headers,
      body: {
        ...body,
        organizationId: c.get('tenantId'),
      },
    });

    return c.json({ success: true, data: invitation });
  },
);

organizationRoutes.patch(
  '/members/role',
  requireOrgRole('org_admin'),
  zValidator('json', UpdateMemberRoleSchema),
  async (c) => {
    const body = c.req.valid('json');
    const member = await auth.api.updateMemberRole({
      headers: c.req.raw.headers,
      body: {
        ...body,
        organizationId: c.get('tenantId'),
      },
    });

    return c.json({ success: true, data: member });
  },
);
