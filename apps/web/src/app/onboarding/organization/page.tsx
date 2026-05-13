'use client';

import { apiFetch, setActiveTenantId } from '@/lib/api';
import { signIn, signUp, useSession } from '@/lib/auth';
import { ArrowLeft, ArrowRight, Building2, Check, Cloud, Loader2, Server, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const industries = ['Finance', 'Healthcare', 'Technology', 'Manufacturing', 'Retail', 'Public Sector'];
const providers = [
  { id: 'aws', label: 'AWS' },
  { id: 'gcp', label: 'GCP' },
  { id: 'azure', label: 'Azure' },
] as const;

type ProviderId = (typeof providers)[number]['id'];

export default function OrganizationOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [accountReady, setAccountReady] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [step, setStep] = useState(0);
  const [organizationName, setOrganizationName] = useState('');
  const [industry, setIndustry] = useState<string>(industries[0] ?? 'Technology');
  const [cloudProviders, setCloudProviders] = useState<ProviderId[]>([]);
  const [hasOnPrem, setHasOnPrem] = useState(false);
  const [estimatedAssets, setEstimatedAssets] = useState(250);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAuthenticated = Boolean(session?.user) || accountReady;

  const canContinue = useMemo(() => {
    if (step === 0) return organizationName.trim().length >= 2 && industry.length > 0;
    return true;
  }, [industry, organizationName, step]);

  const toggleProvider = (provider: ProviderId) => {
    setCloudProviders((current) =>
      current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider],
    );
  };

  const handleAccountCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountLoading(true);
    setAccountError('');

    try {
      const { error } = await signUp.email({
        email: accountEmail,
        password: accountPassword,
        name: accountName || 'ARGUS Operator',
      });
      if (error) {
        setAccountError(error.message || 'Account creation failed');
      } else {
        const signInResult = await signIn.email({ email: accountEmail, password: accountPassword });
        if (signInResult?.error) {
          setAccountError(signInResult.error.message || 'Account sign-in failed');
        } else {
          setAccountReady(true);
        }
      }
    } catch (err: any) {
      setAccountError(err.message || 'An error occurred during account creation.');
    } finally {
      setAccountLoading(false);
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ organization: { id: string } }>('/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          organizationName,
          industry,
          cloudProviders,
          hasOnPrem,
          estimatedAssets,
        }),
      });
      setActiveTenantId(result.organization.id);
      // Hard navigation to ensure the session cookie changes from
      // setActiveOrganization are picked up by a fresh page load.
      // router.replace() would reuse stale useSession() cache.
      window.location.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Organisation Setup</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">Create your ARGUS workspace</h1>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className={`h-2 w-10 rounded-full ${item <= step ? 'bg-emerald-400' : 'bg-white/10'}`}
              />
            ))}
          </div>
        </header>

        {!isAuthenticated && !isPending && (
          <section className="glass-card p-6">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="flex items-start gap-3 text-slate-300">
                <UserCircle2 className="mt-1 h-5 w-5 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Account setup</h2>
                  <p className="mt-1 text-sm text-slate-400">Create an operator account to own the workspace.</p>
                </div>
              </div>
              <form onSubmit={handleAccountCreate} className="space-y-4">
                {accountError && (
                  <div className="rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
                    {accountError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full rounded-lg bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-emerald-500/50"
                    placeholder="Security Lead"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    className="w-full rounded-lg bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-emerald-500/50"
                    placeholder="owner@argus.local"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    className="w-full rounded-lg bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-emerald-500/50"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
                <button
                  type="submit"
                  disabled={accountLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {accountLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue to organization setup'}
                </button>
                <p className="text-xs text-slate-500">
                  Already have an account? <Link href="/login" className="text-emerald-300 hover:text-emerald-200">Sign in</Link>
                </p>
              </form>
            </div>
          </section>
        )}

        {isAuthenticated && (
          <section className="glass-card p-6">
            {error && (
              <div className="mb-5 rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
                {error}
              </div>
            )}

            {step === 0 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3 text-slate-300">
                  <Building2 className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">Organization</h2>
                    <p className="mt-1 text-sm text-slate-400">Basic tenant profile for risk context.</p>
                  </div>
                </div>
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                      Organization Name
                    </span>
                    <input
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      className="w-full rounded-lg bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 transition-all placeholder:text-slate-600 focus:outline-none focus:ring-emerald-500/50"
                      placeholder="Acme Security Operations"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                      Industry
                    </span>
                    <select
                      value={industry}
                      onChange={(event) => setIndustry(event.target.value)}
                      className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/8 focus:outline-none focus:ring-emerald-500/50"
                    >
                      {industries.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3 text-slate-300">
                  <Cloud className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">Infrastructure</h2>
                    <p className="mt-1 text-sm text-slate-400">Environment shape for tenant-scoped data.</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <span className="mb-3 block text-xs font-medium uppercase tracking-wider text-slate-400">
                      Cloud Providers
                    </span>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {providers.map((provider) => {
                        const selected = cloudProviders.includes(provider.id);
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => toggleProvider(provider.id)}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ring-1 transition-all ${
                              selected
                                ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40'
                                : 'bg-white/3 text-slate-300 ring-white/6 hover:ring-white/20'
                            }`}
                          >
                            {provider.label}
                            {selected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-lg bg-white/3 px-4 py-3 ring-1 ring-white/6">
                    <span className="flex items-center gap-3 text-sm text-slate-300">
                      <Server className="h-4 w-4 text-slate-400" />
                      On-premises assets
                    </span>
                    <input
                      type="checkbox"
                      checked={hasOnPrem}
                      onChange={(event) => setHasOnPrem(event.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                      Estimated Assets
                    </span>
                    <input
                      type="number"
                      value={estimatedAssets}
                      onChange={(event) => setEstimatedAssets(Number(event.target.value))}
                      min={0}
                      className="w-full rounded-lg bg-white/3 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/6 focus:outline-none focus:ring-emerald-500/50"
                    />
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-slate-100">Review workspace</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Organization</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{organizationName}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Industry</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{industry}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Providers</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">
                      {cloudProviders.length ? cloudProviders.map((item) => item.toUpperCase()).join(', ') : 'None'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Asset Estimate</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{estimatedAssets}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0 || loading}
                className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200 disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canContinue || loading}
                  className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finish'}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
