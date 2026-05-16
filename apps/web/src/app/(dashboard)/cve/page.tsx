'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ExternalLink, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface CVE {
  cveId: string;
  severity: string;
  cvss: number;
  exploitedInWild: boolean;
  description: string;
  affectedAssets: number;
  publishedDate: string;
}

function sevBadge(sev: string) {
  const map: Record<string, string> = {
    critical: 'bg-threat-500/15 text-threat-400 ring-threat-500/30',
    high: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
    medium: 'bg-warning-500/15 text-warning-400 ring-warning-500/30',
    low: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  };
  return map[sev] ?? map.low;
}

export default function CVEPage() {
  const [cves, setCves] = useState<CVE[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [exploitFilter, setExploitFilter] = useState<boolean | null>(null);

  const toggleSeverity = (sev: string) => {
    setSeverityFilter(prev => 
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  const filteredCves = cves.filter(cve => {
    const severityMatch = severityFilter.length === 0 || severityFilter.includes(cve.severity.toLowerCase());
    const exploitMatch = exploitFilter === null || cve.exploitedInWild === exploitFilter;
    return severityMatch && exploitMatch;
  });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiFetch<CVE[]>('/cve?page=1&limit=20');
        setCves(data);
      } catch (error) {
        if ((error as { silent?: boolean }).silent) return;
        console.error('Failed to load CVEs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      if (!loading && cves.length === 0) {
         apiFetch<CVE[]>('/cve?page=1&limit=20')
           .then(setCves)
           .catch((error) => {
             if ((error as { silent?: boolean }).silent) return;
             console.error('Failed to reload CVEs:', error);
           });
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await apiFetch<CVE[]>(`/cve/search?q=${encodeURIComponent(searchQuery)}`);
        setCves(data);
      } catch (error) {
        if ((error as { silent?: boolean }).silent) return;
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, loading, cves.length]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CVE Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Vulnerability tracking and impact analysis</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-card-border/5 px-4 py-2.5 ring-1 ring-card-border">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
          <input
            placeholder="Search CVEs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="relative">
          <button 
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ring-1 transition-all ${
              filtersOpen || severityFilter.length > 0 || exploitFilter !== null
                ? 'bg-primary-500/10 text-primary-500 ring-primary-500/30'
                : 'bg-card-border/5 text-muted-foreground ring-card-border hover:bg-card-border/10'
            }`}
          >
            <Filter className="h-4 w-4" /> Filter
            {(severityFilter.length > 0 || exploitFilter !== null) && (
              <span className="ml-1 h-2 w-2 rounded-full bg-primary-500" />
            )}
          </button>

          {filtersOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setFiltersOpen(false)} 
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl bg-card p-4 ring-1 ring-card-border shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Severity</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['critical', 'high', 'medium', 'low'].map(sev => (
                        <button
                          key={sev}
                          onClick={() => toggleSeverity(sev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            severityFilter.includes(sev)
                              ? 'bg-primary-500/20 border-primary-500/40 text-primary-300'
                              : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/10'
                          }`}
                        >
                          {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Exploit Status</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExploitFilter(exploitFilter === true ? null : true)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          exploitFilter === true
                            ? 'bg-threat-500/20 border-threat-500/40 text-threat-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/10'
                        }`}
                      >
                        Active Only
                      </button>
                      <button
                        onClick={() => {
                          setSeverityFilter([]);
                          setExploitFilter(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden relative min-h-[400px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CVE ID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CVSS</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exploited</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredCves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                      {cves.length === 0 ? 'No vulnerabilities found.' : 'No vulnerabilities match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredCves.map((cve, i) => (
                    <motion.tr key={cve.cveId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-card-border/5 cursor-pointer group">
                      <td className="px-5 py-3.5 font-mono text-sm font-medium text-primary-500">{cve.cveId}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${sevBadge(cve.severity)}`}>
                          {cve.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{cve.cvss}</td>
                      <td className="px-5 py-3.5">
                        {cve.exploitedInWild ? (
                          <span className="inline-flex items-center gap-1 text-threat-500 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-threat-500 animate-pulse" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-foreground max-w-xs truncate">{cve.description}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{cve.affectedAssets}</td>
                      <td className="px-5 py-3.5">
                        <a 
                          href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded p-1 hover:bg-card-border/10 text-muted-foreground hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="View on NVD"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
