'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { API_BASE, setActiveTenantId } from '@/lib/api';

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 ring-1 ring-primary-500/30 mb-4">
            <Shield className="h-6 w-6 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">ARGUS Platform</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          {error && (
            <div className="rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-primary-500/50 placeholder:text-slate-600 transition-all"
              placeholder="operator@argus.local"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-primary-500/50 placeholder:text-slate-600 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary-500/20 px-4 py-3 text-sm font-semibold text-primary-300 ring-1 ring-primary-500/40 hover:bg-primary-500/30 hover:ring-primary-500/50 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Authenticate'}
          </button>

          <p className="text-center text-xs text-slate-500 mt-6">
            Need access? <Link href="/onboarding" className="text-primary-400 hover:text-primary-300">Choose a sign up path</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
