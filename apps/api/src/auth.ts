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
let baseURL = rawBaseURL.replace('http://', 'https://');

// Fail-safe: If we are on Railway but baseURL still says localhost, force the production URL
if (baseURL.includes('localhost') && process.env.RAILWAY_STATIC_URL) {
  baseURL = 'https://argusapi-production.up.railway.app/api/v1/auth';
}

const origins = [
  env.WEB_URL,
  'https://argus-web-three.vercel.app',
  'https://argus-web.vercel.app',
  'https://argus-ngzfjupwf-ashwins-projects-90bc185c.vercel.app', // From logs
  'http://localhost:3000'
].filter(Boolean).map(url => url!.trim().replace(/\/+$/, ''));

// DYNAMIC VERCEL TRUST: If we are in production, trust common Vercel patterns
if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
  origins.push('https://argus-web-three.vercel.app');
  // Add wildcards or more specific patterns if needed
}

console.info(`[AUTH] INITIALIZING WITH BASE URL: ${baseURL}`);
console.info(`[AUTH] TRUSTED ORIGINS: ${origins.join(', ')}`);
console.info(`[AUTH] WEB_URL ENV: ${env.WEB_URL}`);

const database = getAuthDbPool();

const authConfig: BetterAuthOptions = {
  database,
  baseURL,
  trustHost: true, // Crucial for Railway's proxy
  trustedOrigins: origins,
  experimental: { joins: true },
  advanced: {
    cookiePrefix: 'argus',
  },
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
