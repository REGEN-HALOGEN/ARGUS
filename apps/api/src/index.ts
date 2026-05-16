// ─── ARGUS API ─────────────────────────────────────────────────── (Trigger: 2026-05-15T23:37)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { getEnv } from '@argus/config';
import { errorHandler } from './middleware/error-handler';
import { v1Routes } from './routes/v1';

const env = getEnv();

// ─── Root App (The entry point) ──────────────────────────────────
const rootApp = new Hono();

// ─── Global CORS (Must be at the very top of rootApp) ─────────────
rootApp.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow local development
      if (!origin || origin === 'http://localhost:3000' || origin === 'http://localhost:4000') {
        return origin || 'http://localhost:3000';
      }
      // Allow any Vercel deployment
      if (origin.endsWith('.vercel.app') || (env.WEB_URL && origin === env.WEB_URL)) {
        return origin;
      }
      return 'http://localhost:3000';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'cookie'],
    credentials: true,
    exposeHeaders: ['Set-Cookie'],
  }),
);

rootApp.use('*', logger());
rootApp.use('*', prettyJSON());
rootApp.use('*', secureHeaders());

// --- DIAGNOSTIC ORIGIN LOGGING ---
rootApp.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const host = c.req.header('Host');
  if (c.req.path.includes('/auth')) {
    console.info(`[AUTH-DEBUG] Path: ${c.req.path} | Origin: ${origin} | Host: ${host}`);
  }
  await next();
});

// --- FAIL-SAFE CROSS-SITE COOKIE FIX ---
rootApp.use('*', async (c, next) => {
  await next();
  const setCookie = c.res.headers.get('Set-Cookie');
  if (setCookie) {
    let fixedCookie = setCookie;
    // Replace Lax/Strict with None
    fixedCookie = fixedCookie.replace(/SameSite=(Lax|Strict)/gi, 'SameSite=None');
    
    // Ensure required attributes for cross-site cookies are present
    if (!fixedCookie.includes('SameSite=None')) fixedCookie += '; SameSite=None';
    if (!fixedCookie.includes('Secure')) fixedCookie += '; Secure';
    if (!fixedCookie.includes('Partitioned')) fixedCookie += '; Partitioned';
    
    if (fixedCookie !== setCookie) {
      c.res.headers.set('Set-Cookie', fixedCookie);
    }
  }
});

// ─── API Sub-App ─────────────────────────────────────────────────
const app = new Hono();

// ─── Error Handler ───────────────────────────────────────────────
app.onError(errorHandler);

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'argus-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ──────────────────────────────────────────────────
app.route('/v1', v1Routes);

// ─── Main Route ──────────────────────────────────────────────────
rootApp.get('/', (c) => {
  return c.json({
    message: 'ARGUS API Server is running',
    health: '/api/health',
    version: 'v1',
  });
});

// Mount the API app at /api
rootApp.route('/api', app);

// ─── Start Server ────────────────────────────────────────────────
const port = env.PORT;

import { startScheduler } from '@argus/ingestion';
startScheduler();

console.info(`
  ╔═══════════════════════════════════════════╗
  ║           ARGUS API Server                ║
  ║─────────────────────────────────────────  ║
  ║  🌐 Port:     ${String(port).padEnd(27)}║
  ║  🔧 Mode:     ${String(env.NODE_ENV).padEnd(27)}║
  ║  📡 Health:   /api/health${' '.repeat(16)}║
  ╚═══════════════════════════════════════════╝
`);

export default {
  port,
  fetch: rootApp.fetch,
};
