import { Hono } from 'hono';
import { graphRoutes } from './graph';
import { authRoutes } from './auth';
import { aiRoutes } from './ai';
import { assetsRoutes } from './assets';
import { cveRoutes } from './cve';
import { threatActorsRoutes } from './threat-actors';
import { dashboardRoutes } from './dashboard';
import { ingestionRoutes } from './ingestion';
import { requireOrgRole, requirePlatformAdmin, requireTenant } from '../../middleware/auth';
import { onboardingRoutes } from './onboarding';
import { meRoutes } from './me';
import { adminRoutes } from './admin';
import { organizationRoutes } from './organization';

// ─── V1 API Router ───────────────────────────────────────────────

export const v1Routes = new Hono();

v1Routes.route('/auth', authRoutes);
v1Routes.route('/me', meRoutes);
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
v1Routes.route('/threat-actors', threatActorsRoutes);

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
