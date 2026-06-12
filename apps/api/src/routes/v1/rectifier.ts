import { getNeo4jDriver } from '@argus/graph';
import { chat, SYSTEM_PROMPTS } from '@argus/ai';
import { Hono } from 'hono';

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

export const rectifierRoutes = new Hono<TenantEnv>();

// ─── List Crown Jewel Databases & Vulnerabilities ────────────────
rectifierRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `MATCH (a:Asset)
       WHERE (a.type = 'database' OR a.type = 'Database') AND (a.tenantId = $tenantId OR a.tenantId IS NULL)
       OPTIONAL MATCH (a)-[r:HAS_VULNERABILITY]->(cv:CVE)
       RETURN a, collect(cv) AS vulnerabilities`,
      { tenantId }
    );
    console.log(`[RECTIFIER] tenantId: ${tenantId}, records: ${result.records.length}`);

    const data = result.records.map((r) => {
      const asset = r.get('a').properties;
      const vulns = r.get('vulnerabilities')
        .map((node: any) => node ? node.properties : null)
        .filter((v: any) => v && v.cveId);

      return {
        ...asset,
        vulnerabilities: vulns,
      };
    });

    return c.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  } finally {
    await session.close();
  }
});

// ─── Mark Safe / Resolved ─────────────────────────────────────────
rectifierRoutes.post('/resolve', async (c) => {
  const tenantId = c.get('tenantId');
  const { assetId } = await c.req.json();

  if (!assetId) {
    return c.json({ success: false, error: { message: 'assetId is required' } }, 400);
  }

  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MATCH (a:Asset {id: $assetId, tenantId: $tenantId})
       OPTIONAL MATCH (a)-[r:HAS_VULNERABILITY]->(cv:CVE)
       DELETE r
       SET a.safe = true`,
      { assetId, tenantId }
    );

    return c.json({
      success: true,
      message: 'Asset marked as safe and vulnerabilities resolved.',
    });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  } finally {
    await session.close();
  }
});

// ─── AI Analysis for Mitigation ──────────────────────────────────
rectifierRoutes.post('/analyze', async (c) => {
  const { cveId, assetName } = await c.req.json();

  if (!cveId || !assetName) {
    return c.json({ success: false, error: { message: 'cveId and assetName are required' } }, 400);
  }

  try {
    const prompt = `Provide a short, direct and highly actionable remediation plan to secure the database asset "${assetName}" which is affected by vulnerability "${cveId}". The plan should include specific technical steps to fix/mitigate the problem, patching details, and configuration best practices. Please use clean markdown structure.`;
    
    // Add a 60-second timeout to prevent the UI from hanging on rate limit retries,
    // allowing sufficient time for queuing and exponential retry backoffs.
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('Rate limit timeout: Gemini API is overloaded (429)')), 60000)
    );

    const response = await Promise.race([
      chat([{ role: 'user', content: prompt }], { systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST }),
      timeoutPromise
    ]);

    return c.json({
      success: true,
      data: { solution: response },
    });
  } catch (error: any) {
    const isRateLimit = error.message?.includes('429') || error.message?.includes('timeout');
    const fallbackSolution = isRateLimit 
      ? `### ⚠️ AI Analysis Rate Limited\n\nThe Gemini API is currently experiencing high traffic or has hit its free-tier rate limit (429).\n\n**General Remediation for ${cveId}:**\n1. Check the official vendor patch release.\n2. Update the affected package to the latest version.\n3. Temporarily restrict network access to the affected service.`
      : `AI analysis failed: ${error.message}. Please verify your Gemini API key is configured correctly.`;

    return c.json({
      success: true, // Return as success so the UI displays the fallback markdown gracefully
      data: { solution: fallbackSolution },
    });
  }
});
