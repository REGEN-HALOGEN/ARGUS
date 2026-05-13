# 🔐 Advanced Security Features — Implementation Guide

> **Priority:** Medium  
> **Estimated Effort:** 3–4 days  
> **Files:** `apps/api/src/middleware/`, `apps/api/src/auth.ts`, `packages/ai/src/services.ts`, Settings page

---

## Overview

ARGUS currently has basic Better Auth email/password authentication but lacks **role-based access control (RBAC)**, **route-level authorization**, **Cypher injection hardening**, and **AI output validation**. This guide covers building a production-grade security layer.

---

## Current State

| Component | Status |
|---|---|
| `apps/api/src/auth.ts` | ✅ Better Auth with SQLite, email/password |
| `apps/web/.../providers/auth-provider.tsx` | ✅ Client-side auth context |
| `apps/web/src/app/login/page.tsx` | ✅ Login page |
| `apps/web/src/app/register/page.tsx` | ✅ Register page |
| `scripts/seed-admin.ts` | ✅ Admin seeding script |
| Route-level auth middleware | ❌ No routes are protected |
| RBAC (role-based access) | ❌ Not implemented |
| Cypher injection prevention | ⚠️ Partial — blocklist exists but no parameterization enforcement |
| AI output sanitization | ❌ Not implemented |
| API rate limiting | ❌ Not implemented |
| Audit logging | ❌ Not implemented |
| Session management UI | ❌ Settings page is placeholder |

---

## Implementation Steps

### Step 1: RBAC Role Definitions

```typescript
// packages/types/src/auth.ts (new file)

import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'analyst', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

// Permission matrix
export const PERMISSIONS = {
  // Dashboard
  'dashboard:view': ['admin', 'analyst', 'viewer'],

  // Graph
  'graph:view': ['admin', 'analyst', 'viewer'],
  'graph:query': ['admin', 'analyst'],

  // AI
  'ai:chat': ['admin', 'analyst'],
  'ai:nl-to-cypher': ['admin', 'analyst'],

  // CVE
  'cve:view': ['admin', 'analyst', 'viewer'],
  'cve:search': ['admin', 'analyst'],

  // Threat Actors
  'threats:view': ['admin', 'analyst', 'viewer'],

  // Ingestion
  'ingestion:trigger': ['admin'],
  'ingestion:status': ['admin', 'analyst'],

  // Risk
  'risk:view': ['admin', 'analyst', 'viewer'],
  'risk:blast-radius': ['admin', 'analyst'],

  // Settings
  'settings:view': ['admin', 'analyst', 'viewer'],
  'settings:manage-users': ['admin'],
  'settings:manage-api-keys': ['admin'],
  'settings:manage-database': ['admin'],

  // Briefings
  'briefings:view': ['admin', 'analyst', 'viewer'],
  'briefings:generate': ['admin', 'analyst'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission];
  return allowed.includes(role);
}
```

### Step 2: Better Auth with Roles

Update `apps/api/src/auth.ts` to support roles:

```typescript
// apps/api/src/auth.ts

import { betterAuth } from 'better-auth';
import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.join(__dirname, '../../argus-auth.db');
const db = new Database(dbPath);

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth',
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // Update session every 24 hours
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'viewer',
        input: false, // Cannot be set by user during registration
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

### Step 3: Authentication Middleware

```typescript
// apps/api/src/middleware/auth-guard.ts

import type { Context, Next } from 'hono';
import { auth, type AuthSession } from '../auth';
import type { Permission, Role } from '@argus/types';
import { hasPermission } from '@argus/types';

// Verify the session and attach user to context
export async function authGuard(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        401,
      );
    }

    // Attach session to context for downstream handlers
    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
        },
      },
      401,
    );
  }
}

