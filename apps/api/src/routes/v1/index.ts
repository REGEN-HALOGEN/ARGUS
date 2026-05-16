import { Hono } from 'hono';
import {
  requireAuth,
  requireOrgRole,
  requirePlatformAdmin,
  requireTenant,
} from '../../middleware/auth';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { assetsRoutes } from './assets';
import { authRoutes } from './auth';
import { cveRoutes } from './cve';
import { dashboardRoutes } from './dashboard';
import { graphRoutes } from './graph';
import { ingestionRoutes } from './ingestion';
import { meRoutes } from './me';
import { newsRoutes } from './news';
import { onboardingRoutes } from './onboarding';
import { organizationRoutes } from './organization';
import { threatActorsRoutes } from './threat-actors';

// ─── V1 API Router ───────────────────────────────────────────────

export const v1Routes = new Hono();

v1Routes.route('/auth', authRoutes);

v1Routes.use('/me', requireAuth());
v1Routes.use('/me/*', requireAuth());
v1Routes.route('/me', meRoutes);

v1Routes.use('/onboarding', requireAuth());
v1Routes.use('/onboarding/*', requireAuth());
v1Routes.route('/onboarding', onboardingRoutes);

v1Routes.use('/graph', requireTenant());
v1Routes.use('/graph/*', requireTenant());
v1Routes.route('/graph', graphRoutes);

v1Routes.use('/ai', requireTenant());
v1Routes.use('/ai/*', requireTenant());
v1Routes.route('/ai', aiRoutes);

v1Routes.use('/organization', requireTenant());
v1Routes.use('/organization/*', requireTenant());
v1Routes.route('/organization', organizationRoutes);

v1Routes.use('/assets', requireTenant());
v1Routes.use('/assets/*', requireTenant());
v1Routes.route('/assets', assetsRoutes);

v1Routes.use('/cve', requireTenant());
v1Routes.use('/cve/*', requireTenant());
v1Routes.route('/cve', cveRoutes);

v1Routes.use('/threat-actors', requireTenant());
v1Routes.use('/threat-actors/*', requireTenant());
v1Routes.route('/threat-actors', threatActorsRoutes);

v1Routes.use('/news', requireTenant());
v1Routes.use('/news/*', requireTenant());
v1Routes.route('/news', newsRoutes);

v1Routes.use('/dashboard', requireTenant());
v1Routes.use('/dashboard/*', requireTenant());
v1Routes.route('/dashboard', dashboardRoutes);

v1Routes.use('/ingestion', requireTenant(), requireOrgRole('operator', 'org_admin'));
v1Routes.use('/ingestion/*', requireTenant(), requireOrgRole('operator', 'org_admin'));
v1Routes.route('/ingestion', ingestionRoutes);

v1Routes.use('/admin', requirePlatformAdmin());
v1Routes.use('/admin/*', requirePlatformAdmin());
v1Routes.route('/admin', adminRoutes);

// ─── V1 Info ─────────────────────────────────────────────────────

v1Routes.get('/', (c) => {
  return c.json({
    api: 'argus',
    version: 'v1',
    endpoints: [
      '/graph',
      '/ai',
      '/assets',
      '/cve',
      '/threat-actors',
      '/dashboard',
      '/organization',
      '/admin',
      '/onboarding',
    ],
  });
});
