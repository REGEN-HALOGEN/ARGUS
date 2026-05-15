import { getEnv } from '@argus/config';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { admin, organization } from 'better-auth/plugins';
import { adminAc } from 'better-auth/plugins/admin/access';
import { getAuthDbPool } from './auth-db-pool';

const env = getEnv();

// --- NUCLEAR ORIGIN FIX ---
// Force HTTPS and clean up URLs
const rawBaseURL = process.env.BETTER_AUTH_URL || 'https://argusapi-production.up.railway.app/api/v1/auth';
const baseURL = rawBaseURL.replace('http://', 'https://');

const origins = [
  env.WEB_URL,
  'https://argus-web.vercel.app',
  'https://argus-web-git-main-ashwins-projects-90bc185c.vercel.app', // Hardcoded for your current deployment
  'http://localhost:3000'
].filter(Boolean).map(url => url!.trim().replace(/\/+$/, ''));

console.info(`[AUTH] INITIALIZING WITH BASE URL: ${baseURL}`);
console.info(`[AUTH] TRUSTING ORIGINS: ${origins.join(', ')}`);

const database = getAuthDbPool();

const authConfig: BetterAuthOptions = {
  database,
  baseURL,
  trustedOrigins: origins,
  experimental: { joins: true },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      creatorRole: 'owner',
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

// Initialize database schema on startup
(async () => {
  try {
    const migrations = await getMigrations(authConfig);
    if (migrations.toBeCreated.length > 0 || migrations.toBeAdded.length > 0) {
      console.log('[AUTH] Running database migrations');
      await migrations.runMigrations();
      return;
    }
    console.log('[AUTH] Database schema up to date');
  } catch (error) {
    console.error('[AUTH] Database migration failed:', error instanceof Error ? error.message : error);
  }
})();
