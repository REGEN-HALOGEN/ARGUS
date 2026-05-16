/**
 * Verifies DATABASE_URL (Supabase / Postgres) is reachable from this machine.
 * Run from repo root: bun run db:test:pg
 */
import { getEnv } from '@argus/config';
import pg from 'pg';

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) {
      u.password = '****';
    }
    return u.toString();
  } catch {
    return '(could not parse DATABASE_URL as URL — check encoding of password)';
  }
}

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

function isCertChainError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  const m = message.toLowerCase();
  return (
    m.includes('self signed certificate') ||
    m.includes('certificate chain') ||
    m.includes('unable to verify')
  );
}

async function tryQuery(databaseUrl: string, sslInsecure: boolean) {
  const pool = new pg.Pool({
    connectionString: pgConnectionStringForPool(databaseUrl, sslInsecure),
    connectionTimeoutMillis: 15_000,
    max: 1,
    ...(sslInsecure ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  try {
    return await pool.query(
      'select 1 as ok, current_database() as database, current_user as "user", now() as server_time',
    );
  } finally {
    await pool.end();
  }
}

async function main() {
  const env = getEnv();
  console.log('Connecting with:', maskDatabaseUrl(env.DATABASE_URL));

  const envInsecure = env.DATABASE_SSL_INSECURE === 'true';

  const run = async (insecure: boolean) => tryQuery(env.DATABASE_URL, insecure);

  try {
    let rows: { ok: number; database: string; user: string; server_time: Date }[];

    if (envInsecure) {
      const r = await run(true);
      rows = r.rows as typeof rows;
    } else {
      try {
        const r = await run(false);
        rows = r.rows as typeof rows;
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        if (isCertChainError(msg) && env.NODE_ENV === 'development') {
          console.log(
            '\nTLS: certificate verification failed (common on Windows with proxies). Retrying with relaxed TLS for this test only.',
          );
          console.log(
            'Add DATABASE_SSL_INSECURE=true to .env so the API uses the same behavior.\n',
          );
          const r = await run(true);
          rows = r.rows as typeof rows;
        } else {
          throw firstErr;
        }
      }
    }

    console.log('\nPostgreSQL OK:');
    console.log(rows[0]);
    console.log('\nSupabase/Postgres is reachable for this project.');
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error('\nConnection failed:', e.message ?? err);
    if (e.code === '28P01') {
      console.error(
        '\nHint: 28P01 = wrong database user or password in DATABASE_URL (not API keys).',
      );
    }
    if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      console.error(
        '\nHint: Check network / IPv4 vs IPv6. Try Session pooler URI from Supabase if direct host fails.',
      );
    }
    if (isCertChainError(e.message)) {
      console.error(
        '\nHint: TLS certificate issue. For local dev add DATABASE_SSL_INSECURE=true to .env, then retry.',
      );
    }
    process.exit(1);
  }
}

void main();
