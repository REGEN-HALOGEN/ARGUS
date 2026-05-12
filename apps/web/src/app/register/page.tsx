'use client';

import { useState } from 'react';
import { signUp } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await signUp.email({ email, password, name });
      if (error) {
        setError(error.message || 'Registration failed');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-accent-500/20 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500/10 ring-1 ring-accent-500/30 mb-4">
            <Shield className="h-6 w-6 text-accent-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Request Access</h1>
          <p className="text-sm text-slate-400 mt-1">Register a new operator account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          {error && (
            <div className="rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06] focus:outline-none focus:ring-accent-500/50 placeholder:text-slate-600 transition-all"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06] focus:outline-none focus:ring-accent-500/50 placeholder:text-slate-600 transition-all"
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
              className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06] focus:outline-none focus:ring-accent-500/50 placeholder:text-slate-600 transition-all"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent-500/20 px-4 py-3 text-sm font-semibold text-accent-300 ring-1 ring-accent-500/40 hover:bg-accent-500/30 hover:ring-accent-500/50 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register'}
          </button>

          <p className="text-center text-xs text-slate-500 mt-6">
            Already an operator? <Link href="/login" className="text-accent-400 hover:text-accent-300">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
