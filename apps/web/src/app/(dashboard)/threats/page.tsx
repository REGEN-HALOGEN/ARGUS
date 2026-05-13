'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Globe, Target, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ThreatActor {
  name: string;
  country: string;
  description?: string;
  sophistication: 'advanced' | 'intermediate' | 'basic';
  motivation: string;
  techniqueCount: number;
  targetedAssets: number;
  lastSeen?: string;
  cves?: { cveId: string; severity: string; cvss: number }[];
  techniques?: { mitreId: string; name: string; tactic: string }[];
  targets?: { hostname: string; ip?: string; role?: string; criticality?: string }[];
}

function sophBadge(s: string) {
  if (s === 'advanced') return 'bg-threat-500/15 text-threat-400 ring-threat-500/30';
  if (s === 'intermediate') return 'bg-warning-500/15 text-warning-400 ring-warning-500/30';
  return 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
}

export default function ThreatsPage() {
  const [actors, setActors] = useState<ThreatActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedActor, setExpandedActor] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});

  const handleExpand = async (name: string) => {
    if (expandedActor === name) {
      setExpandedActor(null);
      return;
    }
    
    setExpandedActor(name);
    
    const actor = actors.find(a => a.name === name);
    if (actor && actor.targets !== undefined) return;

    setDetailsLoading(prev => ({ ...prev, [name]: true }));
    try {
      const detail = await apiFetch<ThreatActor>(`/threat-actors/${encodeURIComponent(name)}`);
      setActors(prev => prev.map(a => a.name === name ? { ...a, ...detail } : a));
    } catch (error) {
      console.error('Failed to load actor details:', error);
    } finally {
      setDetailsLoading(prev => ({ ...prev, [name]: false }));
    }
  };

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
              className={`glass-card overflow-hidden transition-all duration-300 ${
                expandedActor === actor.name 
                  ? 'ring-1 ring-primary-500/30 shadow-lg shadow-primary-500/10 md:col-span-2 xl:col-span-3' 
                  : 'hover:ring-1 hover:ring-primary-500/20'
              }`}
            >
              <div 
                className="p-5 cursor-pointer group flex flex-col h-full" 
                onClick={() => handleExpand(actor.name)}
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
                <ChevronRight className={`h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-all duration-300 ${expandedActor === actor.name ? 'rotate-90' : ''}`} />
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
              </div>

              {expandedActor === actor.name && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  className="px-5 pb-5 border-t border-white/[0.04] bg-white/[0.01]"
                >
                  {detailsLoading[actor.name] ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="mt-5 space-y-6">
                      {actor.description && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Intelligence Brief</h4>
                          <p className="text-sm text-slate-300 leading-relaxed">{actor.description}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Targeted Assets (Your Context)</h4>
                          {actor.targets && actor.targets.length > 0 ? (
                            <div className="space-y-2">
                              {actor.targets.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-[#0f1523] p-3 rounded-xl ring-1 ring-white/[0.04] hover:ring-white/[0.08] transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-threat-500/10 text-threat-400 ring-1 ring-threat-500/20">
                                      <Target className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-200">{t.hostname}</span>
                                  </div>
                                  {t.role && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/[0.04] px-2 py-1 rounded">{t.role}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-[#0f1523] p-4 rounded-xl ring-1 ring-white/[0.04] text-center">
                              <p className="text-sm text-slate-500">No direct paths to your assets discovered.</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Exploited Vulnerabilities</h4>
                          {actor.cves && actor.cves.length > 0 ? (
                            <div className="space-y-2">
                              {actor.cves.slice(0, 5).map((c, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-[#0f1523] p-3 rounded-xl ring-1 ring-white/[0.04] hover:ring-white/[0.08] transition-all">
                                  <span className="font-mono text-sm font-medium text-primary-300">{c.cveId}</span>
                                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${c.severity === 'critical' ? 'bg-threat-500/15 text-threat-400' : 'bg-warning-500/15 text-warning-400'}`}>
                                    CVSS {c.cvss}
                                  </span>
                                </div>
                              ))}
                              {actor.cves.length > 5 && (
                                <div className="text-center pt-2">
                                  <span className="text-xs font-semibold text-slate-500 hover:text-slate-400 cursor-pointer">+ {actor.cves.length - 5} more known exploits</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-[#0f1523] p-4 rounded-xl ring-1 ring-white/[0.04] text-center">
                              <p className="text-sm text-slate-500">No specific CVE mapping available.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
