export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const ACTIVE_TENANT_KEY = 'argus.activeTenantId';

export function getActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setActiveTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

export function clearActiveTenantId(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_TENANT_KEY);
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

  const tenantId = getActiveTenantId();
  if (tenantId && !headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', tenantId);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const json = await res.json().catch(() => null);

  const errorMessage =
    json?.error?.message || json?.message || `API Error: ${res.status} ${res.statusText}`;
  const errorCode = json?.error?.code;

  if (!res.ok) {
    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
      silent?: boolean;
    };
    err.code = errorCode;
    err.status = res.status;
    // Mark redirect-worthy errors as silent so callers can check
    err.silent =
      res.status === 401 ||
      res.status === 500 ||
      errorCode === 'TENANT_REQUIRED' ||
      errorCode === 'TENANT_FORBIDDEN' ||
      errorCode === 'SESSION_ERROR';
    throw err;
  }

  if (!json?.success) {
    const err = new Error(json?.error?.message || 'API request failed') as Error & {
      code?: string;
      silent?: boolean;
    };
    err.code = errorCode;
    err.silent = errorCode === 'TENANT_REQUIRED' || errorCode === 'TENANT_FORBIDDEN';
    throw err;
  }

  return json.data;
}
