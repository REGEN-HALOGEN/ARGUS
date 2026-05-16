import { getEnv } from '@argus/config';
import { Client } from 'pg';
import { getNeo4jDriver } from '@argus/graph';
import { getCacheClient } from '@argus/cache';

async function testConnections() {
  const env = getEnv();
  console.log('🚀 Starting Cloud Connection Tests (Final Polish)...\n');

  // 1. PostgreSQL (Supabase)
  console.log('1. Testing PostgreSQL (Supabase)...');
  // Use Client instead of Pool for simple test, and force SSL via config
  const client = new Client({ 
    connectionString: env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL Connected:', res.rows[0].now);
  } catch (err: any) {
    console.error('❌ PostgreSQL Failed:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await client.end().catch(() => {});
  }

  // 2. Neo4j (AuraDB)
  console.log('\n2. Testing Neo4j (AuraDB)...');
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();
    const result = await session.run('RETURN "Connected" as status');
    console.log('✅ Neo4j Connected:', result.records[0]?.get('status'));
    await session.close();
  } catch (err: any) {
    console.error('❌ Neo4j Failed:', err.message);
  }

  // 3. Upstash Redis
  console.log('\n3. Testing Redis (Upstash)...');
  try {
    const redis = getCacheClient();
    const pong = await redis.ping();
    console.log('✅ Redis Connected:', pong);
  } catch (err: any) {
    console.error('❌ Redis Failed:', err.message);
  }

  // 4. Qdrant Cloud
  console.log('\n4. Testing Qdrant Cloud...');
  try {
    const res = await fetch(`${env.QDRANT_URL}/healthz`, {
      headers: env.QDRANT_API_KEY ? { 'api-key': env.QDRANT_API_KEY } : {}
    });
    if (res.ok) {
      console.log('✅ Qdrant Connected (Health OK)');
    } else {
      console.error('❌ Qdrant Failed:', res.status, res.statusText);
    }
  } catch (err: any) {
    console.error('❌ Qdrant Failed:', err.message);
  }

  console.log('\n🏁 Tests Finished.');
  process.exit(0);
}

testConnections();
