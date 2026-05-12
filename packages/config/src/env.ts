import { z } from 'zod';

// ─── Environment Schema ──────────────────────────────────────────

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

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
  BETTER_AUTH_URL: z.string().url().default('http://localhost:4000'),

  // NVD
  NVD_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// ─── Validate Environment ────────────────────────────────────────

let _env: Env | undefined;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${errors?.join(', ')}`)
      .join('\n');

    throw new Error(`❌ Invalid environment variables:\n${message}`);
  }

  _env = result.data;
  return _env;
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
