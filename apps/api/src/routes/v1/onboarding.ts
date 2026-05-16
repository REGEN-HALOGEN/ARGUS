import { getNeo4jDriver } from '@argus/graph';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../../auth';
import { getAuthDbPool } from '../../auth-db-pool';

export const onboardingRoutes = new Hono();

// ─── Schema ──────────────────────────────────────────────────────

const ServerGroupSchema = z.object({
  role: z.string().min(1),
  os: z.string().min(1),
  osVersion: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  internetFacing: z.boolean(),
});

const DataStoreSchema = z.object({
  type: z.string().min(1),
  purpose: z.string().min(1),
});

const OnboardingSchema = z.object({
  organizationName: z.string().min(2).max(120),
  industry: z.string().min(2).max(80),
  cloudProviders: z.array(z.enum(['aws', 'gcp', 'azure'])).default([]),
  hasOnPrem: z.boolean().default(false),
  servers: z.array(ServerGroupSchema).min(1),
  dataStores: z.array(DataStoreSchema).min(1),
  crownJewelIndices: z.array(z.number().int().min(0)).default([]),
});

// ─── Helpers ─────────────────────────────────────────────────────

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `tenant-${Date.now()}`;
}

// ─── CVE Knowledge Base ──────────────────────────────────────────
// Maps OS names to realistic CVEs that affect them.

interface KnownCVE {
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss: number;
  exploitedInWild: boolean;
  description: string;
  affectsOs: string[];
}

const CVE_DATABASE: KnownCVE[] = [
  {
    cveId: 'CVE-2024-6387',
    severity: 'critical',
    cvss: 9.8,
    exploitedInWild: true,
    description: 'RegreSSHion: Remote code execution in OpenSSH server',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'CentOS', 'Amazon Linux'],
  },
  {
    cveId: 'CVE-2024-3094',
    severity: 'critical',
    cvss: 10.0,
    exploitedInWild: true,
    description: 'XZ Utils backdoor allowing unauthorized SSH access',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'CentOS'],
  },
  {
    cveId: 'CVE-2024-21351',
    severity: 'high',
    cvss: 7.6,
    exploitedInWild: true,
    description: 'Windows SmartScreen security feature bypass',
    affectsOs: ['Windows Server'],
  },
  {
    cveId: 'CVE-2024-21412',
    severity: 'high',
    cvss: 8.1,
    exploitedInWild: true,
    description: 'Windows Internet Shortcut files security bypass',
    affectsOs: ['Windows Server'],
  },
  {
    cveId: 'CVE-2023-44487',
    severity: 'high',
    cvss: 7.5,
    exploitedInWild: true,
    description: 'HTTP/2 Rapid Reset DDoS attack vector',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'CentOS', 'Windows Server', 'Amazon Linux'],
  },
  {
    cveId: 'CVE-2024-1086',
    severity: 'high',
    cvss: 7.8,
    exploitedInWild: true,
    description: 'Linux kernel nf_tables use-after-free privilege escalation',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'CentOS', 'Amazon Linux'],
  },
  {
    cveId: 'CVE-2023-4911',
    severity: 'high',
    cvss: 7.8,
    exploitedInWild: true,
    description: 'Looney Tunables: glibc buffer overflow privilege escalation',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'CentOS'],
  },
  {
    cveId: 'CVE-2024-0012',
    severity: 'critical',
    cvss: 9.1,
    exploitedInWild: false,
    description: 'PostgreSQL privilege escalation via crafted SQL',
    affectsOs: ['PostgreSQL'],
  },
  {
    cveId: 'CVE-2024-1597',
    severity: 'critical',
    cvss: 9.8,
    exploitedInWild: false,
    description: 'SQL injection in PostgreSQL JDBC driver',
    affectsOs: ['PostgreSQL'],
  },
  {
    cveId: 'CVE-2024-23897',
    severity: 'critical',
    cvss: 9.8,
    exploitedInWild: true,
    description: 'MongoDB arbitrary file read via BSON deserialization',
    affectsOs: ['MongoDB'],
  },
  {
    cveId: 'CVE-2023-22515',
    severity: 'critical',
    cvss: 9.8,
    exploitedInWild: true,
    description: 'Remote code execution via web application framework',
    affectsOs: ['Ubuntu', 'Debian', 'RHEL', 'Windows Server'],
  },
];

function findCVEsForOS(osName: string): KnownCVE[] {
  return CVE_DATABASE.filter((cve) =>
    cve.affectsOs.some((os) => osName.toLowerCase().includes(os.toLowerCase())),
  );
}

function findCVEsForDB(dbType: string): KnownCVE[] {
  return CVE_DATABASE.filter((cve) =>
    cve.affectsOs.some((os) => dbType.toLowerCase().includes(os.toLowerCase())),
  );
}

// ─── Risk Scoring ────────────────────────────────────────────────

