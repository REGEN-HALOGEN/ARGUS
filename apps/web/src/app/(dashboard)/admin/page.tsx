'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type UserOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type AdminUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  organizations?: UserOrg[];
};

type AdminUsersResponse = {
  users?: AdminUser[];
  total?: number;
};

type OrganizationMember = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user?: {
    name?: string;
    email?: string;
  };
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  members: OrganizationMember[];
  metadata?: {
    industry?: string;
    cloudProviders?: string[];
    estimatedAssets?: number;
  } | null;
};

type OrganizationsResponse = Organization[];

// ─── Role Badge Component ────────────────────────────────────────

function RoleBadge({
  role,
  variant: _variant = 'platform',
}: { role: string; variant?: 'platform' | 'org' }) {
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
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ${styles[role] ?? styles.user}`}
    >
      {labels[role] ?? role}
    </span>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────

export default function AdminPage() {
  const { platformRole, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState('');
  const [orgsError, setOrgsError] = useState('');

  // Modals state
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const [addMemberUser, setAddMemberUser] = useState<AdminUser | null>(null);
  const [addMemberOrg, setAddMemberOrg] = useState<Organization | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberSuccess, setAddMemberSuccess] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchData = () => {
    apiFetch<AdminUsersResponse>('/admin/users?limit=25')
      .then((data: AdminUsersResponse) => setUsers(data.users ?? []))
      .catch((err: Error) => setError(err.message));

    apiFetch<OrganizationsResponse>('/admin/organizations?limit=100')
      .then((data: OrganizationsResponse) => setOrganizations(Array.isArray(data) ? data : []))
      .catch((err: Error) => setOrgsError(err.message));
  };

  useEffect(() => {
    if (platformRole !== 'super_admin') return;
    fetchData();
  }, [platformRole]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }

    setIsResetting(true);
    setResetError('');
    try {
      await apiFetch(`/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      setResetSuccess(true);
      setTimeout(() => {
        setResetPasswordUser(null);
        setResetSuccess(false);
        setNewPassword('');
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~}{[]:;?><';
    let generated = '';
    // Ensure at least one lowercase, one uppercase, one number, and one symbol
    generated += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    generated += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    generated += '0123456789'[Math.floor(Math.random() * 10)];
    generated += '!@#$%^&*()_+~}{[]:;?><'[Math.floor(Math.random() * 22)];
    for (let i = 0; i < 12; i++) {
      generated += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    generated = generated
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
    setNewPassword(generated);
    setShowPassword(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUserId = addMemberUser ? addMemberUser.id : selectedUserId;
    const targetOrgId = addMemberOrg ? addMemberOrg.id : selectedOrgId;

    if (!targetUserId || !targetOrgId) {
      setAddMemberError('Please select both a user and an organization.');
      return;
    }

    setIsAddingMember(true);
    setAddMemberError('');
    try {
      await apiFetch('/admin/organizations/members', {
        method: 'POST',
        body: JSON.stringify({
          userId: targetUserId,
          organizationId: targetOrgId,
          role: memberRole,
        }),
      });
      setAddMemberSuccess(true);
      fetchData();
      setTimeout(() => {
        setAddMemberUser(null);
        setAddMemberOrg(null);
        setSelectedOrgId('');
        setSelectedUserId('');
        setMemberRole('member');
        setAddMemberSuccess(false);
      }, 1500);
    } catch (err: any) {
      setAddMemberError(err.message || 'Failed to add user to organization.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteUser) return;

    setIsDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/admin/users/${deleteUser.id}`, {
        method: 'DELETE',
      });
      fetchData();
      setDeleteUser(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to remove user.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (platformRole !== 'super_admin') {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-threat-500/20 bg-threat-500/10 p-4 text-sm text-threat-300">
          Platform administrator access is required.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform-level users and global administrator permissions. Organization roles are
          managed within each workspace.
        </p>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-card-border bg-card/40 p-4">
          <ShieldCheck className="h-5 w-5 text-primary-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground/70">
            Admin Scope
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">Global</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card/40 p-4">
          <Users className="h-5 w-5 text-accent-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground/70">
            Platform Users
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{users?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card/40 p-4">
          <Building2 className="h-5 w-5 text-success-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground/70">
            Organizations
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{organizations?.length ?? 0}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-threat-500/20 bg-threat-500/10 p-4 text-sm text-threat-300">
          {error}
        </div>
      ) : null}

      {/* ── Platform Users Table ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-card-border">
        <div className="border-b border-card-border bg-card/40 px-4 py-3 text-sm font-semibold text-foreground">
          Platform Users
        </div>
        <div className="divide-y divide-card-border">
          {users?.map((user) => (
            <div key={user.id} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed user'}</p>
                <p className="text-xs text-muted-foreground/70">{user.email}</p>
                {/* Show org memberships inline */}
                {user.organizations && user.organizations.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground/70" />
                    {user.organizations.map((org) => (
                      <span
                        key={org.id}
                        className="inline-flex items-center gap-1 rounded bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 border border-card-border"
                      >
                        {org.name}
                        <span className="text-emerald-400">({org.role})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={user.role ?? 'user'} variant="platform" />

                <div className="flex items-center gap-1.5 border-l border-card-border pl-3 ml-1">
                  <button
                    onClick={() => {
                      setAddMemberUser(user);
                      setSelectedOrgId(organizations[0]?.id || '');
                    }}
                    title="Add to Organization"
                    className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-all hover:scale-105 cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setResetPasswordUser(user);
                      setNewPassword('');
                      setShowPassword(false);
                    }}
                    title="Reset Password"
                    className="p-1.5 rounded-md hover:bg-primary-500/10 text-muted-foreground hover:text-primary-400 transition-all hover:scale-105 cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDeleteUser(user);
                    }}
                    title="Remove User"
                    className="p-1.5 rounded-md hover:bg-threat-500/10 text-muted-foreground hover:text-threat-400 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {orgsError ? (
        <div className="rounded-lg border border-threat-500/20 bg-threat-500/10 p-4 text-sm text-threat-300">
          {orgsError}
        </div>
      ) : null}

      {/* ── Organizations & Members ──────────────────────────────── */}
      {organizations && organizations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Organizations & Members</h2>
          </div>
          <div className="grid gap-4">
            {organizations.map((org) => (
              <div key={org.id} className="rounded-lg border border-card-border overflow-hidden">
                <div className="bg-card/40 px-4 py-3 border-b border-card-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{org.name}</h3>
                      <p className="text-xs text-muted-foreground/70 mt-1">{org.slug}</p>
                      {/* Show org metadata if available */}
                      {org.metadata && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {org.metadata.industry && (
                            <span className="inline-flex items-center rounded bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 border border-card-border">
                              {org.metadata.industry}
                            </span>
                          )}
                          {org.metadata.cloudProviders &&
                            org.metadata.cloudProviders.length > 0 && (
                              <span className="inline-flex items-center rounded bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 border border-card-border">
                                {org.metadata.cloudProviders.map((p) => p.toUpperCase()).join(', ')}
                              </span>
                            )}
                          {org.metadata.estimatedAssets != null && (
                            <span className="inline-flex items-center rounded bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 border border-card-border">
                              ~{org.metadata.estimatedAssets} assets
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setAddMemberOrg(org);
                          setSelectedUserId(users[0]?.id || '');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Member
                      </button>
                      <span className="rounded-md bg-card/50 px-2 py-1 text-xs text-muted-foreground">
                        {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-card-border">
                  {org.members && org.members.length > 0 ? (
                    org.members.map((member) => (
                      <div key={member.id} className="px-4 py-3 grid grid-cols-[1fr_auto] gap-4">
                        <div>
                          <p className="text-sm text-foreground">
                            {member.user?.name || 'Unnamed user'}
                          </p>
                          <p className="text-xs text-muted-foreground/70">{member.user?.email}</p>
                        </div>
                        <div className="self-center">
                          <RoleBadge role={member.role} variant="org" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground/70">No members</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals & Popups ────────────────────────────────────────── */}
      <AnimatePresence>
        {/* Reset Password Modal */}
        {resetPasswordUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-card-border bg-card/95 p-6 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-card-border pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary-400" />
                  <h3 className="text-base font-semibold text-foreground">Reset Password</h3>
                </div>
                <button
                  onClick={() => setResetPasswordUser(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Resetting password for{' '}
                    <span className="font-semibold text-foreground">
                      {resetPasswordUser.name || resetPasswordUser.email}
                    </span>{' '}
                    ({resetPasswordUser.email}).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      className="w-full rounded-lg bg-card/60 border border-card-border pl-3 pr-20 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    />
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        title="Generate Password"
                        className="p-1 rounded text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 transition-colors"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {resetError && (
                  <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3 text-xs text-threat-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-threat-400" />
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSuccess && (
                  <div className="rounded-lg bg-success-500/10 border border-success-500/20 p-3 text-xs text-success-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-success-400" />
                    <span>Password successfully updated!</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordUser(null)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border hover:bg-card/50 text-muted-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting || resetSuccess}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary-500/20 hover:bg-primary-500/35 text-primary-300 border border-primary-500/30 transition-all cursor-pointer"
                  >
                    {isResetting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Reset Password
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Add User to Organization Modal */}
        {(addMemberUser || addMemberOrg) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-card-border bg-card/95 p-6 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-card-border pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-success-400" />
                  <h3 className="text-base font-semibold text-foreground">Add to Organization</h3>
                </div>
                <button
                  onClick={() => {
                    setAddMemberUser(null);
                    setAddMemberOrg(null);
                    setSelectedOrgId('');
                    setSelectedUserId('');
                    setMemberRole('member');
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="mt-4 space-y-4">
                {/* Information Header */}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {addMemberUser ? (
                      <>
                        Assign{' '}
                        <span className="font-semibold text-foreground">
                          {addMemberUser.name || addMemberUser.email}
                        </span>{' '}
                        to an organization below.
                      </>
                    ) : (
                      <>
                        Add a user to organization{' '}
                        <span className="font-semibold text-foreground">{addMemberOrg?.name}</span>.
                      </>
                    )}
                  </p>
                </div>

                {/* Organization Selection (only if starting from user) */}
                {addMemberUser && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Select Organization
                    </label>
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      required
                      className="w-full rounded-lg bg-card/60 border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                    >
                      <option value="" disabled className="bg-card text-foreground">
                        Choose an organization
                      </option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id} className="bg-card text-foreground">
                          {org.name} ({org.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* User Selection (only if starting from organization) */}
                {addMemberOrg && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Select Platform User
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      required
                      className="w-full rounded-lg bg-card/60 border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                    >
                      <option value="" disabled className="bg-card text-foreground">
                        Choose a user
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id} className="bg-card text-foreground">
                          {u.name || 'Unnamed'} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Role in Organization
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['member', 'admin', 'owner'] as const).map((roleOption) => {
                      const isActive = memberRole === roleOption;
                      return (
                        <button
                          key={roleOption}
                          type="button"
                          onClick={() => setMemberRole(roleOption)}
                          className={`rounded-lg py-2.5 text-xs font-semibold capitalize border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-success-500/15 border-success-500/40 text-success-300 font-bold'
                              : 'bg-card/40 border-card-border hover:bg-card/70 text-muted-foreground'
                          }`}
                        >
                          {roleOption}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {addMemberError && (
                  <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3 text-xs text-threat-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-threat-400" />
                    <span>{addMemberError}</span>
                  </div>
                )}

                {addMemberSuccess && (
                  <div className="rounded-lg bg-success-500/10 border border-success-500/20 p-3 text-xs text-success-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-success-400" />
                    <span>Successfully added user to organization!</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMemberUser(null);
                      setAddMemberOrg(null);
                      setSelectedOrgId('');
                      setSelectedUserId('');
                      setMemberRole('member');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border hover:bg-card/50 text-muted-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingMember || addMemberSuccess}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-success-500/20 hover:bg-success-500/35 text-success-300 border border-success-500/30 transition-all cursor-pointer"
                  >
                    {isAddingMember && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add Member
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Remove User Confirmation Dialog */}
        {deleteUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-threat-500/30 bg-card/95 p-6 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-threat-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-threat-400" />
                  <h3 className="text-base font-semibold text-threat-300">Remove Platform User</h3>
                </div>
                <button
                  onClick={() => setDeleteUser(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleDeleteUser} className="mt-4 space-y-4">
                <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3.5 text-xs text-threat-300 space-y-2">
                  <p className="font-semibold">⚠️ CRITICAL WARNING</p>
                  <p className="leading-relaxed">
                    This action is **irreversible**. Removing this user will permanently delete:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Their platform credentials and session tokens</li>
                    <li>
                      All memberships in organizations ({deleteUser.organizations?.length || 0}{' '}
                      active memberships)
                    </li>
                    <li>Any associated credentials and authentication configurations</li>
                  </ul>
                </div>

                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">User Details:</p>
                  <p className="font-medium text-foreground mt-0.5">
                    {deleteUser.name || 'Unnamed User'}
                  </p>
                  <p className="text-xs text-muted-foreground">{deleteUser.email}</p>
                </div>

                {deleteError && (
                  <div className="rounded-lg bg-threat-500/10 border border-threat-500/20 p-3 text-xs text-threat-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-threat-400" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteUser(null)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border hover:bg-card/50 text-muted-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-threat-500/20 hover:bg-threat-500/35 text-threat-300 border border-threat-500/30 transition-all cursor-pointer"
                  >
                    {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Permanently Delete
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