// Permission-based authorization middleware factory
export function requirePermission(permission: Permission) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401,
      );
    }

    const role = (user.role ?? 'viewer') as Role;

    if (!hasPermission(role, permission)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required: ${permission}`,
          },
        },
        403,
      );
    }

    await next();
  };
}

// Admin-only shorthand
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (user?.role !== 'admin') {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        403,
      );
    }
    await next();
  };
}
```

### Step 4: Apply Auth to Routes

Update `apps/api/src/routes/v1/index.ts`:

```typescript
import { Hono } from 'hono';
import { authGuard, requirePermission } from '../../middleware/auth-guard';

// ... route imports

export const v1Routes = new Hono();

// Auth routes — no auth required
v1Routes.route('/auth', authRoutes);

// Protected routes — auth required on all below
v1Routes.use('*', authGuard);

// Dashboard — all roles
v1Routes.route('/dashboard', dashboardRoutes);

// Graph — analyst+
v1Routes.use('/graph/*', requirePermission('graph:view'));
v1Routes.route('/graph', graphRoutes);

// AI — analyst+
v1Routes.use('/ai/*', requirePermission('ai:chat'));
v1Routes.route('/ai', aiRoutes);

// CVE — all roles
v1Routes.route('/cve', cveRoutes);

// Ingestion — admin only
v1Routes.use('/ingestion/*', requirePermission('ingestion:trigger'));
v1Routes.route('/ingestion', ingestionRoutes);
```

### Step 5: Rate Limiting

```typescript
// apps/api/src/middleware/rate-limit.ts

import { getCacheClient } from '@argus/cache';
import type { Context, Next } from 'hono';

interface RateLimitConfig {
  windowMs: number;   // Time window in milliseconds
  max: number;         // Max requests per window
  keyPrefix?: string;  // Cache key prefix
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, keyPrefix = 'rl' } = config;

  return async (c: Context, next: Next) => {
    const client = getCacheClient();

    // Use user ID if authenticated, otherwise IP
    const user = c.get('user');
    const identifier = user?.id ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${keyPrefix}:${identifier}`;

    try {
      const current = await client.incr(key);

      if (current === 1) {
        // First request in window — set expiry
        await client.pexpire(key, windowMs);
      }

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(Math.max(0, max - current)));

      if (current > max) {
        const ttl = await client.pttl(key);
        c.header('Retry-After', String(Math.ceil(ttl / 1000)));

        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
              retryAfter: Math.ceil(ttl / 1000),
            },
          },
          429,
        );
      }
    } catch {
      // If cache fails, allow the request (fail-open)
    }

    await next();
  };
}

// Preset configs
export const standardLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'rl:std' });
export const aiLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'rl:ai' });
export const authLimit = rateLimit({ windowMs: 900_000, max: 10, keyPrefix: 'rl:auth' }); // 10 attempts per 15min
```

Apply rate limits:

```typescript
// In v1/index.ts
import { aiLimit, authLimit } from '../../middleware/rate-limit';

v1Routes.use('/auth/*', authLimit);
v1Routes.use('/ai/*', aiLimit);
```

### Step 6: Enhanced Cypher Injection Prevention

```typescript
// packages/ai/src/cypher-validator.ts (new file)

// Extended blocklist with more dangerous patterns
const BLOCKED_KEYWORDS = [
  'CREATE', 'DELETE', 'SET', 'MERGE', 'REMOVE', 'DETACH', 'DROP',
  'CALL', 'LOAD', 'FOREACH', 'GRANT', 'REVOKE', 'DENY',
  'dbms.', 'apoc.', 'db.', 'gds.',
  'PERIODIC COMMIT',
];

