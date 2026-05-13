import { getNeo4jDriver } from '@argus/graph';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../../auth';
import { getAuthDbPool } from '../../auth-db-pool';

export const onboardingRoutes = new Hono();

const OnboardingSchema = z.object({
  organizationName: z.string().min(2).max(120),
  industry: z.string().min(2).max(80),
  cloudProviders: z.array(z.enum(['aws', 'gcp', 'azure'])).default([]),
  hasOnPrem: z.boolean().default(false),
  estimatedAssets: z.number().int().min(0).max(1_000_000),
});

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `tenant-${Date.now()}`;
}

async function seedTenantGraph(tenantId: string, organizationName: string, industry: string) {
  const session = getNeo4jDriver().session();

  try {
    await session.run(
      `
      MERGE (web:Asset {id: $webId})
        SET web.tenantId = $tenantId,
            web.hostname = $webHost,
            web.ip = '10.10.1.10',
            web.type = 'server',
            web.internetFacing = true,
            web.criticality = 'high',
            web.os = 'Ubuntu 22.04'
      MERGE (db:Asset {id: $dbId})
        SET db.tenantId = $tenantId,
            db.hostname = $dbHost,
            db.ip = '10.10.2.10',
            db.type = 'database',
            db.internetFacing = false,
            db.criticality = 'critical',
            db.os = 'PostgreSQL'
      MERGE (crown:CrownJewel {id: $crownId})
        SET crown.tenantId = $tenantId,
            crown.name = $crownName,
            crown.importance = 'critical',
            crown.businessImpact = 'major'
      MERGE (cve:CVE {cveId: 'CVE-2024-0001'})
        SET cve.severity = 'critical',
            cve.cvss = 9.8,
            cve.exploitedInWild = true,
            cve.description = 'Remote code execution in web framework'
      MERGE (web)-[:HAS_VULNERABILITY]->(cve)
      MERGE (web)-[:CAN_ACCESS]->(db)
      MERGE (db)-[:HOSTS]->(crown)
      `,
      {
        tenantId,
        webId: `${tenantId}:web-prod-01`,
        dbId: `${tenantId}:primary-db-01`,
        crownId: `${tenantId}:primary-data`,
        webHost: `${slugify(organizationName)}-web-01`,
        dbHost: `${slugify(organizationName)}-db-01`,
        crownName: `${industry} Data Store`,
      },
    );
  } finally {
    await session.close();
  }
}

onboardingRoutes.post('/', zValidator('json', OnboardingSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const metadata = {
      industry: input.industry,
      cloudProviders: input.cloudProviders,
      hasOnPrem: input.hasOnPrem,
      estimatedAssets: input.estimatedAssets,
      onboardingCompletedAt: new Date().toISOString(),
    };

    // Get current user from session
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session || !session.user) {
      return c.json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'User not authenticated' } }, 401);
    }
    const userId = session.user.id;
    console.log('[ONBOARDING] Current user:', userId);

    console.log('[ONBOARDING] Creating organization:', input.organizationName);
    const organization = await auth.api.createOrganization({
      headers: c.req.raw.headers,
      body: {
        name: input.organizationName,
        slug: `${slugify(input.organizationName)}-${Date.now().toString(36)}`,
        metadata,
      },
    });
    console.log('[ONBOARDING] Organization created:', organization.id);

    try {
      const pool = getAuthDbPool();
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM "member" WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1`,
        [userId, organization.id],
      );

      if (existing.rows.length === 0) {
        console.log('[ONBOARDING] Adding user as organization owner...');
        const memberId = `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await pool.query(
          `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
           VALUES ($1, $2, $3, $4, $5)`,
          [memberId, organization.id, userId, 'owner', new Date().toISOString()],
        );
        console.log('[ONBOARDING] User added as owner:', memberId);
      } else {
        console.log('[ONBOARDING] User already a member');
      }
    } catch (err) {
      console.error('[ONBOARDING] Failed to add member to database:', err);
    }

    console.log('[ONBOARDING] Setting active organization:', organization.id);
    await auth.api.setActiveOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: organization.id,
      },
    });
    console.log('[ONBOARDING] Active organization set');

    console.log('[ONBOARDING] Seeding tenant graph...');
    await seedTenantGraph(organization.id, input.organizationName, input.industry);
    console.log('[ONBOARDING] Tenant graph seeded');

    return c.json({
      success: true,
      data: {
        organization,
        metadata,
      },
    });
  } catch (error: any) {
    console.error('[ONBOARDING] Error:', error.message || error);
    throw error;
  }
});
