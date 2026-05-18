'use client';

import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { Globe } from '@/components/ui/globe';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, UserCircle2 } from 'lucide-react';
import Link from 'next/link';

export function WelcomePanel() {
  return (
    <main className="min-h-screen px-4 py-12 bg-transparent select-none">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="flex justify-end px-2">
          <ThemeToggle />
        </div>

        <header className="relative overflow-hidden rounded-3xl border border-card-border bg-card p-8 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="absolute -top-16 right-10 h-40 w-40 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-4 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col gap-4 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-accent-500 dark:text-accent-400">
                Welcome
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl leading-tight">
                Welcome to <span className="text-primary-500">ARGUS</span>
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg leading-relaxed">
                AI-powered relationship graph for security threats. Map exposure, understand risk,
                and act fast.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-600 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <OnboardingWizard
                  trigger={
                    <button className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card/50 px-7 py-3 text-sm font-bold text-foreground transition hover:bg-card hover:border-card-border/80 cursor-pointer">
                      Get Started
                    </button>
                  }
                />
              </div>
            </div>

            {/* Premium Interactive Globe & Central Logo Backing */}
            <div className="hidden md:flex relative items-center justify-center p-4 w-[240px] h-[240px] overflow-visible">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-125 z-0">
                <Globe className="w-full h-full opacity-60 dark:opacity-80 transition-opacity" />
              </div>
              <div className="relative z-10 p-4 rounded-full bg-card/30 backdrop-blur-[3px] border border-card-border shadow-xl transition-transform hover:scale-105 duration-300">
                <Logo
                  width={110}
                  height={110}
                  showText={false}
                  className="opacity-95 hover:opacity-100 transition-opacity drop-shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* ── Selection Paths ────────────────────────────────────────── */}
        <section id="signup" className="grid gap-6 md:grid-cols-2">
          <div className="group rounded-2xl border border-card-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50/10 dark:bg-accent-500/10 transition-transform group-hover:scale-110">
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50/10 dark:bg-emerald-500/10 transition-transform group-hover:scale-110">
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

        {/* ── Scroll Details Section ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mt-8 border-t border-card-border/60 pt-16"
        >
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary-500">
              Living Security Intelligence
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Model, Analyze, and Prevent Attacks in Real Time
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              ARGUS uses state-of-the-art relationship mapping and generative security models to
              trace vulnerabilities across your entire cloud ecosystem.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: 'Living Security Graph',
                desc: 'Every asset, user, CVE, and cloud permission is mapped in Neo4j. Trace lateral movement paths instantly and understand impact relationships.',
                icon: '🕸️',
                color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20',
              },
              {
                title: 'AI-Native Reasoning',
                desc: 'Powered by Google Gemini 2.0. Translates complex cybersecurity telemetry into natural language and generates actionable remediation playbooks.',
                icon: '🧠',
                color: 'from-purple-500/10 to-pink-500/10 border-purple-500/20',
              },
              {
                title: 'Proactive Risk Engine',
                desc: 'Automatically checks external threat intelligence feeds and simulates attack scenarios to highlight critical "crown jewel" exposures.',
                icon: '⚡',
                color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20',
              },
            ].map((feat, idx) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`group relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-br ${feat.color} bg-card/30 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <div className="text-4xl mb-4 transform transition-transform group-hover:scale-110 duration-300 w-fit">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Interactive Statistics Section ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-card-border bg-card/40 p-8 md:p-12 text-center mt-12 mb-16"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl" />

          <div className="relative z-10 grid gap-8 md:grid-cols-3 max-w-4xl mx-auto divide-y md:divide-y-0 md:divide-x divide-card-border">
            <div className="py-4 md:py-0 md:px-4">
              <span className="block text-4xl font-extrabold text-primary-500 tracking-tight">
                &lt; 50ms
              </span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
                Query Resolution Time
              </span>
            </div>
            <div className="py-4 md:py-0 md:px-8">
              <span className="block text-4xl font-extrabold text-accent-500 tracking-tight">
                Gemini 2.0
              </span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
                AI Cognitive Core
              </span>
            </div>
            <div className="py-4 md:py-0 md:px-4">
              <span className="block text-4xl font-extrabold text-emerald-500 tracking-tight">
                Zero Trust
              </span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
                Post-Onboarding Policy
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Footer Branding ────────────────────────────────────────── */}
        <footer className="text-center text-xs text-muted-foreground/60 py-8 border-t border-card-border/30">
          <p>
            © {new Date().getFullYear()} ARGUS Security Intelligence Platform. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
