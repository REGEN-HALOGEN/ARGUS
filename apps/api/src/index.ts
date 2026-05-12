import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { getEnv } from '@argus/config';
import { errorHandler } from './middleware/error-handler';
import { v1Routes } from './routes/v1';

// ─── Initialize ──────────────────────────────────────────────────

const app = new Hono().basePath('/api');

// ─── Global Middleware ───────────────────────────────────────────

app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

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

// ─── Root App for Catch-all ──────────────────────────────────────

const rootApp = new Hono();
rootApp.get('/', (c) => {
  return c.json({
    message: 'ARGUS API Server is running',
    health: '/api/health',
    version: 'v1'
  });
});
rootApp.route('/', app);

// ─── Start Server ────────────────────────────────────────────────

const env = getEnv();
const port = env.PORT;

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
