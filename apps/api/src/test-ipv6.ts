import { Client } from 'pg';

async function test() {
  const connectionString = 'postgresql://postgres:TronLegacy0123@[2406:da1c:61c:d600:c5a8:c71b:9061:3b8]:5432/postgres?sslmode=require';
  console.log('Testing IPv6 Direct URL:', connectionString);
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ IPv6 Connected:', res.rows[0].now);
  } catch (err: any) {
    console.error('❌ IPv6 Failed:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

test();
