import { getNeo4jDriver } from '@argus/graph';

// Use MERGE instead of CREATE to prevent duplicates
export async function upsertCVE(cve: {
  cveId: string;
  severity: string;
  cvss: number;
  exploitedInWild: boolean;
  description: string;
  publishedDate: string;
}) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MERGE (c:CVE {cveId: $cveId})
       SET c.severity = $severity,
           c.cvss = $cvss,
           c.exploitedInWild = $exploitedInWild,
           c.description = $description,
           c.publishedDate = $publishedDate,
           c.updatedAt = datetime()`,
      cve,
    );
  } finally {
    await session.close();
  }
}

export async function upsertTechnique(technique: {
  mitreId: string;
  name: string;
  tactic: string;
  description?: string;
}) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MERGE (t:AttackTechnique {mitreId: $mitreId})
       SET t.name = $name,
           t.tactic = $tactic,
           t.description = $description,
           t.updatedAt = datetime()`,
      technique,
    );
  } finally {
    await session.close();
  }
}

// Batch operations for performance
export async function batchUpsertCVEs(cves: any[]) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `UNWIND $cves AS cve
       MERGE (c:CVE {cveId: cve.cveId})
       SET c += cve, c.updatedAt = datetime()`,
      { cves },
    );
  } finally {
    await session.close();
  }
}

// Mark CVEs as exploited from CISA KEV
export async function markExploitedCVEs(cveIds: string[]) {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `UNWIND $cveIds AS id
       MATCH (c:CVE {cveId: id})
       SET c.exploitedInWild = true`,
      { cveIds },
    );
  } finally {
    await session.close();
  }
}

export async function checkEntityPresence(entities: string[]): Promise<string[]> {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `UNWIND $entities AS entity
       MATCH (n) 
       WHERE (n:CVE AND n.cveId = entity) 
          OR (n:ThreatActor AND n.name = entity) 
          OR (n:AttackTechnique AND n.mitreId = entity)
       RETURN DISTINCT entity`,
      { entities },
    );
    return result.records.map((r) => r.get('entity'));
  } finally {
    await session.close();
  }
}
