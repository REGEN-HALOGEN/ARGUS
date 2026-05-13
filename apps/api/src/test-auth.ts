import { Hono } from 'hono';

process.env.BETTER_AUTH_URL = 'http://localhost:4001/api/v1/auth';

const { auth } = await import('./auth');

const app = new Hono().basePath('/api');
const v1 = new Hono();
const authRoutes = new Hono();

authRoutes.all('/*', (c) => {
  console.log(`[TEST-AUTH] ${c.req.method} ${c.req.url}`);
  return auth.handler(c.req.raw);
});

v1.route('/auth', authRoutes);
app.route('/v1', v1);

const root = new Hono();
root.route('/', app);

console.log('Starting test server on port 4001...');
export default {
  port: 4001,
  fetch: root.fetch,
};
