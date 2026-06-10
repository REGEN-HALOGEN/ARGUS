'use client';

import { Markdown } from '@/components/ui/markdown';
import { apiFetch } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  Terminal,
  ExternalLink,
  Cpu,
  Brain,
  CheckCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface Vulnerability {
  cveId: string;
  cvss: number;
  severity: string;
  description: string;
}

interface DatabaseAsset {
  id: string;
  name: string;
  hostname: string;
  dbType: string;
  purpose: string;
  criticality: string;
  safe?: boolean;
  vulnerabilities: Vulnerability[];
}

export default function RectifierPage() {
  const [databases, setDatabases] = useState<DatabaseAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  
  // AI analysis modal/overlay state
  const [analyzingCve, setAnalyzingCve] = useState<{ cveId: string; assetName: string } | null>(null);
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function loadDatabases() {
    try {
      const res = await apiFetch<DatabaseAsset[]>('/rectifier');
      setDatabases(res || []);
    } catch (error) {
      console.error('Failed to load crown jewel databases:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleResolve = async (assetId: string) => {
    setResolvingId(assetId);
    try {
      await apiFetch('/rectifier/resolve', {
        method: 'POST',
        body: JSON.stringify({ assetId }),
      });
      // Optimistic UI update or reload
      setDatabases((prev) =>
        prev.map((db) => (db.id === assetId ? { ...db, safe: true, vulnerabilities: [] } : db))
      );
    } catch (error) {
      console.error('Failed to resolve database vulnerabilities:', error);
    } finally {
      setResolvingId(null);
    }
  };

  const handleAiAnalysis = async (cveId: string, assetName: string) => {
    setAnalyzingCve({ cveId, assetName });
    setAiSolution(null);
    setAiLoading(true);
    try {
      const res = await apiFetch<{ solution: string }>('/rectifier/analyze', {
        method: 'POST',
        body: JSON.stringify({ cveId, assetName }),
      });
      setAiSolution(res.solution);
    } catch (error: any) {
      setAiSolution(`Error performing AI analysis: ${error.message || 'Unknown error'}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary-500" /> Rectifier
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remediate and resolve vulnerabilities affecting database crown jewels
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground/60">Retrieving crown jewel databases…</p>
        </div>
      ) : databases.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto rounded-2xl">
          <ShieldCheck className="h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Databases Found</h2>
          <p className="text-sm text-muted-foreground">
            No database crown jewels were found in your tenant graph. Ensure your organization onboarding configuration includes databases.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {databases.map((db) => {
            const isResolved = db.safe || db.vulnerabilities.length === 0;
            return (
              <motion.div
                key={db.id}
                layout
                className={`glass-card rounded-2xl border transition-all duration-300 p-6 ${
                  isResolved
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-card-border hover:border-primary-500/30'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-card-border pb-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isResolved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                      <Server className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">
                          {db.purpose ? `${db.purpose} DB` : db.name}
                        </h3>
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                            Resolved / Safe
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                            Vulnerable Crown Jewel
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Terminal className="h-3 w-3" /> {db.hostname}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Cpu className="h-3 w-3" /> {db.dbType}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-red-400 uppercase">
                          {db.criticality}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isResolved && (
                    <button
                      onClick={() => handleResolve(db.id)}
                      disabled={resolvingId === db.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 transition-colors disabled:opacity-50"
                    >
                      {resolvingId === db.id ? (
                        <>
                          <Spinner size="sm" /> Resolving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" /> Mark Resolved & Safe
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Vulnerability List */}
                {db.vulnerabilities.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider opacity-75">
                      Vulnerabilities ({db.vulnerabilities.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {db.vulnerabilities.map((v) => (
                        <div
                          key={v.cveId}
                          className="p-4 rounded-xl border border-card-border bg-card/40 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="font-mono text-sm font-bold text-foreground">
                                {v.cveId}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  v.cvss >= 9
                                    ? 'bg-red-600 text-white'
                                    : v.cvss >= 7
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                CVSS {v.cvss.toFixed(1)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-3 mb-4">
                              {v.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-card-border/50">
                            <a
                              href={`https://nvd.nist.gov/vuln/detail/${v.cveId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 flex-1 text-center rounded-lg bg-card-border/10 hover:bg-card-border/20 text-muted-foreground hover:text-foreground font-semibold text-xs py-2 transition-colors"
                            >
                              More Info <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              onClick={() => handleAiAnalysis(v.cveId, db.purpose ? `${db.purpose} Database` : db.name)}
                              className="flex items-center justify-center gap-1.5 flex-1 text-center rounded-lg bg-primary-600/15 hover:bg-primary-600/30 text-primary-300 font-bold text-xs py-2 transition-colors ring-1 ring-primary-500/25"
                            >
                              <Brain className="h-3.5 w-3.5" /> AI Analysis
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium py-2">
                    <ShieldCheck className="h-5 w-5" /> All vulnerabilities resolved. Server is protected.
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI Remediation Recommendation Overlay */}
      <AnimatePresence>
        {analyzingCve && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-2xl w-full rounded-2xl border border-card-border overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
            >
              <div className="p-6 border-b border-card-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary-400" /> AI Remediation Plan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remediation guidelines for {analyzingCve.cveId} on {analyzingCve.assetName}
                  </p>
                </div>
                <button
                  onClick={() => setAnalyzingCve(null)}
                  className="text-muted-foreground hover:text-foreground font-semibold text-sm rounded-lg hover:bg-card-border/10 px-3 py-1.5 transition-all"
                >
                  Close
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <Spinner size="md" />
                    <p className="text-sm text-muted-foreground/60">Consulting Gemini for remediation strategy…</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed text-muted-foreground">
                    {aiSolution && <Markdown content={aiSolution} />}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-card-border flex justify-end">
                <button
                  onClick={() => setAnalyzingCve(null)}
                  className="rounded-xl bg-card-border/10 hover:bg-card-border/20 text-foreground font-bold text-sm px-4 py-2 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
