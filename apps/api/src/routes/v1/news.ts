import { getCacheClient } from '@argus/cache';
import { fetchTopNews, syncNews } from '@argus/ingestion';
import { Hono } from 'hono';

export const newsRoutes = new Hono();

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

  // Cache is empty: Fast fallback + background sync
  console.info('[API] News cache empty. Performing fast fetch...');
  try {
    // 1. Get 3 raw headlines quickly
    const fastNews = await fetchTopNews(3);

    // 2. Trigger full AI sync in background (don't await)
    syncNews().catch((err) => console.error('[API] Background news sync failed:', err));

    return c.json({ success: true, data: fastNews });
  } catch (err) {
    console.error('[API] Fast news fetch failed:', err);
    return c.json({ success: true, data: [] });
  }
});
