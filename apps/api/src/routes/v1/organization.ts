import { ORG_ROLES } from '@argus/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../../auth';
import { getAuthDbPool } from '../../auth-db-pool';
import { requireOrgRole } from '../../middleware/auth';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const organizationRoutes = new Hono<TenantEnv>();

// ─── Auto-create pending_invitation table ────────────────────────

const TABLE_INIT_SQL = `
CREATE TABLE IF NOT EXISTS "pending_invitation" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "orgName" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "inviterName" TEXT,
  "inviteeId" TEXT NOT NULL,
  "inviteeEmail" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

let tableInitialized = false;

async function ensureInvitationTable() {
  if (tableInitialized) return;
  try {
    const pool = getAuthDbPool();
    await pool.query(TABLE_INIT_SQL);
    tableInitialized = true;
    console.log('[ORG] pending_invitation table ready');
  } catch (err) {
    console.error('[ORG] Failed to create pending_invitation table:', err);
  }
}

// ─── Schemas ─────────────────────────────────────────────────────

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default('viewer'),
});

const UpdateMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ORG_ROLES),
});

// ─── Organization Info ───────────────────────────────────────────

organizationRoutes.get('/current', async (c) => {
  const organization = await auth.api.getFullOrganization({
    headers: c.req.raw.headers,
    query: { organizationId: c.get('tenantId') },
  });

  return c.json({ success: true, data: organization });
});

// ─── List Members ────────────────────────────────────────────────

organizationRoutes.get('/members', requireOrgRole('operator', 'org_admin'), async (c) => {
  const pool = getAuthDbPool();
  const tenantId = c.get('tenantId');

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
    [tenantId],
  );

  return c.json({
    success: true,
    data: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      user: { name: m.name, email: m.email },
    })),
  });
});

// ─── Invite Member (In-App) ──────────────────────────────────────
// Validates the email belongs to a registered user, checks they are
// not already a member, and creates a pending_invitation record.

organizationRoutes.post(
  '/invites',
  requireOrgRole('org_admin'),
  zValidator('json', InviteMemberSchema),
  async (c) => {
    await ensureInvitationTable();
    const pool = getAuthDbPool();
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');

    // 1. Look up the invitee by email
    const { rows: userRows } = await pool.query<{ id: string; name: string | null }>(
      `SELECT id, name FROM "user" WHERE email = $1 LIMIT 1`,
      [body.email],
    );

    if (userRows.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No registered user found with this email. They must create an account first.',
          },
        },
        404,
      );
    }

    const invitee = userRows[0]!;

    // 2. Check if the user is already a member
    const { rows: existingMember } = await pool.query(
      `SELECT id FROM "member" WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1`,
      [invitee.id, tenantId],
    );

    if (existingMember.length > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ALREADY_MEMBER',
            message: 'This user is already a member of your organization.',
          },
        },
        409,
      );
    }

    // 3. Check for existing pending invitation
    const { rows: existingInvite } = await pool.query(
      `SELECT id FROM "pending_invitation" WHERE "inviteeId" = $1 AND "organizationId" = $2 AND status = 'pending' LIMIT 1`,
      [invitee.id, tenantId],
    );

    if (existingInvite.length > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ALREADY_INVITED',
            message: 'This user already has a pending invitation to your organization.',
          },
        },
        409,
      );
    }

    // 4. Get the inviter (current user) and org info
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const inviterId = session?.user?.id;
    const inviterName = session?.user?.name ?? 'Unknown';

    const { rows: orgRows } = await pool.query<{ name: string }>(
      `SELECT name FROM "organization" WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    const orgName = orgRows[0]?.name ?? 'Unknown Organization';

    // 5. Create the pending invitation
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await pool.query(
      `INSERT INTO "pending_invitation" (id, "organizationId", "orgName", "inviterId", "inviterName", "inviteeId", "inviteeEmail", role, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())`,
      [invitationId, tenantId, orgName, inviterId, inviterName, invitee.id, body.email, body.role],
    );

    console.log(
      `[ORG] Invitation created: ${invitationId} → ${body.email} as ${body.role} in ${orgName}`,
    );

    return c.json({
      success: true,
      data: {
        id: invitationId,
        inviteeEmail: body.email,
        inviteeName: invitee.name,
        role: body.role,
        orgName,
      },
    });
  },
);

// ─── Update Member Role ──────────────────────────────────────────

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
