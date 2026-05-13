'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  BrainCircuit,
  Shield,
  Users,
  Settings,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

type PlatformRole = 'super_admin';
type OrgRole = 'org_admin' | 'operator' | 'analyst' | 'viewer';

// ─── Navigation Items ────────────────────────────────────────────

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    orgRoles: ['viewer', 'analyst', 'operator', 'org_admin'],
  },
  {
    href: '/graph',
    label: 'Graph Explorer',
    icon: Network,
    orgRoles: ['analyst', 'operator', 'org_admin'],
  },
  {
    href: '/analyst',
    label: 'AI Analyst',
    icon: BrainCircuit,
    orgRoles: ['viewer', 'analyst', 'operator', 'org_admin'],
  },
  {
    href: '/cve',
    label: 'CVE Intelligence',
    icon: Shield,
    orgRoles: ['viewer', 'analyst', 'operator', 'org_admin'],
  },
  {
    href: '/threats',
    label: 'Threat Actors',
    icon: Users,
    orgRoles: ['analyst', 'operator', 'org_admin'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    orgRoles: ['viewer', 'analyst', 'operator', 'org_admin'],
  },
  {
    href: '/admin',
    label: 'Platform Admin',
    icon: SlidersHorizontal,
    platformRoles: ['super_admin'],
  },
] as const;

function canViewItem(
  item: (typeof navItems)[number],
  platformRole: PlatformRole | null,
  orgRole: OrgRole | null,
) {
  if ('platformRoles' in item && item.platformRoles?.some((role) => role === platformRole))
    return true;
  if ('orgRoles' in item && item.orgRoles?.some((role) => role === orgRole)) return true;
  return false;
}

// ─── Sidebar Component ──────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { platformRole, orgRole } = useAuth();
  const visibleItems = navItems.filter((item) => canViewItem(item, platformRole, orgRole));

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/[0.06] bg-[#0a0f1a]/90 backdrop-blur-xl"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-white/[0.06]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/15 ring-1 ring-primary-500/30">
          <Shield className="h-5 w-5 text-primary-400" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <span className="text-lg font-bold tracking-tight text-gradient-primary">ARGUS</span>
              <p className="text-[10px] font-medium text-slate-500 leading-none mt-0.5">
                Security Intelligence
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search trigger */}
      <div className="px-3 pt-4 pb-2">
        <button
          className="flex w-full items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-400 ring-1 ring-white/[0.06] transition-all hover:bg-white/[0.06] hover:text-slate-300"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 text-left"
              >
                Search...
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && (
            <kbd className="flex items-center gap-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`sidebar-item relative ${isActive ? 'active' : ''}`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary-400"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg py-2 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
