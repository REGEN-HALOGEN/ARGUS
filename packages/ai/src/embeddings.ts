import { QdrantClient } from '@qdrant/js-client-rest';
import { getEnv } from '@argus/config';
import crypto from 'crypto';

const qdrantEnv = getEnv();
export const qdrant = new QdrantClient({
  url: qdrantEnv.QDRANT_URL,
  ...(qdrantEnv.QDRANT_API_KEY ? { apiKey: qdrantEnv.QDRANT_API_KEY } : {}),
});

export const COLLECTION_NAME = 'cve_embeddings';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent`;

export async function generateEmbedding(text: string): Promise<number[]> {
  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    console.warn('[Embeddings] No GEMINI_API_KEY set, using fallback vector');
    return fallbackVector(text);
  }

  try {
    const res = await fetch(`${EMBEDDING_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding API ${res.status}: ${body.substring(0, 200)}`);
    }

    const data = await res.json();
    return data.embedding.values;
  } catch (error) {
    console.warn('[Embeddings] API failed:', (error as Error).message?.substring(0, 120));
    return fallbackVector(text);
  }
}

function fallbackVector(text: string): number[] {
  const seed = text.length;
  return new Array(768).fill(0).map((_, i) => Math.sin(seed + i));
}

export async function initQdrant() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: 768, distance: 'Cosine' },
      });
      console.log(`[Qdrant] Created collection ${COLLECTION_NAME}`);
    }
  } catch (error) {
    console.warn('[Qdrant] Failed to init. Is Qdrant running?', (error as Error).message);
  }
}

// Qdrant point IDs must be integers or UUIDs
function hashId(id: string): string {
  return crypto.createHash('md5').update(id).digest('hex');
}

export async function indexCVE(cveId: string, description: string, severity: string, cvss: number) {
  try {
    const vector = await generateEmbedding(`${cveId}: ${description}`);
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: hashId(cveId).substring(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
          vector,
          payload: { cveId, description, severity, cvss },
        },
      ],
    });
  } catch (error) {
    console.warn(`[Qdrant] Failed to index ${cveId}:`, (error as Error).message);
  }
}

export async function searchCVEs(query: string, limit = 5) {
  try {
    const vector = await generateEmbedding(query);
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit,
      with_payload: true,
    });
    return results;
  } catch (error) {
    console.warn('[Qdrant] Search failed:', (error as Error).message);
    return [];
  }
}
