import neo4j from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'argus_dev_password';

async function check() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();
  try {
    const res = await session.run('MATCH (n:Asset) RETURN n.type, n.name, n.tenantId LIMIT 50');
    console.log(res.records.map(r => ({ type: r.get(0), name: r.get(1), tenantId: r.get(2) })));
  } catch (e) {
    console.error(e);
  } finally {
    await session.close();
    await driver.close();
  }
}
check();
