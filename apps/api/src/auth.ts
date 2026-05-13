import { getEnv } from '@argus/config';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { admin, organization } from 'better-auth/plugins';
import { adminAc } from 'better-auth/plugins/admin/access';
import { getAuthDbPool } from './auth-db-pool';

const rawBaseURL = process.env.BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth';
const baseURL = rawBaseURL.endsWith('/api/v1/auth')
  ? rawBaseURL
  : `${rawBaseURL.replace(/\/+$/, '')}/api/v1/auth`;

function trustedOrigins(): string[] {
  const env = getEnv();
  return Array.from(new Set([env.WEB_URL, 'http://localhost:3000']));
}

const database = getAuthDbPool();

const authConfig: BetterAuthOptions = {
  database,
  baseURL,
  trustedOrigins: trustedOrigins(),
  experimental: { joins: true },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      creatorRole: 'owner',
      afterCreateOrganization: async ({ organization }: { organization: { id: string } }) => {
        console.info(`[AUTH] Created organization ${organization.id}`);
      },
    }),
    admin({
      defaultRole: 'user',
      adminRoles: ['super_admin'],
      roles: {
        super_admin: adminAc,
      },
    }),
  ],
};

export const auth = betterAuth(authConfig) as any;

// Initialize database schema on startup (non-blocking)
(async () => {
  try {
    const migrations = await getMigrations(authConfig);

    if (migrations.toBeCreated.length > 0 || migrations.toBeAdded.length > 0) {
      console.log('[AUTH] Running database migrations');
      await migrations.runMigrations();
      console.log('[AUTH] Database migrations complete');
      return;
    }

    console.log('[AUTH] Database schema up to date');
  } catch (error) {
    console.error('[AUTH] Database migration failed:', error instanceof Error ? error.message : error);
  }
})();
