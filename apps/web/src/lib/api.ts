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

  const errorMessage = json?.error?.message || json?.message || `API Error: ${res.status} ${res.statusText}`;
  const errorCode = json?.error?.code;

  const shouldRedirectToLogin = res.status === 401;
  const shouldRedirectToOnboarding = errorCode === 'TENANT_REQUIRED' || errorCode === 'TENANT_FORBIDDEN';

  if (!res.ok) {
    if (typeof window !== 'undefined') {
      if (shouldRedirectToLogin) {
        window.location.assign('/login');
      } else if (shouldRedirectToOnboarding) {
        window.location.assign('/onboarding');
      }
    }

    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
      silent?: boolean;
    };
    err.code = errorCode;
    err.status = res.status;
    err.silent = shouldRedirectToLogin || shouldRedirectToOnboarding;
    throw err;
  }

  if (!json?.success) {
    if (typeof window !== 'undefined' && shouldRedirectToOnboarding) {
      window.location.assign('/onboarding');
    }

    const err = new Error(json.error?.message || 'API request failed') as Error & {
      code?: string;
      silent?: boolean;
    };
    err.code = errorCode;
    err.silent = shouldRedirectToOnboarding;
    throw err;
  }

  return json.data;
}
