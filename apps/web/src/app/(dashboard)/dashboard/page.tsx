'use client';

import { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Activity,
  TrendingUp,
  Users,
  Network,
  Bug,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DashboardStats {
  totalAssets: number;
  criticalVulnerabilities: number;
  activeThreatActors: number;
  activeExploits: number;
  crownJewels: number;
  riskScore: number;
}

// ─── Animation Variants ──────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

// ─── Helper ──────────────────────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-threat-500/15 text-threat-400 ring-threat-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-400 ring-orange-500/30';
    case 'medium': return 'bg-warning-500/15 text-warning-400 ring-warning-500/30';
    default: return 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  }
}

function statGlowClass(color: string): string {
  switch (color) {
    case 'primary': return 'glow-primary';
    case 'threat': return 'glow-threat';
    case 'accent': return 'glow-accent';
    case 'warning': return 'glow-primary';
    default: return '';
  }
}

function statIconBg(color: string): string {
  switch (color) {
    case 'primary': return 'bg-primary-500/15 text-primary-400';
    case 'threat': return 'bg-threat-500/15 text-threat-400';
    case 'accent': return 'bg-accent-500/15 text-accent-400';
    case 'warning': return 'bg-warning-500/15 text-warning-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

// ─── Types ───────────────────────────────────────────────────────

interface Alert {
  id: number;
  severity: string;
  title: string;
  source: string;
  exploited: boolean;
  cvss: number;
  affectedAssets: string[];
  time: string;
}

interface AttackPath {
  id: number;
  name: string;
  risk: number;
  nodes: number;
}

// ─── Dashboard Page ──────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [paths, setPaths] = useState<AttackPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, alertsData, pathsData] = await Promise.all([
          apiFetch<DashboardStats>('/dashboard/stats'),
          apiFetch<Alert[]>('/dashboard/alerts'),
          apiFetch<AttackPath[]>('/dashboard/attack-paths'),
        ]);

        setStats(statsData);
        setAlerts(alertsData);
        setPaths(pathsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const statCards = [
    { label: 'Total Assets', value: stats?.totalAssets ?? '-', change: '+0%', icon: Network, color: 'primary' },
    { label: 'Critical CVEs', value: stats?.criticalVulnerabilities ?? '-', change: '+0', icon: Bug, color: 'threat' },
    { label: 'Threat Actors', value: stats?.activeThreatActors ?? '-', change: '+0', icon: Users, color: 'warning' },
    { label: 'Risk Score', value: stats?.riskScore ?? '-', change: '-0', icon: Shield, color: 'accent' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Threat Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time security posture overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-3 w-3 text-success-400" />
          Last updated: just now
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`glass-card p-5 ${statGlowClass(stat.color)} transition-shadow duration-300 relative overflow-hidden`}
          >
            {loading && (
              <div className="absolute inset-0 bg-white/[0.02] animate-pulse" />
            )}
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-slate-100 mt-2">{stat.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${statIconBg(stat.color)}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 relative z-10">
              <TrendingUp className="h-3 w-3 text-success-400" />
              <span className="text-xs font-medium text-success-400">{stat.change}</span>
              <span className="text-xs text-slate-500">vs last week</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <motion.div variants={itemVariants} className="xl:col-span-2 glass-card overflow-hidden relative">
          <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-400" />
              <h2 className="font-semibold text-slate-200">Recent Alerts</h2>
            </div>
            <span className="text-xs text-slate-500">{alerts.length} alerts</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="p-5 text-center text-sm text-slate-500 animate-pulse">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="p-5 text-center text-sm text-slate-500">No recent alerts.</div>
            ) : (
              alerts.map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <span
                    className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${severityColor(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate group-hover:text-slate-100 transition-colors">
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{alert.source}</p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{alert.time}</span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Attack Paths */}
        <motion.div variants={itemVariants} className="glass-card overflow-hidden relative">
          <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-threat-400" />
              <h2 className="font-semibold text-slate-200">Top Attack Paths</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="p-2 text-center text-sm text-slate-500 animate-pulse">Loading paths...</div>
            ) : paths.length === 0 ? (
              <div className="p-2 text-center text-sm text-slate-500">No attack paths found.</div>
            ) : (
              paths.map((path, i) => (
                <motion.div
                  key={path.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-snug">
                      {path.name}
                    </p>
                    <span
                      className={`shrink-0 ml-2 text-xs font-bold ${
                        path.risk >= 90
                          ? 'text-threat-400'
                          : path.risk >= 70
                            ? 'text-orange-400'
                            : 'text-warning-400'
                      }`}
                    >
                      {path.risk}
                    </span>
                  </div>
                  {/* Risk bar */}
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${path.risk}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                      className={`h-full rounded-full ${
                        path.risk >= 90
                          ? 'bg-gradient-to-r from-threat-500 to-threat-400'
                          : path.risk >= 70
                            ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                            : 'bg-gradient-to-r from-warning-500 to-warning-400'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500">{path.nodes} nodes in path</span>
                    <span className="text-[10px] text-slate-500">Risk Score</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* AI Insights Banner */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-950/60 via-primary-900/40 to-accent-950/60 p-6 ring-1 ring-primary-500/20"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-accent-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-400">
              AI Insight
            </span>
          </div>
          <p className="text-sm text-slate-200 max-w-2xl leading-relaxed">
            ARGUS has identified <strong className="text-primary-300">{paths.length} critical attack paths</strong> to your
            crown jewels. The most critical path has a risk score of <strong className="text-threat-400">{paths[0]?.risk || 0}</strong> and involves {paths[0]?.nodes || 0} nodes.
          </p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-500/15 px-4 py-2 text-sm font-medium text-primary-300 ring-1 ring-primary-500/30 transition-all hover:bg-primary-500/25 hover:ring-primary-500/50">
            View Full Analysis →
          </button>
        </div>
        {/* Background glow */}
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl" />
      </motion.div>
    </motion.div>
  );
}
