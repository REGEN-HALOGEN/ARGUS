import { Hono } from 'hono';
import { auth } from '../../auth';

export const authRoutes = new Hono();

// Mount all Better Auth routes to /api/v1/auth/*
authRoutes.all('/*', (c) => {
  console.log(`[AUTH] Request: ${c.req.method} ${c.req.url}`);
  return auth.handler(c.req.raw);
});
