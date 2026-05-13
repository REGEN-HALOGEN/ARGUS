const CISA_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export interface CISAKEVEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: 'Known' | 'Unknown';
}

export async function fetchCISAKEV(): Promise<CISAKEVEntry[]> {
  const res = await fetch(CISA_KEV_URL);
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`);

  const data = await res.json();
  return data.vulnerabilities ?? [];
}

// Returns a Set of CVE IDs known to be exploited
export async function getExploitedCVEIds(): Promise<Set<string>> {
  const entries = await fetchCISAKEV();
  return new Set(entries.map((e) => e.cveID));
}