function calculateRisk(
  cvss: number,
  internetFacing: boolean,
  hopsToCrown: number,
): { score: number; rating: string } {
  const exposureMultiplier = internetFacing ? 1.5 : 1.0;
  const proximityMultiplier =
    hopsToCrown <= 1 ? 1.8 : hopsToCrown <= 2 ? 1.4 : hopsToCrown <= 3 ? 1.1 : 0.8;
  const raw = (cvss / 10) * exposureMultiplier * proximityMultiplier * 100;
  const score = Math.min(100, Math.round(raw));
  const rating = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score, rating };
}

// ─── Graph Factory ───────────────────────────────────────────────

type OnboardingInput = z.infer<typeof OnboardingSchema>;

async function buildTenantGraph(tenantId: string, input: OnboardingInput) {
  const session = getNeo4jDriver().session();
  const orgSlug = slugify(input.organizationName);
  const crownSet = new Set(input.crownJewelIndices);

  try {
    // 1. Create Internet gateway node
    await session.run(
      `MERGE (inet:Asset {id: $id})
       SET inet.tenantId = $tenantId, inet.hostname = 'Internet', inet.type = 'gateway',
           inet.internetFacing = true, inet.criticality = 'low', inet.os = 'N/A'`,
      { id: `${tenantId}:internet`, tenantId },
    );

    // 2. Create server nodes
    const serverNodeIds: { id: string; internetFacing: boolean; role: string; os: string }[] = [];
    for (const group of input.servers) {
      for (let i = 0; i < group.quantity; i++) {
        const nodeId = `${tenantId}:${orgSlug}-${slugify(group.role)}-${i + 1}`;
        const hostname = `${orgSlug}-${slugify(group.role)}-${String(i + 1).padStart(2, '0')}`;
        await session.run(
          `MERGE (s:Asset {id: $id})
           SET s.tenantId = $tenantId, s.hostname = $hostname, s.type = 'server',
               s.role = $role, s.os = $os, s.osVersion = $osVersion,
               s.internetFacing = $internetFacing, s.criticality = 'medium'`,
          {
            id: nodeId,
            tenantId,
            hostname,
            role: group.role,
            os: group.os,
            osVersion: group.osVersion,
            internetFacing: group.internetFacing,
          },
        );
        serverNodeIds.push({
          id: nodeId,
          internetFacing: group.internetFacing,
          role: group.role,
          os: group.os,
        });
      }
    }

    // 3. Create data store nodes
    const dsNodeIds: { id: string; isCrown: boolean; type: string }[] = [];
    for (let i = 0; i < input.dataStores.length; i++) {
      const ds = input.dataStores[i]!;
      const nodeId = `${tenantId}:${orgSlug}-${slugify(ds.type)}-${i + 1}`;
      const hostname = `${orgSlug}-${slugify(ds.type)}-${String(i + 1).padStart(2, '0')}`;
      const isCrown = crownSet.has(i);
      await session.run(
        `MERGE (d:Asset {id: $id})
         SET d.tenantId = $tenantId, d.hostname = $hostname, d.type = 'database',
             d.dbType = $dbType, d.purpose = $purpose, d.internetFacing = false,
             d.criticality = $criticality`,
        {
          id: nodeId,
          tenantId,
          hostname,
          dbType: ds.type,
          purpose: ds.purpose,
          criticality: isCrown ? 'critical' : 'high',
        },
      );
      if (isCrown) {
        const crownId = `${tenantId}:crown-${slugify(ds.type)}-${i + 1}`;
        await session.run(
          `MERGE (c:CrownJewel {id: $crownId})
           SET c.tenantId = $tenantId, c.name = $name, c.importance = 'critical', c.businessImpact = 'major'
           WITH c
           MATCH (d:Asset {id: $dsId})
           MERGE (d)-[:HOSTS]->(c)`,
          { crownId, tenantId, name: `${ds.purpose} (${ds.type})`, dsId: nodeId },
        );
      }
      dsNodeIds.push({ id: nodeId, isCrown, type: ds.type });
    }

    // 4. Create edges: Internet → internet-facing servers
    const internetFacingServers = serverNodeIds.filter((s) => s.internetFacing);
    for (const srv of internetFacingServers) {
      await session.run(
        `MATCH (inet:Asset {id: $inetId}), (s:Asset {id: $srvId})
         MERGE (inet)-[:CAN_ACCESS]->(s)`,
        { inetId: `${tenantId}:internet`, srvId: srv.id },
      );
    }

    // 5. Create edges: Web/App servers → databases
    const webServers = serverNodeIds.filter((s) => s.role.toLowerCase().includes('web'));
    const appServers = serverNodeIds.filter((s) => s.role.toLowerCase().includes('application'));
    const internalServers = serverNodeIds.filter((s) => !s.internetFacing);

    // Web servers → App servers (if both exist)
    for (const ws of webServers) {
      for (const as_ of appServers) {
        if (ws.id !== as_.id) {
          await session.run(
            `MATCH (a:Asset {id: $src}), (b:Asset {id: $tgt}) MERGE (a)-[:CAN_ACCESS]->(b)`,
            { src: ws.id, tgt: as_.id },
          );
        }
      }
    }

    // App servers (or internal servers) → Databases
    const connectingServers =
      appServers.length > 0
        ? appServers
        : internalServers.length > 0
          ? internalServers
          : webServers;
    for (const srv of connectingServers) {
      for (const ds of dsNodeIds) {
        await session.run(
          `MATCH (a:Asset {id: $src}), (b:Asset {id: $tgt}) MERGE (a)-[:CAN_ACCESS]->(b)`,
          { src: srv.id, tgt: ds.id },
        );
      }
    }

    // 6. CVE assignment — match CVEs to servers by OS
    const assignedCVEs = new Set<string>();
    for (const srv of serverNodeIds) {
      const cves = findCVEsForOS(srv.os);
      for (const cve of cves) {
        if (!assignedCVEs.has(cve.cveId)) {
          await session.run(
            `MERGE (c:CVE {cveId: $cveId})
             SET c.severity = $severity, c.cvss = $cvss, c.exploitedInWild = $exploited,
                 c.description = $desc, c.tenantId = $tenantId`,
            {
              cveId: cve.cveId,
              severity: cve.severity,
              cvss: cve.cvss,
              exploited: cve.exploitedInWild,
              desc: cve.description,
              tenantId,
            },
          );
          assignedCVEs.add(cve.cveId);
        }
        // Calculate risk based on proximity to crown jewels
        const hopsToCrown = dsNodeIds.some((d) => d.isCrown) ? (srv.internetFacing ? 2 : 3) : 5;
        const risk = calculateRisk(cve.cvss, srv.internetFacing, hopsToCrown);
        await session.run(
          `MATCH (s:Asset {id: $srvId}), (c:CVE {cveId: $cveId})
           MERGE (s)-[r:HAS_VULNERABILITY]->(c)
           SET r.riskScore = $riskScore, r.riskRating = $riskRating`,
          { srvId: srv.id, cveId: cve.cveId, riskScore: risk.score, riskRating: risk.rating },
        );
      }
    }

    // CVEs for database types
    for (const ds of dsNodeIds) {
      const cves = findCVEsForDB(ds.type);
      for (const cve of cves) {
        if (!assignedCVEs.has(cve.cveId)) {
          await session.run(
            `MERGE (c:CVE {cveId: $cveId})
             SET c.severity = $severity, c.cvss = $cvss, c.exploitedInWild = $exploited,
                 c.description = $desc, c.tenantId = $tenantId`,
            {
              cveId: cve.cveId,
              severity: cve.severity,
              cvss: cve.cvss,
              exploited: cve.exploitedInWild,
              desc: cve.description,
              tenantId,
            },
          );
          assignedCVEs.add(cve.cveId);
        }
        const risk = calculateRisk(cve.cvss, false, ds.isCrown ? 0 : 1);
        await session.run(
          `MATCH (s:Asset {id: $dsId}), (c:CVE {cveId: $cveId})
           MERGE (s)-[r:HAS_VULNERABILITY]->(c)
           SET r.riskScore = $riskScore, r.riskRating = $riskRating`,
          { dsId: ds.id, cveId: cve.cveId, riskScore: risk.score, riskRating: risk.rating },
        );
      }
    }

    console.log(
      `[GRAPH FACTORY] Built graph for tenant ${tenantId}: ${serverNodeIds.length} servers, ${dsNodeIds.length} data stores, ${assignedCVEs.size} CVEs`,
    );
  } finally {
    await session.close();
  }
}

