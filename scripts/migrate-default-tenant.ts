/**
 * Adds a default tenantId to existing local graph data.
 */

import neo4j from '../packages/graph/node_modules/neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'argus_dev_password';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'default-tenant';

async function migrateDefaultTenant() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (n)
      WHERE (n:Asset OR n:Alert OR n:CrownJewel) AND n.tenantId IS NULL
      SET n.tenantId = $tenantId
      RETURN count(n) AS updated
      `,
      { tenantId: DEFAULT_TENANT_ID },
    );

    const updated = result.records[0]?.get('updated')?.toNumber?.() ?? 0;
    console.info(`Applied tenantId=${DEFAULT_TENANT_ID} to ${updated} local graph nodes.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

migrateDefaultTenant().catch((error) => {
  console.error('Default tenant migration failed:', error);
  process.exit(1);
});
