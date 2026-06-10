'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronRight,
  Database,
  Info,
  Palette,
  Settings as SettingsIcon,
  Shield,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Plus,
  UserPlus,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const sections: SettingsSection[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Customize theme and display preferences',
  },
  {
    id: 'access',
    label: 'Access Control',
    icon: Shield,
    description: 'RBAC roles, permissions, and user management',
  },
  {
    id: 'database',
    label: 'Database',
    icon: Database,
    description: 'Neo4j and Valkey connection status',
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-primary-500/10 ring-1 ring-primary-500/20 p-3 mb-5">
      <Info className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

/* ─── Panel: Appearance ──────────────────────────────────────────── */

function AppearancePanel() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <InfoBanner text="Customize your workspace aesthetics. ARGUS supports high-contrast light and dark themes optimized for cybersecurity workflows." />
      <div className="space-y-5">
        {/* Theme Selection */}
        <div className="rounded-xl bg-card/50 ring-1 ring-card-border p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Theme</h4>
          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map((t) => {
              const isActive = theme === t;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg py-3 text-sm font-medium capitalize transition-all ring-1 ${
                    isActive
                      ? 'bg-primary-500/15 text-primary-500 ring-primary-500/30'
                      : 'bg-background/50 text-muted-foreground/70 ring-card-border hover:bg-background/80'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme applies immediately — info note */}
        <div className="flex items-center gap-2 px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-success-400" />
          <span className="text-[11px] text-muted-foreground/70">Theme changes apply instantly across all pages</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Role Badge Component ──────────────────────────────────────── */

function RoleBadge({
  role,
}: { role: string }) {
  const styles: Record<string, string> = {
    super_admin: 'bg-primary-500/15 text-primary-300 ring-primary-500/30',
    owner: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    org_admin: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    admin: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    operator: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    analyst: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
    viewer: 'bg-slate-500/15 text-muted-foreground/80 ring-slate-500/30',
    member: 'bg-slate-500/15 text-muted-foreground/80 ring-slate-500/30',
    user: 'bg-slate-500/15 text-muted-foreground/80 ring-slate-500/30',
  };

  const labels: Record<string, string> = {
    super_admin: 'Platform Admin',
    owner: 'Owner',
    org_admin: 'Org Admin',
    admin: 'Admin',
    operator: 'Operator',
    analyst: 'Analyst',
    viewer: 'Viewer',
    member: 'Member',
    user: 'User',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ${styles[role] ?? styles.user}`}
    >
      {labels[role] ?? role}
    </span>
  );
}

/* ─── Panel: Access Control ──────────────────────────────────────── */

function AccessControlPanel() {
  const { user, platformRole, orgRole } = useAuth();

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

  const displayPlatformRole = platformRole ? (roleLabels[platformRole] ?? platformRole) : 'Standard';
  const displayOrgRole = orgRole ? (roleLabels[orgRole] ?? orgRole) : 'None';

  // State for members and invitations
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'operator' | 'analyst' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (orgRole !== 'org_admin' && orgRole !== 'operator') return;
    setLoadingMembers(true);
    try {
      const data = await apiFetch<any[]>('/organization/members');
      setMembers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load organization members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [orgRole]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Handle invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setInviteError('');
    setInviteSuccess(false);

    try {
      await apiFetch('/organization/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      setInviteSuccess(true);
      setInviteEmail('');
      setInviteRole('viewer');
      
      // Reload members
      fetchMembers();
      
      setTimeout(() => {
        setInviteSuccess(false);
      }, 3000);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Handle role update
  const handleUpdateRole = async (memberId: string, newRole: string) => {
    setUpdatingMemberId(memberId);
    setActionError('');

    try {
      await apiFetch('/organization/members/role', {
        method: 'PATCH',
        body: JSON.stringify({
          memberId,
          role: newRole,
        }),
      });
      // Refresh the members list
      await fetchMembers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const isOrgAdmin = orgRole === 'org_admin';
  const canViewMembers = orgRole === 'org_admin' || orgRole === 'operator';

  return (
    <div>
      <InfoBanner text="Access control is managed per-organization. Contact your org admin to modify roles." />
      <div className="space-y-6">
        {/* Current user */}
        <div className="rounded-xl bg-background/50 border border-card-border p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Your Permissions</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-background/40 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Platform Role
              </p>
              <p className="text-sm font-semibold text-foreground">{displayPlatformRole}</p>
            </div>
            <div className="rounded-lg bg-background/40 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Organization Role
              </p>
              <p className="text-sm font-semibold text-foreground">
                {displayOrgRole}
              </p>
            </div>
            <div className="rounded-lg bg-background/40 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Email
              </p>
              <p className="text-sm text-muted-foreground/80 truncate">{user?.email ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-background/40 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Name
              </p>
              <p className="text-sm text-muted-foreground/80 truncate">{user?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Invite Member Section (Org Admin Only) */}
        {isOrgAdmin && (
          <div className="rounded-xl bg-background/50 border border-card-border p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary-400" />
              Invite New Member
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Invite a registered user to join this organization. They will receive a notification to accept.
            </p>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                      className="w-full rounded-lg bg-background/60 border border-card-border pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    />
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Select Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full rounded-lg bg-background/60 border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                  >
                    <option value="viewer" className="bg-card text-foreground">Viewer</option>
                    <option value="analyst" className="bg-card text-foreground">Analyst</option>
                    <option value="operator" className="bg-card text-foreground">Operator</option>
                    <option value="org_admin" className="bg-card text-foreground">Org Admin</option>
                  </select>
                </div>
              </div>

              {inviteError && (
                <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3 text-xs text-threat-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-threat-400" />
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
                <div className="rounded-lg bg-success-500/10 border border-success-500/20 p-3 text-xs text-success-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-400" />
                  <span>Invitation sent successfully!</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={inviting || inviteSuccess}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary-500/20 hover:bg-primary-500/35 text-primary-300 border border-primary-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {inviting ? (
                    <Spinner size="sm" className="mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Organization Members Section */}
        {canViewMembers && (
          <div className="rounded-xl bg-background/50 border border-card-border p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Organization Members
            </h4>

            {actionError && (
              <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3 text-xs text-threat-300 flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-threat-400" />
                <span>{actionError}</span>
              </div>
            )}

            {loadingMembers ? (
              <div className="flex items-center justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No organization members found.</p>
            ) : (
              <div className="divide-y divide-card-border">
                {members.map((member) => {
                  const isSelf = member.userId === user?.id;
                  return (
                    <div key={member.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.user?.name || 'Unnamed user'}
                          {isSelf && <span className="text-xs text-muted-foreground/60 ml-1.5">(You)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate">{member.user?.email}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isOrgAdmin && !isSelf ? (
                          <div className="relative flex items-center gap-2">
                            <select
                              value={member.role}
                              disabled={updatingMemberId === member.id}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                              className="rounded bg-background/60 border border-card-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer disabled:opacity-50"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="analyst">Analyst</option>
                              <option value="operator">Operator</option>
                              <option value="org_admin">Org Admin</option>
                            </select>
                            {updatingMemberId === member.id && (
                              <Spinner size="sm" className="h-3.5 w-3.5" />
                            )}
                          </div>
                        ) : (
                          <RoleBadge role={member.role} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RBAC overview */}
        <div className="rounded-xl bg-background/50 border border-card-border p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Role Hierarchy</h4>
          <div className="space-y-2">
            {[
              {
                role: 'Super Admin',
                scope: 'Platform-wide',
                color: 'text-threat-400 bg-threat-500/10',
              },
              {
                role: 'Org Admin',
                scope: 'Organization',
                color: 'text-warning-400 bg-warning-500/10',
              },
              {
                role: 'Operator',
                scope: 'Read/Write',
                color: 'text-primary-400 bg-primary-500/10',
              },
              { role: 'Analyst', scope: 'Read + AI', color: 'text-accent-400 bg-accent-500/10' },
              {
                role: 'Viewer',
                scope: 'Read-only',
                color: 'text-muted-foreground bg-slate-500/10',
              },
            ].map((r) => (
              <div
                key={r.role}
                className="flex items-center justify-between rounded-lg bg-card/30 p-3"
              >
                <span className="text-sm font-medium text-muted-foreground/80">{r.role}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${r.color}`}
                >
                  {r.scope}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel: Database ────────────────────────────────────────────── */

interface ServiceStatus {
  name: string;
  status: 'connected' | 'disconnected';
  latencyMs: number | null;
  uri: string;
}

function DatabasePanel() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${API_BASE}/health/services`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setServices(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
      // Set all as disconnected on failure
      setServices([
        { name: 'Neo4j', status: 'disconnected', latencyMs: null, uri: 'unknown' },
        { name: 'Valkey (Redis)', status: 'disconnected', latencyMs: null, uri: 'unknown' },
        { name: 'Supabase (Auth)', status: 'disconnected', latencyMs: null, uri: 'unknown' },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    fetchHealth(false);
  }, [fetchHealth]);

  const connectedCount = services.filter((s) => s.status === 'connected').length;

  return (
    <div>
      <InfoBanner text="Database connections are configured via environment variables on the API server. Health checks run live against each service." />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">
            {connectedCount}/{services.length} services online
          </span>
          {lastChecked && (
            <span className="text-[10px] text-muted-foreground/50">
              · last checked {lastChecked}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground border border-card-border hover:bg-card/50 hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="rounded-xl bg-background/50 border border-card-border p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  svc.status === 'connected'
                    ? 'bg-success-500/10 ring-1 ring-success-500/20'
                    : 'bg-threat-500/10 ring-1 ring-threat-500/20'
                }`}>
                  {svc.status === 'connected'
                    ? <Wifi className="h-4 w-4 text-success-400" />
                    : <WifiOff className="h-4 w-4 text-threat-400" />
                  }
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{svc.name}</h4>
                  <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{svc.uri}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {svc.latencyMs !== null && svc.status === 'connected' && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {svc.latencyMs}ms
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${svc.status === 'connected' ? 'bg-success-400' : 'bg-threat-400'} animate-pulse`}
                  />
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold ${svc.status === 'connected' ? 'text-success-400' : 'text-threat-400'}`}
                  >
                    {svc.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Settings Page ──────────────────────────────────────────────── */

const panelMap: Record<string, React.FC> = {
  appearance: AppearancePanel,
  access: AccessControlPanel,
  database: DatabasePanel,
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const ActivePanel = activeSection ? panelMap[activeSection] : null;
  const activeInfo = sections.find((s) => s.id === activeSection);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {sections.map((section, i) => {
            const isActive = activeSection === section.id;
            return (
              <motion.button
                key={section.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActiveSection(isActive ? null : section.id)}
                className={`w-full text-left glass-card p-4 flex items-center gap-3 transition-all group ${
                  isActive ? 'ring-1 ring-primary-500/30 bg-primary-500/[0.06]' : 'hover:bg-card/50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-all shrink-0 ${
                    isActive
                      ? 'bg-primary-500/15 ring-primary-500/30'
                      : 'bg-background/30 border border-card-border group-hover:ring-muted-foreground/20'
                  }`}
                >
                  {(() => {
                    const Icon = section.icon as any;
                    return (
                      <Icon
                        className={`h-4.5 w-4.5 ${isActive ? 'text-primary-400' : 'text-muted-foreground'}`}
                      />
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-foreground'}`}
                  >
                    {section.label}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {section.description}
                  </p>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isActive ? 'rotate-90 text-primary-400' : 'text-muted-foreground'
                  }`}
                />
              </motion.button>
            );
          })}
        </div>

        {/* Content Panel */}
        <AnimatePresence mode="wait">
          {ActivePanel && activeInfo ? (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 ring-1 ring-primary-500/20">
                    {(() => {
                      const Icon = activeInfo.icon as any;
                      return <Icon className="h-5 w-5 text-primary-400" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{activeInfo.label}</h2>
                    <p className="text-xs text-muted-foreground">{activeInfo.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSection(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-background/40 border border-card-border hover:text-muted-foreground/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ActivePanel />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px] text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-card-border/5 ring-1 ring-card-border flex items-center justify-center mb-4">
                <SettingsIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Select a section</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Choose a configuration category from the sidebar to view and edit settings.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
