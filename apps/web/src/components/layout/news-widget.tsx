'use client';

import { apiFetch } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Newspaper, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
  summary?: string;
  entities?: string[];
  hasMatch?: boolean;
}

export function NewsWidget({ collapsed }: { collapsed: boolean }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const data = await apiFetch<NewsItem[]>('/news');
        if (data && Array.isArray(data)) {
          setNews(data);
        }
      } catch (err) {
        console.error('Failed to load news', err);
      } finally {
        setLoading(false);
      }
    }
    loadNews();
  }, []);

  if (collapsed) return null;

  return (
    <div className="mt-auto px-3 py-4 w-full border-t border-sidebar-border/50">
      <div
        className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-1"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Newspaper className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Intelligence Feed</span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 space-y-4 px-1"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                <span className="text-[10px] animate-pulse">Analyzing feeds...</span>
              </div>
            ) : news.length > 0 ? (
              news.slice(0, 10).map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group relative"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                        {item.source}
                      </span>
                      {item.hasMatch && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 animate-pulse">
                          <Shield className="h-2.5 w-2.5 fill-amber-500/20" />
                          Match Found
                        </span>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </div>
                  <h4 className="text-[13px] font-semibold leading-tight group-hover:text-primary-400 transition-colors mb-1.5">
                    {item.title}
                  </h4>
                  {item.summary && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-primary-500/30 pl-2 py-0.5 italic">
                      {item.summary}
                    </p>
                  )}
                  <div className="mt-2 h-px w-full bg-gradient-to-r from-sidebar-border/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center italic bg-card-border/5 rounded-lg border border-dashed border-sidebar-border">
                No active threats detected in feed
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
