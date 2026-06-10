import { getEnv } from '@argus/config';
import { testConnection as testNeo4j } from '@argus/graph';
import { Hono } from 'hono';
import { getAuthDbPool } from '../../auth-db-pool';

export const healthRoutes = new Hono();

// ─── Service Health Check ────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: 'connected' | 'disconnected';
  latencyMs: number | null;
  uri: string;
}

healthRoutes.get('/services', async (c) => {
  const env = getEnv();
  const results: ServiceStatus[] = [];

  // 1. Neo4j
  const neo4jStart = Date.now();
  try {
    const ok = await testNeo4j();
    results.push({
      name: 'Neo4j',
      status: ok ? 'connected' : 'disconnected',
      latencyMs: Date.now() - neo4jStart,
      uri: env.NEO4J_URI,
    });
  } catch {
    results.push({
      name: 'Neo4j',
      status: 'disconnected',
      latencyMs: Date.now() - neo4jStart,
      uri: env.NEO4J_URI,
    });
  }

  // 2. Qdrant
  const qdrantStart = Date.now();
  try {
    const res = await fetch(`${env.QDRANT_URL}/healthz`, { signal: AbortSignal.timeout(5000) });
    results.push({
      name: 'Qdrant',
      status: res.ok ? 'connected' : 'disconnected',
      latencyMs: Date.now() - qdrantStart,
      uri: env.QDRANT_URL,
    });
  } catch {
    results.push({
      name: 'Qdrant',
      status: 'disconnected',
      latencyMs: Date.now() - qdrantStart,
      uri: env.QDRANT_URL,
    });
  }

  // 3. Valkey (Redis)
  const valkeyStart = Date.now();
  try {
    const { getCacheClient } = await import('@argus/cache');
    const client = getCacheClient();
    const pong = await client.ping();
    results.push({
      name: 'Valkey (Redis)',
      status: pong === 'PONG' ? 'connected' : 'disconnected',
      latencyMs: Date.now() - valkeyStart,
      uri: env.VALKEY_URL,
    });
  } catch {
    results.push({
      name: 'Valkey (Redis)',
      status: 'disconnected',
      latencyMs: Date.now() - valkeyStart,
      uri: env.VALKEY_URL,
    });
  }

  // 4. Supabase (PostgreSQL)
  const pgStart = Date.now();
  try {
    const pool = getAuthDbPool();
    const res = await pool.query('SELECT 1 AS ok');
    results.push({
      name: 'Supabase (Auth)',
      status: res.rows.length > 0 ? 'connected' : 'disconnected',
      latencyMs: Date.now() - pgStart,
      uri: 'PostgreSQL',
    });
  } catch {
    results.push({
      name: 'Supabase (Auth)',
      status: 'disconnected',
      latencyMs: Date.now() - pgStart,
      uri: 'PostgreSQL',
    });
  }
  // 5. Google Gemini (LLM)
  const llmStart = Date.now();
  try {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      results.push({
        name: 'Gemini (LLM)',
        status: 'disconnected',
        latencyMs: 0,
        uri: 'No API key configured',
      });
    } else {
      // List models endpoint — validates key without using tokens
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
        { signal: AbortSignal.timeout(5000) },
      );
      results.push({
        name: 'Gemini (LLM)',
        status: res.ok ? 'connected' : 'disconnected',
        latencyMs: Date.now() - llmStart,
        uri: 'Google Generative AI',
      });
    }
  } catch {
    results.push({
      name: 'Gemini (LLM)',
      status: 'disconnected',
      latencyMs: Date.now() - llmStart,
      uri: 'Google Generative AI',
    });
  }

  return c.json({ success: true, data: results });
});
