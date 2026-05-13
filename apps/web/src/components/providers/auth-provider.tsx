'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth';
import { apiFetch, getActiveTenantId, setActiveTenantId, clearActiveTenantId } from '@/lib/api';

type PlatformRole = 'super_admin';
type OrgRole = 'org_admin' | 'operator' | 'analyst' | 'viewer';

interface AuthContextType {
  user: any | null;
  platformRole: PlatformRole | null;
  orgRole: OrgRole | null;
  activeOrganizationId: string | null;
  organizations: any[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  platformRole: null,
  orgRole: null,
  activeOrganizationId: null,
  organizations: [],
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  const [account, setAccount] = useState<Omit<AuthContextType, 'loading'>>({
    user: null,
    platformRole: null,
    orgRole: null,
    activeOrganizationId: null,
    organizations: [],
  });
  const [accountLoading, setAccountLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ── Redirect Logic: Authentication ──────────────────────────────
  useEffect(() => {
    if (!isPending) {
      const isPublicPath =
        pathname === '/' ||
        pathname.startsWith('/onboarding') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/register');

      if (!data?.user && !isPublicPath) {
        // Not authenticated + on a protected route → replace to login
        router.replace('/login');
      } else if (data?.user && (pathname === '/login' || pathname === '/register')) {
        // Already authenticated + on login/register → replace to dashboard
        router.replace('/dashboard');
      }
    }
  }, [data, isPending, router, pathname]);

  // ── Load Account Details from API ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      const storedTenantId = getActiveTenantId();
      if (!data?.user) {
        setAccount({
          user: null,
          platformRole: null,
          orgRole: null,
          activeOrganizationId: null,
          organizations: [],
        });
        return;
      }

      setAccountLoading(true);
      try {
        const next = await apiFetch<{
          user: any;
          platformRole: PlatformRole | null;
          activeOrgRole: OrgRole | null;
          activeOrganizationId: string | null;
          organizations: any[];
        }>('/me');

        if (cancelled) return;

        // Use localStorage tenant ID as fallback if server session
        // hasn't been updated yet (e.g. right after org creation)
        const effectiveOrgId = next.activeOrganizationId || storedTenantId;

        if (effectiveOrgId) {
          setActiveTenantId(effectiveOrgId);
        }

        setAccount({
          user: next.user,
          platformRole: next.platformRole,
          orgRole: next.activeOrgRole,
          activeOrganizationId: effectiveOrgId,
          organizations: next.organizations ?? [],
        });
      } catch {
        if (!cancelled) {
          setAccount({
            user: data.user,
            platformRole: data.user.role === 'super_admin' ? 'super_admin' : null,
            orgRole: null,
            activeOrganizationId: storedTenantId,
            organizations: [],
          });
        }
      } finally {
        if (!cancelled) setAccountLoading(false);
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [data]);

  // ── Role-Based Redirects ───────────────────────────────────────
  useEffect(() => {
    if (isPending || accountLoading || !account.user) return;

    const isSetupPath =
      pathname === '/' ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/register');

    // Super admins landing on /dashboard → redirect to /admin
    if (account.platformRole === 'super_admin' && pathname === '/dashboard') {
      router.replace('/admin');
      return;
    }

    // Non-admin users trying to access /admin → redirect to dashboard
    if (pathname.startsWith('/admin') && account.platformRole !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }

    // Users without an org and not a platform admin → redirect to onboarding
    // Exclude /admin paths — admin pages handle their own auth guard
    const storedTenantId = getActiveTenantId();
    if (
      !account.platformRole &&
      !account.activeOrganizationId &&
      !storedTenantId &&
      !isSetupPath &&
      !pathname.startsWith('/admin')
    ) {
      router.replace('/onboarding');
    }
  }, [account, accountLoading, isPending, pathname, router]);

  const loading = isPending || accountLoading;

  return (
    <AuthContext.Provider value={{ ...account, user: account.user ?? data?.user ?? null, loading }}>
      {loading ? (
        <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
