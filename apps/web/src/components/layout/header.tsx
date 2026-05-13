'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, platformRole, orgRole } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#070b14]/80 backdrop-blur-xl px-6"
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-400">System Operational</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-threat-500 ring-2 ring-[#070b14]" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
        >
          {mounted ? (
            theme === 'dark' ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )
          ) : (
            <Sun className="h-[18px] w-[18px] opacity-0" />
          )}
        </button>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/[0.06]">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200">{user?.name || 'Operator'}</span>
            <span className="text-[10px] text-slate-500">
              {platformRole ?? orgRole ?? 'user'} · {user?.email || 'admin@argus'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-threat-500/10 hover:text-threat-400"
            title="Sign Out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
