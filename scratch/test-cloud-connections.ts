import { getEnv } from '@argus/config';
import { Pool } from 'pg';
import { getNeo4jDriver } from '@argus/graph';
import { getCacheClient } from '@argus/cache';

async function testConnections() {
  const env = getEnv();
  console.log('🚀 Starting Cloud Connection Tests (using internal packages)...\n');

  // 1. PostgreSQL (Supabase)
  console.log('1. Testing PostgreSQL (Supabase)...');
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL Connected:', res.rows[0].now);
  } catch (err: any) {
    console.error('❌ PostgreSQL Failed:', err.message);
  } finally {
    await pool.end();
  }

  // 2. Neo4j (AuraDB)
  console.log('\n2. Testing Neo4j (AuraDB)...');
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();
    const result = await session.run('RETURN "Connected" as status');
    console.log('✅ Neo4j Connected:', result.records[0].get('status'));
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
      const text = await res.text();
      console.error('❌ Qdrant Failed:', res.status, res.statusText, text);
    }
  } catch (err: any) {
    console.error('❌ Qdrant Failed:', err.message);
  }

  console.log('\n🏁 Tests Finished.');
  process.exit(0);
}

testConnections();
