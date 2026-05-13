import { getSession } from './driver';

// ─── Neo4j Schema Initialization ─────────────────────────────────

export async function initializeSchema(): Promise<void> {
  const session = getSession();

  try {
    // Constraints
    const constraints = [
      'CREATE CONSTRAINT asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT cve_id IF NOT EXISTS FOR (c:CVE) REQUIRE c.cveId IS UNIQUE',
      'CREATE CONSTRAINT threat_actor_name IF NOT EXISTS FOR (t:ThreatActor) REQUIRE t.name IS UNIQUE',
      'CREATE CONSTRAINT technique_mitre_id IF NOT EXISTS FOR (t:AttackTechnique) REQUIRE t.mitreId IS UNIQUE',
      'CREATE CONSTRAINT crown_jewel_id IF NOT EXISTS FOR (c:CrownJewel) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
    ];

    // Indexes
    const indexes = [
      'CREATE INDEX asset_type IF NOT EXISTS FOR (a:Asset) ON (a.type)',
      'CREATE INDEX asset_tenant IF NOT EXISTS FOR (a:Asset) ON (a.tenantId)',
      'CREATE INDEX asset_criticality IF NOT EXISTS FOR (a:Asset) ON (a.criticality)',
      'CREATE INDEX asset_internet_facing IF NOT EXISTS FOR (a:Asset) ON (a.internetFacing)',
      'CREATE INDEX crown_jewel_tenant IF NOT EXISTS FOR (c:CrownJewel) ON (c.tenantId)',
      'CREATE INDEX cve_severity IF NOT EXISTS FOR (c:CVE) ON (c.severity)',
      'CREATE INDEX cve_exploited IF NOT EXISTS FOR (c:CVE) ON (c.exploitedInWild)',
      'CREATE INDEX cve_cvss IF NOT EXISTS FOR (c:CVE) ON (c.cvss)',
      'CREATE INDEX threat_actor_country IF NOT EXISTS FOR (t:ThreatActor) ON (t.country)',
      'CREATE INDEX technique_tactic IF NOT EXISTS FOR (t:AttackTechnique) ON (t.tactic)',
    ];

    for (const constraint of constraints) {
      await session.run(constraint);
    }

    for (const index of indexes) {
      await session.run(index);
    }

    console.info('✅ Neo4j schema initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Neo4j schema:', error);
    throw error;
  } finally {
    await session.close();
  }
}
