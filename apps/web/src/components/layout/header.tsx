'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch, clearActiveTenantId } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Building2, Check, CheckCircle2, LogOut, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

/* ─── Types ───────────────────────────────────────────────────────── */

interface PendingInvitation {
  id: string;
  organizationId: string;
  orgName: string;
  inviterId: string;
  inviterName: string | null;
  role: string;
  status: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  operator: 'Operator',
  analyst: 'Analyst',
  viewer: 'Viewer',
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

/* ─── Header Component ────────────────────────────────────────────── */

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, platformRole, orgRole } = useAuth();
  const router = useRouter();

  // Invitation state
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Fetch pending invitations
  const fetchInvitations = useCallback(async () => {
    try {
      setLoadingInvitations(true);
      const data = await apiFetch<PendingInvitation[]>('/invitations/pending');
      setInvitations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      // Silently fail — user might not have invitations endpoint available
      if (!err.silent) {
        console.error('[HEADER] Failed to fetch invitations:', err);
      }
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchInvitations();
      // Poll every 30 seconds for new invitations
      const interval = setInterval(fetchInvitations, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchInvitations]);

  // Handle invitation response
  const handleRespond = async (invitationId: string, action: 'accept' | 'decline') => {
    setRespondingId(invitationId);
    try {
      await apiFetch(`/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });

      // Remove from list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

      if (action === 'accept') {
        // Redirect to dashboard so the new org membership takes effect
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      }
    } catch (err: any) {
      console.error(`[HEADER] Failed to ${action} invitation:`, err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    clearActiveTenantId();
    router.replace('/login');
  };

  const pendingCount = invitations.length;

  if (!user) return null;

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
            {pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-threat-500 text-[9px] font-bold text-white ring-2 ring-background">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-96 rounded-xl bg-[#0c1220]/95 p-4 ring-1 border border-card-border shadow-xl backdrop-blur-xl z-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 py-0.5 rounded-full bg-card/50">
                      {pendingCount} New
                    </span>
                  </div>

                  {loadingInvitations ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner size="sm" />
                    </div>
                  ) : invitations.length === 0 ? (
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
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {invitations.map((inv) => (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="rounded-lg bg-card/40 border border-card-border p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 ring-1 ring-primary-500/20 shrink-0 mt-0.5">
                              <UserPlus className="h-4 w-4 text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">
                                Organization Invitation
                              </p>
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3 text-muted-foreground/60" />
                                  <span className="text-xs text-muted-foreground">
                                    <span className="text-foreground font-medium">{inv.orgName}</span>
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">
                                  Invited by <span className="text-muted-foreground">{inv.inviterName ?? 'an admin'}</span> as{' '}
                                  <span className="text-primary-400 font-semibold">
                                    {roleLabels[inv.role] ?? inv.role}
                                  </span>
                                </p>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => handleRespond(inv.id, 'accept')}
                                  disabled={respondingId === inv.id}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success-500/15 hover:bg-success-500/25 text-success-300 text-[11px] font-semibold border border-success-500/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {respondingId === inv.id ? (
                                    <Spinner size="sm" className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRespond(inv.id, 'decline')}
                                  disabled={respondingId === inv.id}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-card/60 hover:bg-threat-500/15 text-muted-foreground hover:text-threat-300 text-[11px] font-semibold border border-card-border hover:border-threat-500/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <X className="h-3 w-3" />
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
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
