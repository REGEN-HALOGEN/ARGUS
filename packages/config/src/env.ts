import { z } from 'zod';
import { loadRootEnv } from './load-root-env';

// ─── Environment Schema ──────────────────────────────────────────

const baseEnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

  // PostgreSQL (Supabase: URI from Project Settings → Database; include sslmode=require if required)
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (Supabase Postgres or local PostgreSQL)'),
  /** Dev-only: set "true" if pg fails with "self signed certificate in certificate chain" (some Windows / proxy setups). */
  DATABASE_SSL_INSECURE: z.enum(['true', 'false']).optional().default('false'),

  // Neo4j
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('argus_dev_password'),

  // Qdrant
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Valkey
  VALKEY_URL: z.string().default('redis://localhost:6379'),

  // Google Gemini
  GEMINI_API_KEY: z.string().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().default('dev-secret-change-in-production'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:4000/api/v1/auth'),

  // NVD
  NVD_API_KEY: z.string().optional(),

  // OTX
  OTX_API_KEY: z.string().optional(),

  // Ingestion
  INGESTION_INTERVAL_HOURS: z.coerce.number().default(6),
});

const envSchema = baseEnvSchema.superRefine((data, ctx) => {
  const url = data.DATABASE_URL;
  if (url.includes('[YOUR-PASSWORD]')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Replace the placeholder in DATABASE_URL with your real Supabase database password (Project Settings → Database). Use the database password, not the anon or service_role API key. If the password contains @ # / etc., URL-encode it in the URI.',
      path: ['DATABASE_URL'],
    });
  }
});

export type Env = z.infer<typeof baseEnvSchema>;

// ─── Validate Environment ────────────────────────────────────────

export function getEnv(): Env {
  loadRootEnv();
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${errors?.join(', ')}`)
      .join('\n');

    throw new Error(`❌ Invalid environment variables:\n${message}`);
  }

  return result.data;
}

// ─── Feature Flags ───────────────────────────────────────────────

export function isDev(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export function isProd(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}
