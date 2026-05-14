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
  const { data: sessionData, isPending: sessionPending } = useSession();
  const [account, setAccount] = useState<Omit<AuthContextType, 'loading'>>({
    user: null,
    platformRole: null,
    orgRole: null,
    activeOrganizationId: null,
    organizations: [],
  });
  const [meLoading, setMeLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ── Paths that don't require auth or org ────────────────────────
  const isPublicPath =
    pathname === '/' ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');

  // ── Redirect unauthenticated users away from protected routes ──
  useEffect(() => {
    if (sessionPending) return;

    if (!sessionData?.user && !isPublicPath) {
      router.replace('/login');
    }
  }, [sessionData, sessionPending, isPublicPath, router]);

  // ── Fetch /me — the single source of truth ─────────────────────
  // /me auto-activates the user's org if they have one but the
  // session doesn't have an active org set (fresh login).
  useEffect(() => {
    if (sessionPending || !sessionData?.user) {
      if (!sessionPending && !sessionData?.user) {
        setAccount({
          user: null,
          platformRole: null,
          orgRole: null,
          activeOrganizationId: null,
          organizations: [],
        });
      }
      return;
    }

    let cancelled = false;

    async function loadMe() {
      setMeLoading(true);
      try {
        const me = await apiFetch<{
          user: any;
          platformRole: PlatformRole | null;
          activeOrgRole: OrgRole | null;
          activeOrganizationId: string | null;
          organizations: any[];
        }>('/me');

        if (cancelled) return;

        // Sync localStorage with the authoritative server state
        if (me.activeOrganizationId) {
          setActiveTenantId(me.activeOrganizationId);
        }

        setAccount({
          user: me.user,
          platformRole: me.platformRole,
          orgRole: me.activeOrgRole,
          activeOrganizationId: me.activeOrganizationId,
          organizations: me.organizations ?? [],
        });
      } catch {
        if (cancelled) return;
        // If /me fails, use session data as fallback
        const storedTenantId = getActiveTenantId();
        setAccount({
          user: sessionData.user,
          platformRole: sessionData.user.role === 'super_admin' ? 'super_admin' : null,
          orgRole: null,
          activeOrganizationId: storedTenantId,
          organizations: [],
        });
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    }

    loadMe();
    return () => { cancelled = true; };
  }, [sessionData, sessionPending]);

  // ── Role-based redirects (only fires after /me completes) ──────
  useEffect(() => {
    if (sessionPending || meLoading || !account.user) return;

    // Don't redirect on public/setup paths
    if (isPublicPath) return;

    // Super admin on /dashboard → go to /admin
    if (account.platformRole === 'super_admin' && pathname === '/dashboard') {
      router.replace('/admin');
      return;
    }

    // Non-admin on /admin → go to /dashboard
    if (pathname.startsWith('/admin') && account.platformRole !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }

    // User has no org, not an admin, and not on an admin page → onboarding
    if (
      !account.platformRole &&
      !account.activeOrganizationId &&
      !pathname.startsWith('/admin')
    ) {
      router.replace('/onboarding');
    }
  }, [account, meLoading, sessionPending, pathname, isPublicPath, router]);

  const loading = sessionPending || meLoading;

  return (
    <AuthContext.Provider value={{ ...account, user: account.user ?? sessionData?.user ?? null, loading }}>
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