// Patterns that should never appear in user-generated Cypher
const BLOCKED_PATTERNS = [
  /;\s*\w/,                       // Statement chaining
  /\/\*.*?\*\//s,                 // Block comments (potential obfuscation)
  /\/\/.*/,                       // Line comments
  /CALL\s+\{/i,                   // Subquery CALL blocks
  /\$\{.*\}/,                     // Template literal injection
  /UNION\s+ALL/i,                 // UNION injection
];

// Allowed statement types
const ALLOWED_PREFIXES = [
  'MATCH', 'OPTIONAL MATCH', 'WITH', 'WHERE', 'RETURN',
  'ORDER BY', 'SKIP', 'LIMIT', 'UNWIND',
];

export interface ValidationResult {
  safe: boolean;
  reason?: string;
  sanitized?: string;
}

export function validateCypher(cypher: string): ValidationResult {
  const trimmed = cypher.trim();

  // Check for empty query
  if (!trimmed) {
    return { safe: false, reason: 'Empty query' };
  }

  // Check length limit (prevent DoS via massive queries)
  if (trimmed.length > 2000) {
    return { safe: false, reason: 'Query too long (max 2000 chars)' };
  }

  // Check blocked keywords
  const upper = trimmed.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (upper.includes(keyword.toUpperCase())) {
      return { safe: false, reason: `Blocked keyword: ${keyword}` };
    }
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked pattern detected` };
    }
  }

  // Check that query starts with an allowed prefix
  const startsWithAllowed = ALLOWED_PREFIXES.some((prefix) =>
    upper.startsWith(prefix),
  );
  if (!startsWithAllowed) {
    return { safe: false, reason: 'Query must start with MATCH, WITH, or RETURN' };
  }

  // Enforce LIMIT clause
  if (!upper.includes('LIMIT')) {
    // Auto-add LIMIT 50 if missing
    return {
      safe: true,
      sanitized: `${trimmed}\nLIMIT 50`,
    };
  }

  // Verify LIMIT value is reasonable (max 200)
  const limitMatch = upper.match(/LIMIT\s+(\d+)/);
  if (limitMatch) {
    const limitVal = parseInt(limitMatch[1], 10);
    if (limitVal > 200) {
      return {
        safe: true,
        sanitized: trimmed.replace(/LIMIT\s+\d+/i, 'LIMIT 200'),
      };
    }
  }

  return { safe: true, sanitized: trimmed };
}
```

Update `packages/ai/src/services.ts` → `nlToCypher()`:

```typescript
import { validateCypher } from './cypher-validator';

export async function nlToCypher(query: string): Promise<{ cypher: string; safe: boolean }> {
  const response = await chat(
    [{ role: 'user', content: query }],
    { systemPrompt: SYSTEM_PROMPTS.NL_TO_CYPHER, model: MODELS.PRO, temperature: 0.1 },
  );

  const rawCypher = response.trim();

  if (rawCypher === 'UNSAFE_QUERY') {
    return { cypher: '', safe: false };
  }

  // Use the enhanced validator
  const validation = validateCypher(rawCypher);

  if (!validation.safe) {
    console.warn(`[Security] Blocked unsafe Cypher: ${validation.reason}`);
    return { cypher: '', safe: false };
  }

  return { cypher: validation.sanitized ?? rawCypher, safe: true };
}
```

### Step 7: AI Output Sanitization

```typescript
// packages/ai/src/sanitizer.ts (new file)

// Prevent AI from leaking sensitive data patterns in responses

const SENSITIVE_PATTERNS = [
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,  // IP addresses
  /password\s*[:=]\s*\S+/gi,                       // Password leaks
  /api[_-]?key\s*[:=]\s*\S+/gi,                   // API key leaks
  /bearer\s+[a-zA-Z0-9._-]+/gi,                   // Bearer tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g,      // JWTs
];

const REDACTION = '[REDACTED]';

export function sanitizeAIOutput(text: string): string {
  let sanitized = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Allow IPs that are clearly in example/documentation context
      if (/10\.0\.\d+\.\d+/.test(match)) return match; // Internal ranges in graph
      return REDACTION;
    });
  }

  return sanitized;
}
```

### Step 8: Audit Logging

```typescript
// apps/api/src/middleware/audit-log.ts

import type { Context, Next } from 'hono';
import { getCacheClient } from '@argus/cache';

interface AuditEntry {
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  method: string;
  statusCode: number;
  ip: string;
}

export async function auditLog(c: Context, next: Next) {
  const start = Date.now();
  await next();

  const user = c.get('user');
  if (!user) return; // Only audit authenticated requests

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    userEmail: user.email,
    action: `${c.req.method} ${c.req.path}`,
    resource: c.req.path,
    method: c.req.method,
    statusCode: c.res.status,
    ip: c.req.header('x-forwarded-for') ?? 'unknown',
  };

  // Store in Valkey (keep last 1000 entries)
  try {
    const client = getCacheClient();
    await client.lpush('audit:log', JSON.stringify(entry));
    await client.ltrim('audit:log', 0, 999);
  } catch {
    // Fail silently — don't block requests for audit failures
  }
}
```

### Step 9: Settings Page — User Management (Admin)

```typescript
// apps/web/src/app/(dashboard)/settings/users/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Edit2, Trash2 } from 'lucide-react';

// Admin-only page for managing user roles
export default function UserManagementPage() {
  // Fetch users from /api/v1/auth/admin/users
  // Display user list with role badges
  // Allow admins to change roles via dropdown
  // Allow admins to deactivate users

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">User Management</h1>
        <p className="text-sm text-slate-400 mt-1">Manage user accounts and roles</p>
      </div>

      {/* User table with role management */}
      <div className="glass-card overflow-hidden">
        {/* ... user table implementation ... */}
      </div>
    </motion.div>
  );
}
```

---

## Security Checklist Summary

| Category | Items |
|---|---|
| **Authentication** | Better Auth with sessions, email/password, secure cookies |
| **Authorization** | RBAC with 3 roles (admin, analyst, viewer), 15+ permissions |
| **Route Protection** | `authGuard` middleware on all API routes except `/auth` |
| **Rate Limiting** | Standard (60/min), AI (10/min), Auth (10/15min) |
| **Cypher Safety** | Extended blocklist, pattern matching, forced LIMIT, no statement chaining |
| **AI Safety** | Output sanitization for IPs, passwords, tokens, JWTs |
| **Audit Trail** | Valkey-backed audit log for all authenticated requests |
| **Session Mgmt** | 7-day sessions, daily refresh, secure cookie config |

---

## Rollout Checklist

- [ ] Create `packages/types/src/auth.ts` with RBAC definitions
- [ ] Update Better Auth config with role field
- [ ] Create `authGuard` middleware
- [ ] Create `requirePermission()` middleware factory
- [ ] Apply auth guards to all API routes
- [ ] Create rate limiting middleware with Valkey backend
- [ ] Create `cypher-validator.ts` with enhanced validation
- [ ] Create `sanitizer.ts` for AI output sanitization
- [ ] Create audit logging middleware
- [ ] Build user management admin page
- [ ] Update seed-admin script to set `role: 'admin'`
- [ ] Update frontend to check permissions before showing UI elements
- [ ] Add secure cookie configuration for production
- [ ] Write tests for permission checks and Cypher validation
