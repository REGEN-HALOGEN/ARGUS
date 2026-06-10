import { getAuthDbPool } from '../apps/api/src/auth-db-pool';

async function main() {
  const pool = getAuthDbPool();
  await pool.query(`DELETE FROM "member" WHERE "userId" IN (SELECT id FROM "user" WHERE role = 'super_admin')`);
  console.log('Removed super admins from organizations');
  process.exit(0);
}

main();
