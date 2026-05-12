import { getCacheClient } from './client';

/**
 * Helper to execute a function and cache its result.
 * If the cache is unavailable, gracefully falls back to executing the function.
 * 
 * @param key The cache key
 * @param ttlSeconds Time to live in seconds
 * @param fetcher Function that returns the data if cache misses
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const client = getCacheClient();
  
  if (client.status !== 'ready') {
    // If not ready, just bypass cache
    return fetcher();
  }

  try {
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.warn(`[Cache] Error reading key ${key}:`, error);
  }

  const result = await fetcher();

  try {
    if (client.status === 'ready') {
      await client.setex(key, ttlSeconds, JSON.stringify(result));
    }
  } catch (error) {
    console.warn(`[Cache] Error setting key ${key}:`, error);
  }

  return result;
}

export async function invalidateCache(keyPattern: string): Promise<void> {
  const client = getCacheClient();
  if (client.status !== 'ready') return;
  
  try {
    const keys = await client.keys(keyPattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.warn(`[Cache] Error invalidating pattern ${keyPattern}:`, error);
  }
}
