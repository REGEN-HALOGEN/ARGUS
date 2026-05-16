'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
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
    <div className="mt-auto px-4 py-4 w-full">
      <div 
        className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Cybersecurity News</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 space-y-3"
          >
            {loading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : news.length > 0 ? (
              news.slice(0, 5).map((item, i) => (
                <a 
                  key={i} 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                    <span className="truncate pr-2">{item.source}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h4 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h4>
                </a>
              ))
            ) : (
              <div className="text-sm text-muted-foreground py-2 text-center">
                No recent news
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
