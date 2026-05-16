const MITRE_ATTACK_URL =
  'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

export interface STIXAttackPattern {
  type: 'attack-pattern';
  id: string;
  name: string;
  description: string;
  external_references: { source_name: string; external_id: string; url?: string }[];
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
}

export async function fetchMITRETechniques(): Promise<STIXAttackPattern[]> {
  const res = await fetch(MITRE_ATTACK_URL);
  if (!res.ok) throw new Error(`MITRE fetch failed: ${res.status}`);

  const bundle = await res.json();
  return bundle.objects.filter(
    (obj: any) => obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated,
  );
}

// Extracts the MITRE ID (e.g., "T1190") from external references
export function extractMitreId(technique: STIXAttackPattern): string | null {
  const ref = technique.external_references?.find((r) => r.source_name === 'mitre-attack');
  return ref?.external_id ?? null;
}

// Extracts the primary tactic from kill chain phases
export function extractTactic(technique: STIXAttackPattern): string {
  const phase = technique.kill_chain_phases?.find((p) => p.kill_chain_name === 'mitre-attack');
  return phase?.phase_name ?? 'unknown';
}
