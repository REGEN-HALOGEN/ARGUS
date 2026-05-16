import Parser from 'rss-parser';

const parser = new Parser();

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
  summary?: string;
  entities?: string[];
  hasMatch?: boolean;
}

const FEEDS = [
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
];

export async function fetchTopNews(limit = 10): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      parsed.items.forEach((item) => {
        if (item.title && item.link) {
          allNews.push({
            title: item.title,
            link: item.link,
            pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
            contentSnippet: item.contentSnippet?.slice(0, 150), // brief snippet
            source: feed.name,
          });
        }
      });
    } catch (e) {
      console.error(`Failed to fetch RSS from ${feed.name}:`, e);
    }
  }

  // Sort by latest date descending
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return allNews.slice(0, limit);
}
