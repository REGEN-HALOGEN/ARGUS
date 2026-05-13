import Link from 'next/link';
import { ArrowRight, Building2, UserCircle2 } from 'lucide-react';

export function WelcomePanel() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.55)]">
          <div className="absolute -top-16 right-10 h-40 w-40 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="absolute -bottom-24 left-4 h-48 w-48 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent-400">Welcome</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
              Welcome to ARGUS
            </h1>
            <p className="max-w-2xl text-base text-slate-400 sm:text-lg">
              AI-powered relationship graph for security threats. Map exposure, understand risk, and act fast.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary-500/20 px-5 py-2 text-sm font-semibold text-primary-200 ring-1 ring-primary-500/40 transition hover:bg-primary-500/30"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#signup"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30"
              >
                Sign up
              </a>
            </div>
          </div>
        </header>

        <section id="signup" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/2 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6">
              <UserCircle2 className="h-6 w-6 text-accent-300" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-100">Individual User</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create a user account with email and password. Your admin can invite you to an organization later.
            </p>
            <Link
              href="/onboarding/user"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-300"
            >
              User sign up
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/2 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6">
              <Building2 className="h-6 w-6 text-emerald-300" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-100">Organisation</h2>
            <p className="mt-2 text-sm text-slate-400">
              Set up your organization workspace and seed your tenant graph. Includes account creation.
            </p>
            <Link
              href="/onboarding/organization"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"
            >
              Organisation onboarding
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
