import { auth } from '../apps/api/src/auth';
import { getAuthDbPool } from '../apps/api/src/auth-db-pool';

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const pool = getAuthDbPool();
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [table, column],
  );
  return (r.rowCount ?? 0) > 0;
}

async function deleteIfColumnExists(table: string, column: string, value: string) {
  const pool = getAuthDbPool();
  if (!(await tableHasColumn(table, column))) {
    return;
  }
  await pool.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [value]);
}

async function resetAdminUser(email: string) {
  const pool = getAuthDbPool();
  const found = await pool.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1 LIMIT 1`, [email]);
  const userId = found.rows[0]?.id;
  if (!userId) {
    return false;
  }

  await deleteIfColumnExists('session', 'userId', userId);
  await deleteIfColumnExists('account', 'userId', userId);
  await deleteIfColumnExists('member', 'userId', userId);
  await deleteIfColumnExists('invitation', 'invitedBy', userId);
  await deleteIfColumnExists('verification', 'userId', userId);
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  return true;
}

async function seedAdmin() {
  try {
    await auth.api.getSession({ headers: new Headers() }).catch(() => null);

    await resetAdminUser('admin@argus.local');

    const res = await auth.api.signUpEmail({
      body: {
        email: 'admin@argus.local',
        password: 'AdminPassword123!',
        name: 'ARGUS Admin',
      },
    });

    if (res?.user) {
      const pool = getAuthDbPool();
      await pool.query(`UPDATE "user" SET role = $1 WHERE email = $2`, ['super_admin', 'admin@argus.local']);
      console.log('✅ Admin user created successfully:');
      console.log('Email: admin@argus.local');
      console.log('Password: AdminPassword123!');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to create admin:', message);
  }
}

void seedAdmin();
