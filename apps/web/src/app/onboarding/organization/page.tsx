'use client';

import { ThemeToggle } from '@/components/ui/theme-toggle';
import { apiFetch, setActiveTenantId } from '@/lib/api';
import { signIn, signUp, useSession } from '@/lib/auth';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Crown,
  Database,
  Loader2,
  Monitor,
  Plus,
  Server,
  Shield,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

// ─── Constants ───────────────────────────────────────────────────

const INDUSTRIES = [
  'Finance',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Retail',
  'Public Sector',
  'Energy',
  'Education',
];
const CLOUD_PROVIDERS = [
  { id: 'aws', label: 'AWS' },
  { id: 'gcp', label: 'GCP' },
  { id: 'azure', label: 'Azure' },
] as const;

const SERVER_ROLES = [
  'Web Server',
  'Application Server',
  'Mail Server',
  'DNS Server',
  'File Server',
  'Internal Tool',
];
const OS_OPTIONS = ['Ubuntu', 'Windows Server', 'RHEL', 'CentOS', 'Debian', 'Amazon Linux'];
const DB_TYPES = [
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'SQL Server',
  'Oracle',
  'DynamoDB',
  'S3 Bucket',
];
const DB_PURPOSES = [
  'Customer Data',
  'Financial Records',
  'Application Logs',
  'User Authentication',
  'Analytics',
  'Backups',
];
const TOTAL_STEPS = 5;

type ProviderId = (typeof CLOUD_PROVIDERS)[number]['id'];

interface ServerGroup {
  id: string;
  role: string;
  os: string;
  osVersion: string;
  quantity: number;
  internetFacing: boolean;
}

