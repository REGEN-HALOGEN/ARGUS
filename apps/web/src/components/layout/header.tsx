'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { clearActiveTenantId } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, platformRole, orgRole } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    clearActiveTenantId();
    router.replace('/login');
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-card-border bg-background/80 backdrop-blur-xl px-6"
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success-400 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">System Operational</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              showNotifications
                ? 'bg-card/80 text-foreground'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
            }`}
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-threat-500 ring-2 ring-background" />
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-[#0c1220]/95 p-4 ring-1 border border-card-border shadow-xl backdrop-blur-xl z-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 py-0.5 rounded-full bg-card/50">
                    0 New
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-success-500/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-5 w-5 text-success-400" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground/80">
                    You're all caught up!
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    No new alerts or system events.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-card-border">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-foreground">
              {user?.name || 'Operator'}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {platformRole ?? orgRole ?? 'user'} · {user?.email || 'admin@argus'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-threat-500/10 hover:text-threat-400"
            title="Sign Out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
