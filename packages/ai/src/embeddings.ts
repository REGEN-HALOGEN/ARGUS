import { QdrantClient } from '@qdrant/js-client-rest';
import { getGeminiClient } from './client';
import crypto from 'crypto';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
export const qdrant = new QdrantClient({ url: QDRANT_URL });

export const COLLECTION_NAME = 'cve_embeddings';

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.warn('[Embeddings] API failed, using fallback deterministic vector for:', text.substring(0, 20));
    // Fallback: deterministic pseudo-random vector based on text length to allow basic testing
    const seed = text.length;
    return new Array(768).fill(0).map((_, i) => Math.sin(seed + i));
  }
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
