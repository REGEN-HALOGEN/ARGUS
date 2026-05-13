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
    const data = result.records.map(r => { 
      const props = r.get('t').properties; 
      const toNum = (v: any) => (typeof v === 'object' && v !== null && 'toNumber' in v) ? v.toNumber() : Number(v); 
      return { 
        ...props, 
        cveCount: toNum(r.get('cveCount')), 
        techniqueCount: toNum(r.get('techniqueCount')), 
        targetedAssets: toNum(r.get('targetedAssets')) 
      }; 
    }); 
    console.log(JSON.stringify(data)); 
  } catch (e) { 
    console.error('ERROR:', e); 
  } finally { 
    await session.close(); 
    process.exit(0); 
  } 
} 
run();