// ─── Route ───────────────────────────────────────────────────────

onboardingRoutes.post('/', zValidator('json', OnboardingSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const metadata = {
      industry: input.industry,
      cloudProviders: input.cloudProviders,
      hasOnPrem: input.hasOnPrem,
      estimatedAssets:
        input.servers.reduce((sum, s) => sum + s.quantity, 0) + input.dataStores.length,
      onboardingCompletedAt: new Date().toISOString(),
    };

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || !session.user) {
      return c.json(
        { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'User not authenticated' } },
        401,
      );
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
        const memberId = `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await pool.query(
          `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
          [memberId, organization.id, userId, 'owner', new Date().toISOString()],
        );
        console.log('[ONBOARDING] User added as owner:', memberId);
      }
    } catch (err) {
      console.error('[ONBOARDING] Failed to add member:', err);
    }

    await auth.api.setActiveOrganization({
      headers: c.req.raw.headers,
      body: { organizationId: organization.id },
    });

    console.log('[ONBOARDING] Building tenant graph...');
    await buildTenantGraph(organization.id, input);
    console.log('[ONBOARDING] Tenant graph built successfully');

    return c.json({ success: true, data: { organization, metadata } });
  } catch (error: any) {
    console.error('[ONBOARDING] Error:', error.message || error);
    throw error;
  }
});
