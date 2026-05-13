import { Hono } from 'hono';
import { runFullSync, syncNVD, syncCISAKEV, syncMITRE } from '@argus/ingestion';

export const ingestionRoutes = new Hono();

// Trigger full sync manually
ingestionRoutes.post('/sync', async (c) => {
  const results = await runFullSync();
  return c.json({ success: true, data: results });
});

// Trigger individual source sync
ingestionRoutes.post('/sync/:source', async (c) => {
  const source = c.req.param('source');

  let syncFn;
  switch (source) {
    case 'nvd':
      syncFn = syncNVD;
      break;
    case 'cisa':
      syncFn = syncCISAKEV;
      break;
    case 'mitre':
      syncFn = syncMITRE;
      break;
    default:
      return c.json({ success: false, error: { code: 'INVALID_SOURCE', message: `Unknown source: ${source}` } }, 400);
  }

  const result = await syncFn();
  return c.json({ success: true, data: result });
});

// Get last sync status
ingestionRoutes.get('/status', async (c) => {
  // TODO: Store last sync results in Valkey cache
  return c.json({ success: true, data: { message: 'Implement sync status tracking' } });
});
