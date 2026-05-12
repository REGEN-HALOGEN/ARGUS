'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Globe, Target, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ThreatActor {
  name: string;
  country: string;
  sophistication: 'advanced' | 'intermediate' | 'basic';
  motivation: string;
  techniqueCount: number;
  targetedAssets: number;
  lastSeen?: string;
}

function sophBadge(s: string) {
  if (s === 'advanced') return 'bg-threat-500/15 text-threat-400 ring-threat-500/30';
  if (s === 'intermediate') return 'bg-warning-500/15 text-warning-400 ring-warning-500/30';
  return 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
}

export default function ThreatsPage() {
  const [actors, setActors] = useState<ThreatActor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiFetch<ThreatActor[]>('/threat-actors');
        setActors(data);
      } catch (error) {
        console.error('Failed to load threat actors:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Threat Actors</h1>
        <p className="text-sm text-slate-400 mt-1">APT profiles and threat actor intelligence</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : actors.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-500">
          No threat actors found in the knowledge graph.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {actors.map((actor, i) => (
            <motion.div
              key={actor.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="glass-card p-5 cursor-pointer group hover:ring-1 hover:ring-primary-500/20 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-threat-500/10 ring-1 ring-threat-500/20">
                    <Users className="h-5 w-5 text-threat-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200 group-hover:text-slate-100">{actor.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Globe className="h-3 w-3 text-slate-500" />
                      <span className="text-xs text-slate-500">{actor.country || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${sophBadge(actor.sophistication)}`}>
                  {actor.sophistication}
                </span>
                <span className="text-xs text-slate-500">{actor.motivation || 'Unknown'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.03] p-2.5 text-center">
                  <p className="text-lg font-bold text-slate-200">{actor.techniqueCount || 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">ATT&CK Techniques</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2.5 text-center">
                  <p className="text-lg font-bold text-threat-400">{actor.targetedAssets || 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Targeted Assets</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
                <Target className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] text-slate-500">Last seen: {actor.lastSeen ? new Date(actor.lastSeen).toLocaleDateString() : 'Unknown'}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
