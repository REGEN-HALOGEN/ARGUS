import type { Context, Next } from 'hono';
import { AppError } from './error-handler';

// ─── Role Types ──────────────────────────────────────────────────

export type Role = 'admin' | 'analyst' | 'viewer';

// ─── Auth Guard ──────────────────────────────────────────────────

export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    // TODO: Integrate Better Auth session validation
    // For now, allow through in development
    await next();
  };
}

// ─── RBAC Guard ──────────────────────────────────────────────────

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    // TODO: Extract role from Better Auth session
    const userRole = c.get('userRole') as Role | undefined;

    if (!userRole || !roles.includes(userRole)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions', {
        required: roles,
        current: userRole ?? 'none',
      });
    }

    await next();
  };
}
