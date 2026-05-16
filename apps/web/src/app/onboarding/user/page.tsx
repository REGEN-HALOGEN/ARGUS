'use client';

import { ThemeToggle } from '@/components/ui/theme-toggle';
import { signUp } from '@/lib/auth';
import { ArrowRight, Loader2, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function UserOnboardingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await signUp.email({ email, password });
      if (error) {
        setError(error.message || 'Registration failed');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="fixed top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md p-8 rounded-3xl border border-card-border bg-card shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden">
        <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 border border-accent-500/20 mb-4">
            <UserCircle2 className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">User Sign Up</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Create a user account with email and password
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl bg-emerald-500/10 p-6 text-sm font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 relative z-10">
            Account created successfully. Ask your administrator for access to an organization.
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300 font-bold hover:underline"
              >
                Sign in to ARGUS
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5 relative z-10">
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
                className="w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground border border-card-border focus:outline-none focus:ring-2 focus:ring-accent-500/50 placeholder:text-muted-foreground/50 transition-all"
                placeholder="user@argus.local"
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
                className="w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground border border-card-border focus:outline-none focus:ring-2 focus:ring-accent-500/50 placeholder:text-muted-foreground/50 transition-all"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Back to{' '}
              <Link href="/" className="text-accent-500 font-bold hover:underline">
                welcome screen
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
