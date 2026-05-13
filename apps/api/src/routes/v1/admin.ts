import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../../auth';
import { getAuthDbPool } from '../../auth-db-pool';

export const adminRoutes = new Hono();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8).optional(),
  role: z.enum(['user', 'super_admin']).default('user'),
});

const SetUserRoleSchema = z.object({
  role: z.enum(['user', 'super_admin']),
});

adminRoutes.get('/users', async (c) => {
  const query = {
    limit: c.req.query('limit') ?? '50',
    offset: c.req.query('offset') ?? '0',
    searchValue: c.req.query('search'),
    searchField: c.req.query('search') ? 'email' : undefined,
    searchOperator: c.req.query('search') ? 'contains' : undefined,
  };

  const users = await auth.api.listUsers({
    headers: c.req.raw.headers,
    query,
  });

  return c.json({ success: true, data: users });
});

adminRoutes.get('/organizations', async (c) => {
  try {
    console.log('[ADMIN] Fetching organizations...');
    const allOrganizations = await auth.api.listOrganizations({
      headers: c.req.raw.headers,
      query: {
        limit: c.req.query('limit') ?? '100',
        offset: c.req.query('offset') ?? '0',
      },
    });

    console.log('[ADMIN] Organizations result:', {
      isArray: Array.isArray(allOrganizations),
      length: Array.isArray(allOrganizations) ? allOrganizations.length : 'N/A',
      data: allOrganizations,
    });

    const pool = getAuthDbPool();

    const orgsWithMembers = await Promise.all(
      (allOrganizations ?? []).map(async (org: { id: string }) => {
        try {
          const { rows: members } = await pool.query<{
            id: string;
            userId: string;
            organizationId: string;
            role: string;
            name: string | null;
            email: string | null;
          }>(
            `SELECT m.id, m."userId", m."organizationId", m.role, u.name, u.email
             FROM "member" m
             LEFT JOIN "user" u ON m."userId" = u.id
             WHERE m."organizationId" = $1
             ORDER BY m."createdAt" ASC`,
            [org.id],
          );

          console.log(`[ADMIN] Found ${members.length} members for org ${org.id}`);

          return {
            ...org,
            memberCount: members.length,
            members: members.map((m) => ({
              id: m.id,
              userId: m.userId,
              organizationId: m.organizationId,
              role: m.role,
              user: { name: m.name, email: m.email },
            })),
          };
        } catch (err) {
          console.error(`[ADMIN] Failed to fetch members for org ${org.id}:`, err);
          return {
            ...org,
            memberCount: 0,
            members: [],
          };
        }
      }),
    );

    console.log('[ADMIN] Returning organizations with members:', orgsWithMembers.length);
    return c.json({ success: true, data: orgsWithMembers });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch organizations:', error);
    return c.json(
      {
        success: false,
        error: { code: 'ORG_LIST_FAILED', message: (error as Error).message },
      },
      500,
    );
  }
});

adminRoutes.post('/users', zValidator('json', CreateUserSchema), async (c) => {
  const body = c.req.valid('json');
  const user = await auth.api.createUser({
    headers: c.req.raw.headers,
    body,
  });

  return c.json({ success: true, data: user });
});

adminRoutes.patch('/users/:userId/role', zValidator('json', SetUserRoleSchema), async (c) => {
  const body = c.req.valid('json');
  const user = await auth.api.setRole({
    headers: c.req.raw.headers,
    body: {
      userId: c.req.param('userId'),
      role: body.role,
    },
  });

  return c.json({ success: true, data: user });
});

adminRoutes.delete('/users/:userId', async (c) => {
  const result = await auth.api.removeUser({
    headers: c.req.raw.headers,
    body: { userId: c.req.param('userId') },
  });

  return c.json({ success: true, data: result });
});

adminRoutes.get('/operators', async (c) => {
  const users = await auth.api.listUsers({
    headers: c.req.raw.headers,
    query: {
      limit: c.req.query('limit') ?? '50',
      offset: c.req.query('offset') ?? '0',
      filterField: 'role',
      filterValue: 'user',
      filterOperator: 'eq',
    },
  });

  return c.json({
    success: true,
    data: users,
    meta: {
      note: 'Organization-scoped operator roles are managed through organization memberships.',
    },
  });
});
