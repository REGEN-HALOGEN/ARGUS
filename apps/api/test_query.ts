import { getNeo4jDriver } from '@argus/graph'; 
async function run() { 
  const session = getNeo4jDriver().session(); 
  try { 
    const result = await session.run(`
      MATCH (t:ThreatActor) 
      OPTIONAL MATCH (t)-[:EXPLOITS]->(c:CVE) 
      OPTIONAL MATCH (t)-[:USES_TECHNIQUE]->(tech:AttackTechnique) 
      OPTIONAL MATCH (t)-[:EXPLOITS]->(:CVE)<-[:HAS_VULNERABILITY]-(a:Asset {tenantId: $tenantId}) 
      RETURN t, count(DISTINCT c) AS cveCount, count(DISTINCT tech) AS techniqueCount, count(DISTINCT a) AS targetedAssets 
      ORDER BY t.sophistication, t.name
    `, { tenantId: 'org_test' }); 
    console.log('success', result.records.length); 
  } catch (e: any) { 
    console.error('ERROR:', e.message); 
  } finally { 
    await session.close(); 
    process.exit(0); 
  } 
} 
run();
