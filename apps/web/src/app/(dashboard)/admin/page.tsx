'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Users, UserCog, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';

type AdminUsersResponse = {
  users?: Array<{
    id: string;
    name?: string;
    email?: string;
    role?: string;
  }>;
  total?: number;
};

type OrganizationMember = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user?: {
    id: string;
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
};

type OrganizationsResponse = Organization[];

export default function AdminPage() {
  const { platformRole, loading } = useAuth();
  const [users, setUsers] = useState<AdminUsersResponse['users']>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState('');
  const [orgsError, setOrgsError] = useState('');

  useEffect(() => {
    if (platformRole !== 'super_admin') return;

    apiFetch<AdminUsersResponse>('/admin/users?limit=25')
      .then((data) => setUsers(data.users ?? []))
      .catch((err: Error) => setError(err.message));

    apiFetch<OrganizationsResponse>('/admin/organizations?limit=100')
      .then((data) => setOrganizations(Array.isArray(data) ? data : []))
      .catch((err: Error) => setOrgsError(err.message));
  }, [platformRole]);

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
        <h1 className="text-2xl font-semibold text-slate-100">Platform Admin</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage platform-level users and global administrator permissions. Organization roles are managed within each workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <ShieldCheck className="h-5 w-5 text-primary-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">Admin Scope</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">Global</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <Users className="h-5 w-5 text-accent-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">Platform Users</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{users?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <Building2 className="h-5 w-5 text-success-400" />
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">Organizations</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{organizations?.length ?? 0}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-threat-500/20 bg-threat-500/10 p-4 text-sm text-threat-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <div className="border-b border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200">
          Platform Users
        </div>
        <div className="divide-y divide-white/[0.06]">
          {users?.map((user) => (
            <div key={user.id} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">{user.name || 'Unnamed user'}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <span className="self-center rounded-md bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
                {user.role === 'super_admin' ? 'Platform Admin' : 'User'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {orgsError ? (
        <div className="rounded-lg border border-threat-500/20 bg-threat-500/10 p-4 text-sm text-threat-300">
          {orgsError}
        </div>
      ) : null}

      {organizations && organizations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-100">Organizations & Members</h2>
          </div>
          <div className="grid gap-4">
            {organizations.map((org) => (
              <div key={org.id} className="rounded-lg border border-white/[0.06] overflow-hidden">
                <div className="bg-white/[0.03] px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{org.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{org.slug}</p>
                    </div>
                    <span className="rounded-md bg-white/[0.04] px-2 py-1 text-xs text-slate-400">
                      {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {org.members && org.members.length > 0 ? (
                    org.members.map((member) => (
                      <div key={member.id} className="px-4 py-3 grid grid-cols-[1fr_auto] gap-4">
                        <div>
                          <p className="text-sm text-slate-200">{member.user?.name || 'Unnamed user'}</p>
                          <p className="text-xs text-slate-500">{member.user?.email}</p>
                        </div>
                        <span className="self-center rounded-md bg-primary-500/10 px-2 py-1 text-xs text-primary-300 ring-1 ring-primary-500/30">
                          {member.role}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-slate-500">No members</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
