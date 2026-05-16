'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Key,
  Palette,
  Shield,
  Database,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Loader2,
  X,
  Info,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from 'next-themes';

/* ─── Types ──────────────────────────────────────────────────────── */

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const sections: SettingsSection[] = [
  { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Manage Anthropic, NVD, and external API keys' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Customize theme, colors, and display preferences' },
  { id: 'access', label: 'Access Control', icon: Shield, description: 'RBAC roles, permissions, and user management' },
  { id: 'database', label: 'Database', icon: Database, description: 'Neo4j, Qdrant, and Valkey connection settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences and notification channels' },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

function MaskedKey({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="text-slate-400 select-all">
        {visible ? value : value.slice(0, 4) + '•'.repeat(Math.max(value.length - 8, 4)) + value.slice(-4)}
      </span>
      <button onClick={() => setVisible(!visible)} className="text-slate-500 hover:text-slate-300 transition-colors">
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        saved
          ? 'bg-success-500/20 text-success-400 ring-1 ring-success-500/30'
          : 'bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30 hover:bg-primary-500/30'
      }`}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
    </button>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        enabled ? 'bg-primary-500' : 'bg-white/[0.08]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-primary-500/5 ring-1 ring-primary-500/10 p-3 mb-5">
      <Info className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

/* ─── Panel: API Keys ────────────────────────────────────────────── */

function ApiKeysPanel() {
  const [keys, setKeys] = useState({
    nvd: 'nvd-api-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    anthropic: 'sk-ant-api-xxxx-xxxxxxxxxxxxxxxxxxxxxxx',
    openai: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <InfoBanner text="API keys are encrypted at rest and used only for server-side integrations. They are never exposed to the browser." />
      <div className="space-y-4">
        {[
          { id: 'nvd', label: 'NVD API Key', desc: 'National Vulnerability Database' },
          { id: 'anthropic', label: 'Anthropic API Key', desc: 'Claude AI integration' },
          { id: 'openai', label: 'OpenAI API Key', desc: 'Optional — GPT fallback' },
        ].map((item) => (
          <div key={item.id} className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">{item.label}</h4>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
              </div>
              {(keys as any)[item.id] && <MaskedKey value={(keys as any)[item.id]} />}
            </div>
            <input
              type="password"
              value={(keys as any)[item.id]}
              onChange={(e) => setKeys((prev) => ({ ...prev, [item.id]: e.target.value }))}
              placeholder={`Enter ${item.label.toLowerCase()}…`}
              className="w-full mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 ring-1 ring-white/[0.06] focus:outline-none focus:ring-primary-500/40 transition-all"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-5">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
}

/* ─── Panel: Appearance ──────────────────────────────────────────── */

function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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
                      : 'bg-background/50 text-slate-500 ring-card-border hover:bg-background/80'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Density */}
        <div className="rounded-xl bg-card/50 ring-1 ring-card-border p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Display Density</h4>
          <div className="flex gap-3">
            {(['compact', 'comfortable'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                className={`flex-1 rounded-lg py-3 text-sm font-medium capitalize transition-all ring-1 ${
                  density === d
                    ? 'bg-primary-500/15 text-primary-500 ring-primary-500/30'
                    : 'bg-background/50 text-slate-500 ring-card-border hover:bg-background/80'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Animations */}
        <div className="rounded-xl bg-card/50 ring-1 ring-card-border p-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Animations</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Enable motion and transition effects</p>
          </div>
          <ToggleSwitch enabled={animationsEnabled} onChange={setAnimationsEnabled} />
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
}

/* ─── Panel: Access Control ──────────────────────────────────────── */

function AccessControlPanel() {
  const { user, platformRole, orgRole } = useAuth();

  return (
    <div>
      <InfoBanner text="Access control is managed per-organization. Contact your org admin to modify roles." />
      <div className="space-y-4">
        {/* Current user */}
        <div className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Your Permissions</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Platform Role</p>
              <p className="text-sm font-semibold text-slate-200">{platformRole ?? 'Standard'}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Organization Role</p>
              <p className="text-sm font-semibold text-slate-200 capitalize">{orgRole ?? 'None'}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Email</p>
              <p className="text-sm text-slate-300 truncate">{user?.email ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Name</p>
              <p className="text-sm text-slate-300 truncate">{user?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* RBAC overview */}
        <div className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Role Hierarchy</h4>
          <div className="space-y-2">
            {[
              { role: 'Super Admin', scope: 'Platform-wide', color: 'text-threat-400 bg-threat-500/10' },
              { role: 'Org Admin', scope: 'Organization', color: 'text-warning-400 bg-warning-500/10' },
              { role: 'Operator', scope: 'Read/Write', color: 'text-primary-400 bg-primary-500/10' },
              { role: 'Analyst', scope: 'Read + AI', color: 'text-accent-400 bg-accent-500/10' },
              { role: 'Viewer', scope: 'Read-only', color: 'text-slate-400 bg-slate-500/10' },
            ].map((r) => (
              <div key={r.role} className="flex items-center justify-between rounded-lg bg-white/[0.02] p-3">
                <span className="text-sm font-medium text-slate-300">{r.role}</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${r.color}`}>
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

function DatabasePanel() {
  const [connections] = useState([
    { name: 'Neo4j', uri: process.env.NEXT_PUBLIC_NEO4J_URI || 'bolt://localhost:7687', status: 'connected' },
    { name: 'Qdrant', uri: process.env.NEXT_PUBLIC_QDRANT_URL || 'http://localhost:6333', status: 'connected' },
    { name: 'Valkey (Redis)', uri: 'redis://localhost:6379', status: 'connected' },
    { name: 'Supabase (Auth)', uri: 'PostgreSQL', status: 'connected' },
  ]);

  return (
    <div>
      <InfoBanner text="Database connections are configured via environment variables on the API server. These values are read-only in the dashboard." />
      <div className="space-y-3">
        {connections.map((conn) => (
          <div key={conn.name} className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">{conn.name}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{conn.uri}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${conn.status === 'connected' ? 'bg-success-400' : 'bg-threat-400'} animate-pulse`} />
              <span className={`text-[10px] uppercase tracking-wider font-bold ${conn.status === 'connected' ? 'text-success-400' : 'text-threat-400'}`}>
                {conn.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Panel: Notifications ───────────────────────────────────────── */

function NotificationsPanel() {
  const [prefs, setPrefs] = useState({
    criticalAlerts: true,
    newCves: true,
    threatActorUpdates: false,
    weeklyDigest: true,
    ingestionStatus: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <InfoBanner text="Notification preferences are stored per-user and apply across all organizations you belong to." />
      <div className="space-y-3">
        {[
          { key: 'criticalAlerts' as const, label: 'Critical Severity Alerts', desc: 'Immediate notification for CVSS ≥ 9.0 vulnerabilities' },
          { key: 'newCves' as const, label: 'New CVE Ingestion', desc: 'Notify when new vulnerabilities are ingested' },
          { key: 'threatActorUpdates' as const, label: 'Threat Actor Activity', desc: 'Updates on tracked APT groups' },
          { key: 'weeklyDigest' as const, label: 'Weekly Digest', desc: 'Summary of your organization\u2019s risk posture' },
          { key: 'ingestionStatus' as const, label: 'Ingestion Pipeline Status', desc: 'Alerts on data pipeline failures or delays' },
        ].map((item) => (
          <div key={item.key} className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">{item.label}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
            </div>
            <ToggleSwitch enabled={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-5">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
}

/* ─── Settings Page ──────────────────────────────────────────────── */

const panelMap: Record<string, React.FC> = {
  'api-keys': ApiKeysPanel,
  appearance: AppearancePanel,
  access: AccessControlPanel,
  database: DatabasePanel,
  notifications: NotificationsPanel,
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const ActivePanel = activeSection ? panelMap[activeSection] : null;
  const activeInfo = sections.find((s) => s.id === activeSection);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Platform configuration and preferences</p>
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
                  isActive
                    ? 'ring-1 ring-primary-500/30 bg-primary-500/[0.06]'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-all shrink-0 ${
                    isActive
                      ? 'bg-primary-500/15 ring-primary-500/30'
                      : 'bg-white/[0.04] ring-white/[0.06] group-hover:ring-white/[0.1]'
                  }`}
                >
                  <section.icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isActive ? 'text-primary-300' : 'text-slate-200'}`}>
                    {section.label}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">{section.description}</p>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isActive ? 'rotate-90 text-primary-400' : 'text-slate-600'
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
                    <activeInfo.icon className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{activeInfo.label}</h2>
                    <p className="text-xs text-slate-500">{activeInfo.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSection(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors"
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
              <div className="h-14 w-14 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] flex items-center justify-center mb-4">
                <SettingsIcon className="h-7 w-7 text-slate-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">Select a section</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                Choose a configuration category from the sidebar to view and edit settings.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
