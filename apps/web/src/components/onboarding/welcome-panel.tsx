import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ArrowRight, Building2, UserCircle2 } from 'lucide-react';
import Link from 'next/link';

export function WelcomePanel() {
  return (
    <main className="min-h-screen px-4 py-12 bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="flex justify-end px-2">
          <ThemeToggle />
        </div>

        <header className="relative overflow-hidden rounded-3xl border border-card-border bg-card p-8 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="absolute -top-16 right-10 h-40 w-40 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-4 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-accent-500 dark:text-accent-400">
              Welcome
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Welcome to ARGUS
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              AI-powered relationship graph for security threats. Map exposure, understand risk, and
              act fast.
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-600 hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#signup"
                className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card/50 px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-card hover:border-card-border/80"
              >
                Sign up
              </a>
            </div>
          </div>
        </header>

        <section id="signup" className="grid gap-6 md:grid-cols-2">
          <div className="group rounded-2xl border border-card-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 transition-transform group-hover:scale-110">
              <UserCircle2 className="h-6 w-6 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Individual User</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a user account with email and password. Your admin can invite you to an
              organization later.
            </p>
            <Link
              href="/onboarding/user"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent-600 dark:text-accent-400 transition-colors hover:text-accent-700 dark:hover:text-accent-300"
            >
              User sign up
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="group rounded-2xl border border-card-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 transition-transform group-hover:scale-110">
              <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Organisation</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Set up your organization workspace and seed your tenant graph. Includes account
              creation.
            </p>
            <Link
              href="/onboarding/organization"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
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
