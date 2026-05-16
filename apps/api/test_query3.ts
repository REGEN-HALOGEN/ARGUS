import { getNeo4jDriver } from '@argus/graph';
async function run() {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `
         MATCH (t:ThreatActor {name: $name})
         OPTIONAL MATCH (t)-[:EXPLOITS]->(c:CVE)
         OPTIONAL MATCH (t)-[:USES_TECHNIQUE]->(tech:AttackTechnique)
         OPTIONAL MATCH (t)-[:EXPLOITS]->(cv:CVE)<-[:HAS_VULNERABILITY]-(a:Asset {tenantId: $tenantId})
         RETURN t,
                collect(DISTINCT c {.cveId, .severity, .cvss}) AS cves,
                collect(DISTINCT tech {.mitreId, .name, .tactic}) AS techniques,
                collect(DISTINCT a {.hostname, .ip, .role, .criticality}) AS targets
    `,
      { name: 'APT28', tenantId: 'org_test' },
    );
    console.log('TARGETS:', result.records[0]?.get('targets'));
    console.log('CVES:', result.records[0]?.get('cves'));
    console.log('TECHNIQUES:', result.records[0]?.get('techniques'));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await session.close();
    process.exit(0);
  }
}
run();
