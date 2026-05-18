'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, HelpCircle, ShieldCheck, UserCircle2, X } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';

interface Question {
  id: string;
  text: string;
  description: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'team',
    text: 'Are you setting up ARGUS for an entire company or security team?',
    description: 'Select yes if you need to create a new workspace for your organization.',
  },
  {
    id: 'infra',
    text: 'Will you be connecting cloud infrastructure or on-prem data sources?',
    description: 'Select yes if you are responsible for seeding the threat graph with assets.',
  },
  {
    id: 'joining',
    text: 'Are you an individual contributor joining a workspace created by your admin?',
    description: 'Select yes if your team already has an ARGUS account and you just need access.',
  },
];

export function OnboardingWizard({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [, setAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<'individual' | 'organization' | null>(null);

  const handleAnswer = (val: boolean) => {
    const q = QUESTIONS[step];
    if (!q) return;

    setAnswers((prev) => {
      const newAnswers = { ...prev, [q.id]: val };

      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        // Weighted scoring logic using the freshly merged answers
        let score = 0;
        if (newAnswers.team) score += 10;
        if (newAnswers.infra) score += 10;
        if (newAnswers.joining) score -= 25;

        setResult(score > 0 ? 'organization' : 'individual');
      }
      return newAnswers;
    });
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setResult(null);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) reset();
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-6 animate-slide-in">
          <div className="relative overflow-hidden rounded-3xl border border-card-border bg-card p-8 shadow-2xl">
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 border border-primary-500/20">
                    <ShieldCheck className="h-5 w-5 text-primary-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Setup Assistant</h2>
                    <p className="text-xs text-muted-foreground">Find the right path for you</p>
                  </div>
                </div>
                <Dialog.Close className="rounded-full p-2 hover:bg-white/5 transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </Dialog.Close>
              </div>

              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div
                    key={`step-${step}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary-500">
                        <HelpCircle className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          Question {step + 1} of 3
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground leading-tight">
                        {QUESTIONS[step]?.text}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {QUESTIONS[step]?.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleAnswer(true)}
                        className="flex items-center justify-center rounded-2xl bg-primary-500/10 border border-primary-500/20 py-4 text-sm font-bold text-primary-500 hover:bg-primary-500 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Yes, definitely
                      </button>
                      <button
                        onClick={() => handleAnswer(false)}
                        className="flex items-center justify-center rounded-2xl bg-white/5 border border-card-border py-4 text-sm font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        No, not really
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="text-center space-y-2">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 border border-success-500/20 mb-2">
                        <ShieldCheck className="h-6 w-6 text-success-500" />
                      </div>
                      <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                        Recommended Path
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Based on your answers, we recommend:
                      </p>
                    </div>

                    <div className="p-1 rounded-3xl border border-card-border bg-black/20">
                      {result === 'organization' ? (
                        <div className="flex flex-col gap-4 p-6 rounded-[calc(1.5rem-1px)] bg-card border border-primary-500/20">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                              <Building2 className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground">Organization Onboarding</h4>
                              <p className="text-xs text-muted-foreground">
                                Setup workspace & connect infrastructure
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/onboarding/organization"
                            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600"
                          >
                            Start Organization Setup
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 p-6 rounded-[calc(1.5rem-1px)] bg-card border border-primary-500/20">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500">
                              <UserCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground">Individual Account</h4>
                              <p className="text-xs text-muted-foreground">
                                Create your account and join a team
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/onboarding/user"
                            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-accent-500 py-4 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition hover:bg-accent-600"
                          >
                            Create User Account
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={reset}
                      className="w-full text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
                    >
                      Start Over
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
