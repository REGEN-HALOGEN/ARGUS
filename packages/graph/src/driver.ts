import { getEnv } from '@argus/config';
import neo4j, { type Driver, type Session } from 'neo4j-driver';

// ─── Neo4j Driver Singleton ──────────────────────────────────────

let _driver: Driver | undefined;

export function getNeo4jDriver(): Driver {
  if (_driver) return _driver;

  const env = getEnv();

  console.info(`[Neo4j] Initializing driver for: ${env.NEO4J_URI}`);

  _driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD), {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30000,  // 30s — AuraDB free tier can be slow to wake
    connectionTimeout: 30000,             // 30s for initial connection establishment
    maxTransactionRetryTime: 15000,       // 15s retry for transient errors
    logging: {
      level: 'warn',
      logger: (level, message) => console.warn(`[Neo4j][${level}]`, message),
    },
  });

  return _driver;
}

// ─── Session Helper ──────────────────────────────────────────────

export function getSession(database?: string): Session {
  return getNeo4jDriver().session({ database });
}

// ─── Connection Test ─────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  const session = getSession();
  try {
    await session.run('RETURN 1 AS connected');
    return true;
  } catch {
    return false;
  } finally {
    await session.close();
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────

export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = undefined;
  }
}
