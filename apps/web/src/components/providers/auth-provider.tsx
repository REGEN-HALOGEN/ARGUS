'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth';
import { apiFetch, getActiveTenantId, setActiveTenantId } from '@/lib/api';

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

  useEffect(() => {
    if (!isPending) {
      const isPublicPath =
        pathname === '/' ||
        pathname.startsWith('/onboarding') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/register');

      if (!data?.user && !isPublicPath) {
        router.push('/login');
      } else if (data?.user && (pathname === '/login' || pathname === '/register')) {
        router.push('/dashboard');
      }
    }
  }, [data, isPending, router, pathname]);

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

        if (next.activeOrganizationId) {
          setActiveTenantId(next.activeOrganizationId);
        }

        setAccount({
          user: next.user,
          platformRole: next.platformRole,
          orgRole: next.activeOrgRole,
          activeOrganizationId: next.activeOrganizationId,
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

  useEffect(() => {
    if (isPending || accountLoading || !account.user) return;

    if (account.platformRole === 'super_admin' && pathname === '/dashboard') {
      router.push('/admin');
      return;
    }

    const storedTenantId = getActiveTenantId();
    const isSetupPath =
      pathname === '/' ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/register');
    if (!account.platformRole && !account.activeOrganizationId && !storedTenantId && !isSetupPath) {
      router.push('/onboarding');
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
