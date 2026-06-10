/**
 * Seeding script for Threat Actors in Neo4j AuraDB.
 * Merges Threat Actors, CVE associations, and Attack Techniques without clearing existing data.
 */

import neo4j from '../packages/graph/node_modules/neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'argus_dev_password';

const actors = [
  {
    name: 'Lazarus Group',
    country: 'North Korea',
    sophistication: 'advanced',
    motivation: 'Espionage & Financial',
    description: 'North Korean state-sponsored cyber threat group active since at least 2009, known for high-profile cyber espionage campaigns and financially motivated operations targeting cryptocurrency institutions, financial sectors, and global critical infrastructure.',
    lastSeen: '2026-05-15T00:00:00Z',
    cves: ['CVE-2024-3094', 'CVE-2023-22515', 'CVE-2024-0001'],
    techniques: [
      { mitreId: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'initial-access' },
      { mitreId: 'T1053.005', name: 'Scheduled Task', tactic: 'execution' }
    ]
  },
  {
    name: 'APT28',
    country: 'Russia',
    sophistication: 'advanced',
    motivation: 'Espionage',
    description: 'Russian military intelligence (GRU) threat group active since at least the mid-2000s, targeting government, military, and security organizations, especially in the US and Europe. Focuses on collection of intelligence and disruptive actions.',
    lastSeen: '2026-06-01T00:00:00Z',
    cves: ['CVE-2024-6387', 'CVE-2024-0042'],
    techniques: [
      { mitreId: 'T1078', name: 'Valid Accounts', tactic: 'persistence' },
      { mitreId: 'T1021.005', name: 'VNC', tactic: 'lateral-movement' }
    ]
  },
  {
    name: 'APT41',
    country: 'China',
    sophistication: 'advanced',
    motivation: 'Espionage & Financial',
    description: 'Chinese state-sponsored espionage group that also conducts financially motivated activity, active since at least 2012. Known for software supply chain compromises, cyberespionage campaigns targeting healthcare/telecoms, and cryptocurrency theft.',
    lastSeen: '2026-05-28T00:00:00Z',
    cves: ['CVE-2024-1086', 'CVE-2023-4911'],
    techniques: [
      { mitreId: 'T1047', name: 'Windows Management Instrumentation', tactic: 'execution' },
      { mitreId: 'T1560.001', name: 'Archive via Utility', tactic: 'collection' }
    ]
  }
];

async function seedThreatActors() {
  console.info('🌱 Seeding Threat Actor intelligence data to Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    for (const actor of actors) {
      console.info(`Creating/Updating Threat Actor: ${actor.name}`);
      // 1. Merge Threat Actor node
      await session.run(
        `
        MERGE (t:ThreatActor {name: $name})
        SET t.country = $country,
            t.sophistication = $sophistication,
            t.motivation = $motivation,
            t.description = $description,
            t.lastSeen = $lastSeen,
            t.updatedAt = datetime()
        `,
        {
          name: actor.name,
          country: actor.country,
          sophistication: actor.sophistication,
          motivation: actor.motivation,
          description: actor.description,
          lastSeen: actor.lastSeen
        }
      );

      // 2. Link to CVEs
      for (const cveId of actor.cves) {
        // First, merge the CVE node to ensure it exists (without overwriting its existing fields if they exist)
        await session.run(
          `
          MERGE (c:CVE {cveId: $cveId})
          ON CREATE SET c.severity = 'high', c.cvss = 7.5, c.description = 'Auto-created during threat actor seeding', c.createdAt = datetime()
          `,
          { cveId }
        );

        // Merge relationship
        await session.run(
          `
          MATCH (t:ThreatActor {name: $name})
          MATCH (c:CVE {cveId: $cveId})
          MERGE (t)-[:EXPLOITS]->(c)
          `,
          { name: actor.name, cveId }
        );
      }

      // 3. Link to Techniques
      for (const tech of actor.techniques) {
        await session.run(
          `
          MERGE (tech:AttackTechnique {mitreId: $mitreId})
          ON CREATE SET tech.name = $name, tech.tactic = $tactic, tech.createdAt = datetime()
          `,
          tech
        );

        await session.run(
          `
          MATCH (t:ThreatActor {name: $actorName})
          MATCH (tech:AttackTechnique {mitreId: $mitreId})
          MERGE (t)-[:USES_TECHNIQUE]->(tech)
          `,
          { actorName: actor.name, mitreId: tech.mitreId }
        );
      }
    }

    console.info('✅ Threat Actor seeding completed successfully!');
  } catch (error) {
    console.error('❌ Threat Actor seeding failed:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedThreatActors();