interface DataStore {
  id: string;
  type: string;
  purpose: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const inputCls =
  'w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground border border-card-border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-muted-foreground/50 transition-all';
const labelCls =
  'block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 ml-1';
const btnPrimary =
  'flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50';

// ─── Page ────────────────────────────────────────────────────────

export default function OrganizationOnboardingPage() {
  const { data: session, isPending } = useSession();

  // Account creation state
  const [accountReady, setAccountReady] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Wizard state
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 0: Org Profile
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]!);
  const [cloudProviders, setCloudProviders] = useState<ProviderId[]>([]);
  const [hasOnPrem, setHasOnPrem] = useState(false);

  // Step 1: Compute / Servers
  const [servers, setServers] = useState<ServerGroup[]>([
    {
      id: uid(),
      role: 'Web Server',
      os: 'Ubuntu',
      osVersion: '22.04',
      quantity: 1,
      internetFacing: true,
    },
  ]);

  // Step 2: Data & Storage
  const [dataStores, setDataStores] = useState<DataStore[]>([
    { id: uid(), type: 'PostgreSQL', purpose: 'Customer Data' },
  ]);

  // Step 3: Crown Jewels (indices into dataStores)
  const [crownJewelIds, setCrownJewelIds] = useState<Set<string>>(new Set());

  const isAuthenticated = Boolean(session?.user) || accountReady;

  // ─── Validation ──────────────────────────────────────────────
  const canContinue = useMemo(() => {
    if (step === 0) return orgName.trim().length >= 2;
    if (step === 1) return servers.length > 0 && servers.every((s) => s.os && s.osVersion);
    if (step === 2) return dataStores.length > 0;
    return true;
  }, [step, orgName, servers, dataStores]);

  // ─── Handlers ────────────────────────────────────────────────

  const toggleProvider = (id: ProviderId) =>
    setCloudProviders((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  const addServer = () =>
    setServers((cur) => [
      ...cur,
      {
        id: uid(),
        role: 'Application Server',
        os: 'Ubuntu',
        osVersion: '22.04',
        quantity: 1,
        internetFacing: false,
      },
    ]);

  const removeServer = (id: string) => setServers((cur) => cur.filter((s) => s.id !== id));

  const updateServer = (id: string, patch: Partial<ServerGroup>) =>
    setServers((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addDataStore = () =>
    setDataStores((cur) => [
      ...cur,
      { id: uid(), type: 'PostgreSQL', purpose: 'Application Logs' },
    ]);

  const removeDataStore = (id: string) => {
    setDataStores((cur) => cur.filter((d) => d.id !== id));
    setCrownJewelIds((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  };

  const updateDataStore = (id: string, patch: Partial<DataStore>) =>
    setDataStores((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const toggleCrownJewel = (id: string) =>
    setCrownJewelIds((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ─── Account creation ────────────────────────────────────────

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
        return;
      }
      const signInResult = await signIn.email({ email: accountEmail, password: accountPassword });
      if (signInResult?.error) {
        setAccountError(signInResult.error.message || 'Sign-in failed');
        return;
      }
      setAccountReady(true);
    } catch (err: any) {
      setAccountError(err.message || 'An error occurred.');
    } finally {
      setAccountLoading(false);
    }
  };

  // ─── Submit ──────────────────────────────────────────────────

  const completeOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ organization: { id: string } }>('/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          organizationName: orgName,
          industry,
          cloudProviders,
          hasOnPrem,
          servers: servers.map(({ id, ...rest }) => rest),
          dataStores: dataStores.map(({ id, ...rest }) => rest),
          crownJewelIndices: dataStores
            .map((d, i) => (crownJewelIds.has(d.id) ? i : -1))
            .filter((i) => i >= 0),
        }),
      });
      setActiveTenantId(result.organization.id);
      window.location.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step Labels ─────────────────────────────────────────────

  const stepLabels = ['Organization', 'Infrastructure', 'Data & Storage', 'Crown Jewels', 'Review'];

  // ─── Render ──────────────────────────────────────────────────

  return (
    <main className="min-h-screen px-4 py-10 bg-transparent text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Organisation Setup
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
              Create your ARGUS workspace
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex gap-1.5">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div
                    className={`h-2 w-8 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-card-border'}`}
                  />
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest ${i <= step ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/40'}`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── Account Gate ─────────────────────────────────────── */}
        {!isAuthenticated && !isPending && (
          <section className="glass-card p-6">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="flex items-start gap-3 text-muted-foreground/80">
                <UserCircle2 className="mt-1 h-5 w-5 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Account setup</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create an operator account to own the workspace.
                  </p>
                </div>
              </div>
              <form onSubmit={handleAccountCreate} className="space-y-4">
                {accountError && (
                  <div className="rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
                    {accountError}
                  </div>
                )}
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className={inputCls}
                    placeholder="Security Lead"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    className={inputCls}
                    placeholder="owner@company.com"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    className={inputCls}
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
                <button type="submit" disabled={accountLoading} className={btnPrimary}>
                  {accountLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Continue to organization setup'
                  )}
                </button>
                <p className="text-xs text-muted-foreground/70">
                  Already have an account?{' '}
                  <Link href="/login" className="text-emerald-300 hover:text-emerald-200">
                    Sign in
                  </Link>
                </p>
              </form>
            </div>
          </section>
        )}

        {/* ── Wizard Steps ─────────────────────────────────────── */}
        {isAuthenticated && (
          <section className="glass-card p-6">
            {error && (
              <div className="mb-5 rounded-lg bg-threat-500/10 p-3 text-sm text-threat-400 ring-1 ring-threat-500/20">
                {error}
              </div>
            )}

            {/* Step 0: Organization Profile */}
            {step === 0 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Organization</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Basic tenant profile for risk context.
                    </p>
                  </div>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>Organization Name</label>
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className={inputCls}
                      placeholder="Acme Security Operations"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Industry</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className={`${inputCls} bg-slate-950`}
                    >
                      {INDUSTRIES.map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={labelCls}>Cloud Providers</span>
                    <div className="grid gap-3 sm:grid-cols-3 mt-1.5">
                      {CLOUD_PROVIDERS.map((p) => {
                        const sel = cloudProviders.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProvider(p.id)}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ring-1 transition-all ${sel ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40' : 'bg-white/3 text-muted-foreground/80 ring-white/6 hover:ring-white/20'}`}
                          >
                            {p.label}
                            {sel && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg bg-white/3 px-4 py-3 ring-1 ring-white/6">
                    <span className="flex items-center gap-3 text-sm text-muted-foreground/80">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      On-premises assets
                    </span>
                    <input
                      type="checkbox"
                      checked={hasOnPrem}
                      onChange={(e) => setHasOnPrem(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Step 1: Compute / Servers */}
            {step === 1 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3">
                  <Monitor className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Infrastructure</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define your server groups. Each entry represents a group of identical servers.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {servers.map((srv) => (
                    <div
                      key={srv.id}
                      className="rounded-xl bg-background border-card-border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                          {srv.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeServer(srv.id)}
                          className="text-muted-foreground/70 hover:text-threat-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Server Role</label>
                          <select
                            value={srv.role}
                            onChange={(e) => updateServer(srv.id, { role: e.target.value })}
                            className={`${inputCls} bg-slate-950`}
                          >
                            {SERVER_ROLES.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Operating System</label>
                          <select
                            value={srv.os}
                            onChange={(e) => updateServer(srv.id, { os: e.target.value })}
                            className={`${inputCls} bg-slate-950`}
                          >
                            {OS_OPTIONS.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>OS Version</label>
                          <input
                            value={srv.osVersion}
                            onChange={(e) => updateServer(srv.id, { osVersion: e.target.value })}
                            className={inputCls}
                            placeholder="22.04"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Quantity</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={srv.quantity}
                            onChange={(e) =>
                              updateServer(srv.id, { quantity: Number(e.target.value) })
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={srv.internetFacing}
                          onChange={(e) =>
                            updateServer(srv.id, { internetFacing: e.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-500"
                        />
                        Internet-facing
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addServer}
                    className="flex items-center gap-2 rounded-lg bg-card/50 px-4 py-2.5 text-sm text-muted-foreground ring-1 border border-card-border hover:bg-card/60 transition w-full justify-center"
                  >
                    <Plus className="h-4 w-4" /> Add Server Group
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Data & Storage */}
            {step === 2 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3">
                  <Database className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Data & Storage</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define your databases and storage systems.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {dataStores.map((ds) => (
                    <div
                      key={ds.id}
                      className="rounded-xl bg-background border-card-border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                          {ds.type}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDataStore(ds.id)}
                          className="text-muted-foreground/70 hover:text-threat-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Database Type</label>
                          <select
                            value={ds.type}
                            onChange={(e) => updateDataStore(ds.id, { type: e.target.value })}
                            className={`${inputCls} bg-slate-950`}
                          >
                            {DB_TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Purpose</label>
                          <select
                            value={ds.purpose}
                            onChange={(e) => updateDataStore(ds.id, { purpose: e.target.value })}
                            className={`${inputCls} bg-slate-950`}
                          >
                            {DB_PURPOSES.map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDataStore}
                    className="flex items-center gap-2 rounded-lg bg-card/50 px-4 py-2.5 text-sm text-muted-foreground ring-1 border border-card-border hover:bg-card/60 transition w-full justify-center"
                  >
                    <Plus className="h-4 w-4" /> Add Data Store
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Crown Jewels */}
            {step === 3 && (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex items-start gap-3">
                  <Crown className="mt-1 h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Crown Jewels</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select the data stores that contain your most critical business data.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {dataStores.length === 0 && (
                    <p className="text-sm text-muted-foreground/70">
                      No data stores defined. Go back and add some.
                    </p>
                  )}
                  {dataStores.map((ds) => {
                    const selected = crownJewelIds.has(ds.id);
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => toggleCrownJewel(ds.id)}
                        className={`flex items-center justify-between w-full rounded-lg px-4 py-3 text-sm ring-1 transition-all ${selected ? 'bg-amber-500/15 text-amber-200 ring-amber-500/40' : 'bg-white/3 text-muted-foreground/80 ring-white/6 hover:ring-white/20'}`}
                      >
                        <span className="flex items-center gap-3">
                          <Database className="h-4 w-4" />
                          {ds.type} — {ds.purpose}
                        </span>
                        {selected && <Shield className="h-4 w-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-foreground">Review your workspace</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Organization
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{orgName}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Industry
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{industry}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Servers
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {servers.reduce((sum, s) => sum + s.quantity, 0)} across {servers.length}{' '}
                      group(s)
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Data Stores
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {dataStores.length} database(s)
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Crown Jewels
                    </p>
                    <p className="mt-2 text-sm font-medium text-amber-300">
                      {crownJewelIds.size} critical asset(s)
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-4 ring-1 ring-white/6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Providers
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {cloudProviders.length
                        ? cloudProviders.map((p) => p.toUpperCase()).join(', ')
                        : 'None'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || loading}
                className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue || loading}
                  className={btnPrimary}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={loading}
                  className={btnPrimary}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Launch Workspace'}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
