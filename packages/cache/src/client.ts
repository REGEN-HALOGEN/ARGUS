import Redis from 'ioredis';

const VALKEY_URL = process.env.VALKEY_URL || 'redis://localhost:6379';

class CacheClient {
  private static instance: Redis | null = null;

  public static getInstance(): Redis {
    if (!CacheClient.instance) {
      CacheClient.instance = new Redis(VALKEY_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000); // Backoff
        },
      });

      CacheClient.instance.on('error', (err) => {
        console.warn('[Cache] Connection error. Caching will gracefully fail.', err.message);
      });
      
      CacheClient.instance.on('connect', () => {
        console.log('[Cache] Connected to Valkey');
      });
    }

    return CacheClient.instance;
  }

  public static close(): void {
    if (CacheClient.instance) {
      CacheClient.instance.disconnect();
      CacheClient.instance = null;
    }
  }
}

export const getCacheClient = () => CacheClient.getInstance();
