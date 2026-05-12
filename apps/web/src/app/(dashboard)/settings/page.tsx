'use client';

import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Key, Palette, Shield, Database, Bell } from 'lucide-react';

const sections = [
  { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Manage Anthropic, NVD, and external API keys' },
  { id: 'theme', label: 'Appearance', icon: Palette, description: 'Customize theme, colors, and display preferences' },
  { id: 'auth', label: 'Access Control', icon: Shield, description: 'RBAC roles, permissions, and user management' },
  { id: 'database', label: 'Database', icon: Database, description: 'Neo4j, Qdrant, and Valkey connection settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences and notification channels' },
];

export default function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Platform configuration and preferences</p>
      </div>

      <div className="space-y-3">
        {sections.map((section, i) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-5 flex items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 ring-1 ring-primary-500/20 group-hover:ring-primary-500/30 transition-all">
              <section.icon className="h-5 w-5 text-primary-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">{section.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
            </div>
            <SettingsIcon className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
