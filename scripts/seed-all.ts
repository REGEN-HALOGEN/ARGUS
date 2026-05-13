import { auth } from '../apps/api/src/auth';
import { getAuthDbPool } from '../apps/api/src/auth-db-pool';
import * as fs from 'fs';
import * as path from 'path';

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

async function removeUser(email: string) {
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

async function removeOrg(slug: string) {
  const pool = getAuthDbPool();
  // Ensure we also clean up organization by slug
  if (!(await tableHasColumn('organization', 'slug'))) return;
  const found = await pool.query<{ id: string }>(`SELECT id FROM "organization" WHERE slug = $1 LIMIT 1`, [slug]);
  const orgId = found.rows[0]?.id;
  if (!orgId) return;

  await pool.query(`DELETE FROM "member" WHERE "organizationId" = $1`, [orgId]);
  await pool.query(`DELETE FROM "invitation" WHERE "organizationId" = $1`, [orgId]);
  await pool.query(`DELETE FROM "organization" WHERE id = $1`, [orgId]);
}

async function main() {
  try {
    const adminEmail = 'admin@argus.local';
    const adminPassword = 'AdminPassword123!';
    const userEmail = 'user@argus.local';
    const userPassword = 'UserPassword123!';
    const orgName = 'Acme Corp';
    const orgSlug = 'acme-corp';

    console.log('Cleaning up existing users and orgs...');
    await removeUser(adminEmail);
    await removeUser(userEmail);
    await removeOrg(orgSlug);

    console.log('Creating Admin...');
    const adminRes = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: 'ARGUS Super Admin',
      },
    });

    let adminHeaders;

    if (adminRes?.user) {
      const pool = getAuthDbPool();
      await pool.query(`UPDATE "user" SET role = $1 WHERE email = $2`, ['super_admin', adminEmail]);
      console.log('✅ Admin user created successfully');
      
      // Attempt to sign in to get headers (session token) for auth.api calls
      const signinRes = await auth.api.signInEmail({
         body: { email: adminEmail, password: adminPassword },
         asResponse: true
      });
      adminHeaders = signinRes.headers;
    }

    console.log('Creating Regular User...');
    const userRes = await auth.api.signUpEmail({
      body: {
        email: userEmail,
        password: userPassword,
        name: 'Regular User',
      },
    });

    let userHeaders;

    if (userRes?.user) {
      console.log('✅ Regular user created successfully');
      
      const signinRes = await auth.api.signInEmail({
         body: { email: userEmail, password: userPassword },
         asResponse: true
      });
      userHeaders = signinRes.headers;
    }
    
    // Auth organization API requires standard requests.
    // However, because Better Auth creates organizations bound to the currently authenticated user
    // We pass the user's headers to auth.api.createOrganization.
    if (userHeaders && userRes?.user) {
        console.log('Creating Organization for Regular User...');
        try {
            const pool = getAuthDbPool();
            const orgId = 'org_' + Math.random().toString(36).substring(2, 10);
            const now = new Date();
            
            await pool.query(
                'INSERT INTO "organization" (id, name, slug, "createdAt") VALUES ($1, $2, $3, $4)', 
                [orgId, orgName, orgSlug, now]
            );

            await pool.query(
                'INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
                ['mem_' + Math.random().toString(36).substring(2, 10), orgId, userRes.user.id, 'owner', now]
            );
            
            console.log('✅ Organization created successfully via SQL');
        } catch (e: any) {
            console.error('Failed to create organization via SQL:', e.message);
        }
    }

    const output = `ARGUS Application Login Details

--- SUPER ADMIN ---
Email: ${adminEmail}
Password: ${adminPassword}

--- REGULAR USER ---
Email: ${userEmail}
Password: ${userPassword}
Organization: ${orgName} (slug: ${orgSlug})
`;

    const outputPath = path.join(process.cwd(), 'default.txt');
    fs.writeFileSync(outputPath, output, 'utf8');

    console.log(`\nAll details written to ${outputPath}`);
    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed:', message);
    process.exit(1);
  }
}

void main();