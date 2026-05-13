import { getEnv } from '@argus/config';
import { Pool } from 'pg';

let pool: Pool | null = null;

function pgConnectionStringForPool(databaseUrl: string, sslInsecure: boolean): string {
  if (!sslInsecure) {
    return databaseUrl;
  }
  try {
    const u = new URL(databaseUrl);
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return databaseUrl;
  }
}

export function getAuthDbPool(): Pool {
  if (!pool) {
    const env = getEnv();
    const insecure = env.DATABASE_SSL_INSECURE === 'true';
    pool = new Pool({
      connectionString: pgConnectionStringForPool(env.DATABASE_URL, insecure),
      max: 15,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ...(insecure ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }
  return pool;
}
