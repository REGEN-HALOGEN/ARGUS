import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthDbPool } from '../../auth-db-pool';
import { getAuthSession } from '../../middleware/auth';

export const invitationRoutes = new Hono();

const RespondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

// ─── GET /invitations/pending ────────────────────────────────────
// Returns all pending invitations for the current logged-in user.
// This is called by the bell icon notification widget.

invitationRoutes.get('/pending', async (c) => {
  const session = await getAuthSession(c.req.raw.headers);
  const userId = session.user.id;
  const pool = getAuthDbPool();

  // Ensure table exists (safe no-op if already created)
  await pool
    .query(
      `CREATE TABLE IF NOT EXISTS "pending_invitation" (
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
      )`,
    )
    .catch(() => {});

  const { rows: invitations } = await pool.query<{
    id: string;
    organizationId: string;
    orgName: string;
    inviterId: string;
    inviterName: string | null;
    role: string;
    status: string;
    createdAt: string;
  }>(
    `SELECT id, "organizationId", "orgName", "inviterId", "inviterName", role, status, "createdAt"
     FROM "pending_invitation"
     WHERE "inviteeId" = $1 AND status = 'pending'
     ORDER BY "createdAt" DESC`,
    [userId],
  );

  return c.json({ success: true, data: invitations });
});

// ─── POST /invitations/:id/respond ───────────────────────────────
// Accept or decline a pending invitation.

invitationRoutes.post('/:id/respond', zValidator('json', RespondSchema), async (c) => {
  const session = await getAuthSession(c.req.raw.headers);
  const userId = session.user.id;
  const invitationId = c.req.param('id');
  const { action } = c.req.valid('json');
  const pool = getAuthDbPool();

  // Fetch the invitation and verify it belongs to this user
  const { rows: invRows } = await pool.query<{
    id: string;
    organizationId: string;
    orgName: string;
    inviteeId: string;
    role: string;
    status: string;
  }>(
    `SELECT id, "organizationId", "orgName", "inviteeId", role, status
     FROM "pending_invitation"
     WHERE id = $1 LIMIT 1`,
    [invitationId],
  );

  if (invRows.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found.' } },
      404,
    );
  }

  const invitation = invRows[0]!;

  if (invitation.inviteeId !== userId) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'This invitation does not belong to you.' },
      },
      403,
    );
  }

  if (invitation.status !== 'pending') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_RESPONDED',
          message: `This invitation has already been ${invitation.status}.`,
        },
      },
      409,
    );
  }

  if (action === 'decline') {
    await pool.query(`UPDATE "pending_invitation" SET status = 'declined' WHERE id = $1`, [
      invitationId,
    ]);
    return c.json({ success: true, data: { action: 'declined' } });
  }

  // ── Accept ─────────────────────────────────────────────────────
  // 1. Add user as member of the organization with the specified role
  const { rows: existingMember } = await pool.query(
    `SELECT id FROM "member" WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1`,
    [userId, invitation.organizationId],
  );

  if (existingMember.length === 0) {
    const memberId = `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await pool.query(
      `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
       VALUES ($1, $2, $3, $4, NOW())`,
      [memberId, invitation.organizationId, userId, invitation.role],
    );
    console.log(
      `[INVITATION] User ${userId} accepted invitation → joined ${invitation.orgName} as ${invitation.role}`,
    );
  } else {
    // Already a member (edge case) — update role
    await pool.query(
      `UPDATE "member" SET role = $1 WHERE "userId" = $2 AND "organizationId" = $3`,
      [invitation.role, userId, invitation.organizationId],
    );
  }

  // 2. Mark invitation as accepted
  await pool.query(`UPDATE "pending_invitation" SET status = 'accepted' WHERE id = $1`, [
    invitationId,
  ]);

  return c.json({
    success: true,
    data: {
      action: 'accepted',
      organizationId: invitation.organizationId,
      orgName: invitation.orgName,
      role: invitation.role,
    },
  });
});
