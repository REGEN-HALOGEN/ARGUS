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
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">CVE Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Vulnerability tracking and impact analysis</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/[0.06]">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-slate-400" />
          )}
          <input
            placeholder="Search CVEs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06]">
          <Filter className="h-4 w-4" /> Filter
        </button>
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
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">CVE ID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">CVSS</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Exploited</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Assets</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {cves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      No vulnerabilities found.
                    </td>
                  </tr>
                ) : (
                  cves.map((cve, i) => (
                    <motion.tr key={cve.cveId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-white/[0.02] cursor-pointer group">
                      <td className="px-5 py-3.5 font-mono text-sm font-medium text-primary-300">{cve.cveId}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${sevBadge(cve.severity)}`}>
                          {cve.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-200">{cve.cvss}</td>
                      <td className="px-5 py-3.5">
                        {cve.exploitedInWild ? (
                          <span className="inline-flex items-center gap-1 text-threat-400 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-threat-400 animate-pulse" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 max-w-xs truncate">{cve.description}</td>
                      <td className="px-5 py-3.5 text-slate-400">{cve.affectedAssets}</td>
                      <td className="px-5 py-3.5">
                        <a 
                          href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded p-1 hover:bg-white/[0.06] text-slate-500 hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-all"
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
