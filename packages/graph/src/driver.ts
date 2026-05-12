import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { getEnv } from '@argus/config';

// ─── Neo4j Driver Singleton ──────────────────────────────────────

let _driver: Driver | undefined;

export function getNeo4jDriver(): Driver {
  if (_driver) return _driver;

  const env = getEnv();

  _driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 10000,
      logging: {
        level: 'warn',
        logger: (level, message) => {
          if (level === 'error' || level === 'warn') {
            console.error(`[Neo4j ${level}] ${message}`);
          }
        },
      },
    },
  );

  return _driver;
}

// ─── Session Helper ──────────────────────────────────────────────

export function getSession(database = 'neo4j'): Session {
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
