import { Hono } from 'hono';
import { graphRoutes } from './graph';
import { authRoutes } from './auth';
import { aiRoutes } from './ai';
import { assetsRoutes } from './assets';
import { cveRoutes } from './cve';
import { threatActorsRoutes } from './threat-actors';
import { dashboardRoutes } from './dashboard';

// ─── V1 API Router ───────────────────────────────────────────────

export const v1Routes = new Hono();

v1Routes.route('/graph', graphRoutes);
v1Routes.route('/ai', aiRoutes);
v1Routes.route('/assets', assetsRoutes);
v1Routes.route('/cve', cveRoutes);
v1Routes.route('/threat-actors', threatActorsRoutes);
v1Routes.route('/dashboard', dashboardRoutes);
v1Routes.route('/auth', authRoutes);

// ─── V1 Info ─────────────────────────────────────────────────────

v1Routes.get('/', (c) => {
  return c.json({
    api: 'argus',
    version: 'v1',
    endpoints: ['/graph', '/ai', '/assets', '/cve', '/threat-actors'],
  });
});
