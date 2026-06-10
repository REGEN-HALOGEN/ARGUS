import Redis from 'ioredis';

class CacheClient {
  private static instance: Redis | null = null;

  public static getInstance(): Redis {
    if (!CacheClient.instance) {
      // Read URL lazily to ensure loadRootEnv() from @argus/config has populated process.env
      const valkeyUrl = process.env.VALKEY_URL || 'redis://localhost:6379';

      CacheClient.instance = new Redis(valkeyUrl, {
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
        console.log('[Cache] Connected to Redis / Valkey');
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
