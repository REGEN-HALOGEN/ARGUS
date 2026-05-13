import { getEnv } from '@argus/config';

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

export interface NVDResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: NVDVulnerability[];
}

export interface NVDVulnerability {
  cve: {
    id: string;
    descriptions: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: {
        cvssData: { baseScore: number; baseSeverity: string };
      }[];
    };
    published: string;
    lastModified: string;
  };
}

export async function fetchNVDCVEs(options: {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  startIndex?: number;
  resultsPerPage?: number;
}): Promise<NVDResponse> {
  const env = getEnv();
  const params = new URLSearchParams();

  if (options.startDate) params.set('pubStartDate', options.startDate);
  if (options.endDate) params.set('pubEndDate', options.endDate);
  if (options.keyword) params.set('keywordSearch', options.keyword);
  params.set('startIndex', String(options.startIndex ?? 0));
  params.set('resultsPerPage', String(options.resultsPerPage ?? 50));

  const headers: Record<string, string> = {};
  if (env.NVD_API_KEY) {
    headers['apiKey'] = env.NVD_API_KEY;
  }

  const res = await fetch(`${NVD_BASE}?${params}`, { headers });

  if (!res.ok) {
    throw new Error(`NVD API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Paginated fetch — handles the NVD 2000-result limit
export async function fetchAllNVDCVEs(options: {
  startDate: string;
  endDate: string;
}): Promise<NVDVulnerability[]> {
  const all: NVDVulnerability[] = [];
  let startIndex = 0;
  const pageSize = 100;

  while (true) {
    const res = await fetchNVDCVEs({
      startDate: options.startDate,
      endDate: options.endDate,
      startIndex,
      resultsPerPage: pageSize,
    });

    all.push(...res.vulnerabilities);

    if (startIndex + pageSize >= res.totalResults) break;
    startIndex += pageSize;

    // Respect rate limits: ~6s between requests without API key
    await new Promise((r) => setTimeout(r, 6000));
  }

  return all;
}
