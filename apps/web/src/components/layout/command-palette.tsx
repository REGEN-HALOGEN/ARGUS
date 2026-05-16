'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const commands = [
  {
    id: 'dashboard',
    label: 'Go to Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    group: 'Navigation',
  },
  {
    id: 'graph',
    label: 'Go to Graph Explorer',
    icon: Network,
    href: '/graph',
    group: 'Navigation',
  },
  {
    id: 'analyst',
    label: 'Go to AI Analyst',
    icon: BrainCircuit,
    href: '/analyst',
    group: 'Navigation',
  },
  { id: 'cve', label: 'Go to CVE Intelligence', icon: Shield, href: '/cve', group: 'Navigation' },
  {
    id: 'threats',
    label: 'Go to Threat Actors',
    icon: Users,
    href: '/threats',
    group: 'Navigation',
  },
  {
    id: 'settings',
    label: 'Go to Settings',
    icon: Settings,
    href: '/settings',
    group: 'Navigation',
  },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }

      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex].href);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1220]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-card-border px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none"
              />
              <kbd className="rounded bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground/70">
                  No commands found.
                </div>
              ) : (
                filtered.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => handleSelect(cmd.href)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary-500/12 text-primary-300'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <cmd.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {index === selectedIndex && <ArrowRight className="h-3 w-3" />}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-card-border px-4 py-2.5 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-card/60 px-1 py-0.5">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-card/60 px-1 py-0.5">↵</kbd> Select
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
