/**
 * ARGUS — Neo4j Seed Script
 * Seeds the graph database with example cybersecurity data
 */

import { indexCVE, initQdrant } from '@argus/ai';
import neo4j from '../packages/graph/node_modules/neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'argus_dev_password';

async function seed() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  console.info('🌱 Seeding ARGUS graph database...\n');

  try {
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');
    console.info('  ✓ Cleared existing data');

    // Initialize Qdrant
    await initQdrant();
    console.info('  ✓ Initialized Qdrant collection');

    // ── Assets ──
    const assets = [
      {
        id: 'a1',
        hostname: 'web-prod-01',
        ip: '10.0.1.10',
        type: 'server',
        internetFacing: true,
        criticality: 'high',
        os: 'Ubuntu 22.04',
      },
      {
        id: 'a2',
        hostname: 'api-gateway-01',
        ip: '10.0.1.20',
        type: 'server',
        internetFacing: true,
        criticality: 'critical',
        os: 'Alpine Linux',
      },
      {
        id: 'a3',
        hostname: 'prod-db-01',
        ip: '10.0.2.10',
        type: 'database',
        internetFacing: false,
        criticality: 'critical',
        os: 'Ubuntu 22.04',
      },
      {
        id: 'a4',
        hostname: 'admin-srv-01',
        ip: '10.0.3.10',
        type: 'server',
        internetFacing: false,
        criticality: 'critical',
        os: 'Windows Server 2022',
      },
      {
        id: 'a5',
        hostname: 'dev-workstation-01',
        ip: '10.0.4.10',
        type: 'workstation',
        internetFacing: false,
        criticality: 'medium',
        os: 'macOS 14',
      },
      {
        id: 'a6',
        hostname: 'vpn-gateway',
        ip: '10.0.0.5',
        type: 'network_device',
        internetFacing: true,
        criticality: 'high',
        os: 'FortiOS',
      },
      {
        id: 'a7',
        hostname: 'k8s-node-01',
        ip: '10.0.5.10',
        type: 'container',
        internetFacing: false,
        criticality: 'high',
        os: 'Container Linux',
      },
      {
        id: 'a8',
        hostname: 'mail-server',
        ip: '10.0.1.30',
        type: 'server',
        internetFacing: true,
        criticality: 'high',
        os: 'Ubuntu 22.04',
      },
    ];

    for (const a of assets) {
      await session.run(
        `CREATE (a:Asset {id: $id, hostname: $hostname, ip: $ip, type: $type, internetFacing: $internetFacing, criticality: $criticality, os: $os})`,
        a,
      );
    }
    console.info(`  ✓ Created ${assets.length} assets`);

    // ── CVEs ──
    const cves = [
      {
        cveId: 'CVE-2024-0001',
        severity: 'critical',
        cvss: 9.8,
        exploitedInWild: true,
        description: 'Remote code execution in web framework',
      },
      {
        cveId: 'CVE-2024-0042',
        severity: 'critical',
        cvss: 9.1,
        exploitedInWild: true,
        description: 'Authentication bypass in SSH service',
      },
      {
        cveId: 'CVE-2024-1337',
        severity: 'high',
        cvss: 8.5,
        exploitedInWild: false,
        description: 'SQL injection in API gateway',
      },
      {
        cveId: 'CVE-2024-2048',
        severity: 'high',
        cvss: 7.8,
        exploitedInWild: false,
        description: 'Privilege escalation via kernel vulnerability',
      },
      {
        cveId: 'CVE-2024-3001',
        severity: 'medium',
        cvss: 6.5,
        exploitedInWild: false,
        description: 'Information disclosure in logging module',
      },
    ];

    for (const c of cves) {
      await session.run(
        `CREATE (c:CVE {cveId: $cveId, severity: $severity, cvss: $cvss, exploitedInWild: $exploitedInWild, description: $description})`,
        c,
      );
      await indexCVE(c.cveId, c.description, c.severity, c.cvss);
    }
    console.info(`  ✓ Created ${cves.length} CVEs and indexed them in Qdrant`);

    // ── Threat Actors ──
    const actors = [
      { name: 'Lazarus Group', country: 'North Korea', sophistication: 'advanced' },
      { name: 'APT28', country: 'Russia', sophistication: 'advanced' },
      { name: 'APT41', country: 'China', sophistication: 'advanced' },
    ];

    for (const t of actors) {
      await session.run(
        `CREATE (t:ThreatActor {name: $name, country: $country, sophistication: $sophistication})`,
        t,
      );
    }
    console.info(`  ✓ Created ${actors.length} threat actors`);

    // ── Crown Jewels ──
    await session.run(
      `CREATE (c:CrownJewel {name: 'Customer Database', importance: 'critical', businessImpact: 'catastrophic'})`,
    );
    await session.run(
      `CREATE (c:CrownJewel {name: 'Source Code Repository', importance: 'critical', businessImpact: 'major'})`,
    );
    console.info('  ✓ Created 2 crown jewels');

    // ── Attack Techniques ──
    const techniques = [
      { mitreId: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'initial_access' },
      { mitreId: 'T1021', name: 'Remote Services', tactic: 'lateral_movement' },
      { mitreId: 'T1078', name: 'Valid Accounts', tactic: 'persistence' },
      {
        mitreId: 'T1068',
        name: 'Exploitation for Privilege Escalation',
        tactic: 'privilege_escalation',
      },
    ];

    for (const t of techniques) {
      await session.run(
        `CREATE (t:AttackTechnique {mitreId: $mitreId, name: $name, tactic: $tactic})`,
        t,
      );
    }
    console.info(`  ✓ Created ${techniques.length} ATT&CK techniques`);

    // ── Relationships ──
    const rels = [
      `MATCH (a:Asset {hostname: 'web-prod-01'}), (c:CVE {cveId: 'CVE-2024-0001'}) CREATE (a)-[:HAS_VULNERABILITY]->(c)`,
      `MATCH (a:Asset {hostname: 'api-gateway-01'}), (c:CVE {cveId: 'CVE-2024-1337'}) CREATE (a)-[:HAS_VULNERABILITY]->(c)`,
      `MATCH (a:Asset {hostname: 'admin-srv-01'}), (c:CVE {cveId: 'CVE-2024-2048'}) CREATE (a)-[:HAS_VULNERABILITY]->(c)`,
      `MATCH (a:Asset {hostname: 'mail-server'}), (c:CVE {cveId: 'CVE-2024-0042'}) CREATE (a)-[:HAS_VULNERABILITY]->(c)`,
      `MATCH (a:Asset {hostname: 'web-prod-01'}), (b:Asset {hostname: 'api-gateway-01'}) CREATE (a)-[:CONNECTED_TO]->(b)`,
      `MATCH (a:Asset {hostname: 'api-gateway-01'}), (b:Asset {hostname: 'prod-db-01'}) CREATE (a)-[:CAN_ACCESS]->(b)`,
      `MATCH (a:Asset {hostname: 'prod-db-01'}), (c:CrownJewel {name: 'Customer Database'}) CREATE (a)-[:HOSTS]->(c)`,
      `MATCH (a:Asset {hostname: 'dev-workstation-01'}), (b:Asset {hostname: 'admin-srv-01'}) CREATE (a)-[:ENABLES_LATERAL_MOVEMENT]->(b)`,
      `MATCH (a:Asset {hostname: 'vpn-gateway'}), (b:Asset {hostname: 'dev-workstation-01'}) CREATE (a)-[:CONNECTED_TO]->(b)`,
      `MATCH (t:ThreatActor {name: 'Lazarus Group'}), (c:CVE {cveId: 'CVE-2024-0001'}) CREATE (t)-[:EXPLOITS]->(c)`,
      `MATCH (t:ThreatActor {name: 'Lazarus Group'}), (a:Asset {hostname: 'web-prod-01'}) CREATE (t)-[:TARGETS]->(a)`,
      `MATCH (t:ThreatActor {name: 'APT28'}), (c:CVE {cveId: 'CVE-2024-0042'}) CREATE (t)-[:EXPLOITS]->(c)`,
      `MATCH (t:ThreatActor {name: 'Lazarus Group'}), (tech:AttackTechnique {mitreId: 'T1190'}) CREATE (t)-[:USES_TECHNIQUE]->(tech)`,
      `MATCH (t:ThreatActor {name: 'APT28'}), (tech:AttackTechnique {mitreId: 'T1078'}) CREATE (t)-[:USES_TECHNIQUE]->(tech)`,
    ];

    for (const rel of rels) {
      await session.run(rel);
    }
    console.info(`  ✓ Created ${rels.length} relationships`);

    console.info('\n✅ Seed completed successfully!');
    console.info('   Open Neo4j Browser at http://localhost:7474 to explore the graph.');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

seed();
