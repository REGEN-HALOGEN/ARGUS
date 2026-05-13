/**
 * Quick verification: check tables + users in Supabase Postgres
 */
import { getEnv } from '@argus/config';
import pg from 'pg';

async function main() {
  const env = getEnv();
  let connStr = env.DATABASE_URL;
  try {
    const u = new URL(connStr);
    u.searchParams.delete('sslmode');
    connStr = u.toString();
  } catch { /* keep as-is */ }

  const pool = new pg.Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // 1. List all public tables
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log('=== Tables in Supabase public schema ===');
    console.log(tables.rows.map((r: any) => r.table_name).join(', '));

    // 2. Check user table
    const users = await pool.query(`SELECT id, name, email, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`);
    console.log('\n=== Users ===');
    console.table(users.rows);

    // 3. Check account table
    const accounts = await pool.query(`SELECT id, "userId", "providerId" FROM "account" LIMIT 5`);
    console.log('\n=== Accounts ===');
    console.table(accounts.rows);

    // 4. Check session table
    const sessions = await pool.query(`SELECT id, "userId", "expiresAt" FROM "session" LIMIT 5`);
    console.log('\n=== Sessions ===');
    console.table(sessions.rows);

    // 5. Check if organization table exists
    const orgCheck = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization' LIMIT 1`
    );
    if (orgCheck.rowCount && orgCheck.rowCount > 0) {
      const orgs = await pool.query(`SELECT * FROM "organization" LIMIT 5`);
      console.log('\n=== Organizations ===');
      console.table(orgs.rows);
    } else {
      console.log('\n=== Organizations table: not yet created ===');
    }

    console.log('\n✅ All Supabase checks passed.');
  } catch (err) {
    console.error('❌ Verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
