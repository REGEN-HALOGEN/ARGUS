import { getCacheClient } from '@argus/cache';
import { fetchTopNews, syncNews } from '@argus/ingestion';
import { Hono } from 'hono';

export const newsRoutes = new Hono();

// In-memory fallback to prevent spamming if Redis is down
let _fallbackCache: { data: any; expiresAt: number } | null = null;
let _newsSyncing = false;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

newsRoutes.get('/', async (c) => {
  const client = getCacheClient();

  if (client.status === 'ready') {
    try {
      const cachedNews = await client.get('cache:news:top10');
      if (cachedNews) {
        return c.json({ success: true, data: JSON.parse(cachedNews) });
      }
    } catch (e) {
      console.error('[API] Error fetching news from cache:', e);
    }
  }

  // Check in-memory fallback
  if (_fallbackCache && _fallbackCache.expiresAt > Date.now()) {
    return c.json({ success: true, data: _fallbackCache.data });
  }

  // Cache is empty: Fast fallback + background sync
  console.info('[API] News cache empty. Performing fast fetch...');
  try {
    // 1. Get 3 raw headlines quickly
    const fastNews = await fetchTopNews(3);

    // 2. Trigger full AI sync in background (don't await) if not already syncing
    if (!_newsSyncing) {
      _newsSyncing = true;
      syncNews()
        .then((result) => {
          // If sync was successful, we should probably fetch the new cache from redis,
          // but we can also just let the next request hit redis. We'll just update the lock.
          // Wait, syncNews doesn't return the news items, it returns SyncResult.
          // Let's just set the lock to false so it can try again later if needed.
          // Actually, we should store a temporary fallback so we don't spam if Redis is permanently down.
          _fallbackCache = { data: fastNews, expiresAt: Date.now() + CACHE_TTL_MS };
        })
        .catch((err) => console.error('[API] Background news sync failed:', err))
        .finally(() => {
          _newsSyncing = false;
        });
    }

    return c.json({ success: true, data: fastNews });
  } catch (err) {
    console.error('[API] Fast news fetch failed:', err);
    return c.json({ success: true, data: [] });
  }
});
