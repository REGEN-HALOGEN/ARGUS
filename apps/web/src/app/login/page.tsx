'use client';

import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';
import { API_BASE, setActiveTenantId } from '@/lib/api';
import { signIn } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || 'Login failed');
        setLoading(false);
        return;
      }

      // After successful sign-in, call /me which auto-activates the
      // user's organization (if they have one) and returns the role.
      // This is the single source of truth for routing decisions.
      try {
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        const meJson = await meRes.json();
        const data = meJson?.data;

        // Store the active org in localStorage for the auth provider
        if (data?.activeOrganizationId) {
          setActiveTenantId(data.activeOrganizationId);
        }

        // Route based on role
        if (data?.platformRole === 'super_admin') {
          router.replace('/admin');
        } else if (data?.activeOrganizationId) {
          router.replace('/dashboard');
        } else {
          // User has no org — send to onboarding
          router.replace('/onboarding');
        }
      } catch {
        // /me failed — just go to dashboard, auth provider will handle it
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BackgroundRippleEffect />
      <div className="flex min-h-screen items-center justify-center p-4 bg-transparent relative z-10">
      <div className="fixed top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md p-8 rounded-3xl border border-card-border bg-card shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <Logo width={48} height={48} showText={false} className="mb-4" />
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">ARGUS Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          {error && (
            <div className="rounded-xl bg-threat-500/10 p-4 text-sm font-medium text-threat-600 dark:text-threat-400 border border-threat-500/20">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground border border-card-border focus:outline-none focus:ring-2 focus:ring-primary-500/50 placeholder:text-muted-foreground/50 transition-all"
              placeholder="operator@argus.local"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground border border-card-border focus:outline-none focus:ring-2 focus:ring-primary-500/50 placeholder:text-muted-foreground/50 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Authenticate'}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Need access?{' '}
            <Link href="/onboarding" className="text-primary-500 font-bold hover:underline">
              Choose a sign up path
            </Link>
          </p>
        </form>
      </div>
      </div>
    </>
  );
}
