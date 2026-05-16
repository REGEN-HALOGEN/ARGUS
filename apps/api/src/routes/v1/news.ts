import { getCacheClient } from '@argus/cache';
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

  return c.json({ success: true, data: [] });
});
