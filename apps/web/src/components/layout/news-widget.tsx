'use client';

import { apiFetch } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Newspaper,
  Zap,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, x: -5 },
  show: { opacity: 1, y: 0, x: 0 },
};

export function NewsWidget({ collapsed }: { collapsed: boolean }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function loadNews(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const data = await apiFetch<NewsItem[]>('/news');
        if (data && Array.isArray(data)) {
          setNews(data);
        }
      } catch (err) {
        console.error('Failed to load news', err);
      } finally {
        if (isInitial) setLoading(false);
      }
    }

    loadNews(true);

    const interval = setInterval(() => loadNews(), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (collapsed) return null;

  return (
    <div className="mt-auto px-2 py-4 w-full border-t border-sidebar-border/30 bg-background/50 backdrop-blur-sm">
      <div
        className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-2 mb-2"
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
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
            Intelligence Feed
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 opacity-50" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-50" />
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="relative group">
              <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 custom-scrollbar scroll-smooth py-2">
                {loading && news.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                    <div className="relative">
                      <Spinner size="sm" />
                      <div className="absolute inset-0 blur-lg bg-primary-500/20 animate-pulse" />
                    </div>
                    <span className="text-[10px] font-medium animate-pulse tracking-wide uppercase">
                      Ingesting Feeds...
                    </span>
                  </div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-4 px-1"
                  >
                    {news.map((item, i) => (
                      <motion.a
                        key={i}
                        variants={itemVariants}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group/item relative p-3 rounded-xl transition-all duration-300 hover:bg-white/[0.03] ring-1 ring-transparent hover:ring-white/[0.05] shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20 uppercase tracking-tight">
                              {item.source}
                            </span>
                            {item.hasMatch && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-warning-400">
                                <Zap className="h-2.5 w-2.5 fill-warning-400/20" />
                                Target Match
                              </span>
                            )}
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-all duration-300 transform translate-x-1 group-hover/item:translate-x-0" />
                        </div>

                        <h4 className="text-[12px] font-bold leading-snug group-hover/item:text-primary-400 transition-colors duration-300 mb-2">
                          {item.title}
                        </h4>

                        {item.summary && (
                          <div className="relative">
                            <p className="text-[11px] text-muted-foreground/80 leading-relaxed border-l-[3px] border-primary-500/30 pl-3 py-1 italic font-medium">
                              {item.summary}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between opacity-50 group-hover/item:opacity-100 transition-opacity duration-300">
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(item.pubDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {item.entities && item.entities.length > 0 && (
                            <div className="flex -space-x-1">
                              {item.entities.slice(0, 2).map((entity, idx) => (
                                <div
                                  key={idx}
                                  className="h-4 px-1.5 flex items-center justify-center rounded-md bg-white/[0.05] ring-1 ring-white/[0.1] text-[8px] font-mono font-bold text-accent-400"
                                >
                                  {entity}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="absolute left-0 bottom-0 h-[2px] w-0 bg-primary-500 transition-all duration-500 group-hover/item:w-full" />
                      </motion.a>
                    ))}
                  </motion.div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-sidebar-bg to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
