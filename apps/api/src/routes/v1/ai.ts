import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AIChatRequestSchema } from '@argus/types';
import { stream } from 'hono/streaming';
import { chat, streamChat, nlToCypher, SYSTEM_PROMPTS, buildPrompt, USER_PROMPTS } from '@argus/ai';
import { withCache } from '@argus/cache';
import { executeReadOnlyQuery } from '@argus/graph';

export const aiRoutes = new Hono();

// ─── Chat ────────────────────────────────────────────────────────

aiRoutes.post('/chat', zValidator('json', AIChatRequestSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const response = await chat(
      [{ role: 'user', content: body.message }],
      { systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST },
    );

    return c.json({
      success: true,
      data: {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI chat failed';
    return c.json({
      success: true,
      data: {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: `I apologize, but I encountered an issue: ${message}. Please ensure your Gemini API key is configured correctly.`,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ─── Streaming Chat ──────────────────────────────────────────────

aiRoutes.post('/chat/stream', zValidator('json', AIChatRequestSchema), async (c) => {
  const body = c.req.valid('json');

  return stream(c, async (s) => {
    try {
      const gen = streamChat(
        [{ role: 'user', content: body.message }],
        { systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST },
      );

      for await (const chunk of gen) {
        await s.write(chunk);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Streaming failed';
      await s.write(`\n\n[Error: ${message}]`);
    }
  });
});

// ─── NL to Cypher ────────────────────────────────────────────────

aiRoutes.post(
  '/nl-to-cypher',
  zValidator(
    'json',
    AIChatRequestSchema.pick({ message: true }),
  ),
  async (c) => {
    const { message } = c.req.valid('json');

    try {
      const { cypher, safe } = await nlToCypher(message);

      if (!safe || !cypher) {
        return c.json({
          success: true,
          data: {
            query: message,
            cypher: null,
            safe: false,
            message: 'Could not generate a safe query for this request.',
            results: null,
          },
        });
      }

      // Execute the generated Cypher
      let results = null;
      try {
        const records = await executeReadOnlyQuery(cypher);
        results = records.map((r) => r.toObject());
      } catch {
        // Query might fail if schema doesn't match
      }

      // Get AI interpretation of the results
      let interpretation = '';
      if (results && results.length > 0) {
        try {
          interpretation = await chat(
            [{
              role: 'user',
              content: `The user asked: "${message}"\n\nThe Cypher query "${cypher}" returned these results:\n${JSON.stringify(results, null, 2)}\n\nPlease interpret these results in plain language for a security analyst.`,
            }],
            { systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST },
          );
        } catch {
          interpretation = 'Could not generate interpretation.';
        }
      }

      return c.json({
        success: true,
        data: {
          query: message,
          cypher,
          safe: true,
          results,
          interpretation,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'NL-to-Cypher failed';
      return c.json({
        success: true,
        data: {
          query: message,
          cypher: null,
          safe: false,
          message: msg,
          results: null,
        },
      });
    }
  },
);

// ─── Threat Brief ────────────────────────────────────────────────

aiRoutes.get('/threat-brief', async (c) => {
  try {
    const data = await withCache('ai:threat-brief', 3600, async () => {
      // Gather data from Neo4j
      const [cveResult, actorResult, assetResult] = await Promise.all([
        executeReadOnlyQuery(
          'MATCH (c:CVE) RETURN c.cveId AS cveId, c.severity AS severity, c.cvss AS cvss, c.exploitedInWild AS exploited ORDER BY c.cvss DESC LIMIT 10',
        ),
        executeReadOnlyQuery(
          'MATCH (t:ThreatActor) RETURN t.name AS name, t.country AS country, t.sophistication AS sophistication',
        ),
        executeReadOnlyQuery(
          "MATCH (a:Asset) WHERE a.criticality IN ['critical', 'high'] RETURN a.hostname AS hostname, a.criticality AS criticality, a.internetFacing AS internetFacing",
        ),
      ]);

      const cves = cveResult.map((r) => r.toObject());
      const actors = actorResult.map((r) => r.toObject());
      const assets = assetResult.map((r) => r.toObject());

      const prompt = buildPrompt(USER_PROMPTS.GENERATE_THREAT_BRIEF, {
        period: 'Current',
        newCves: JSON.stringify(cves),
        activeThreats: JSON.stringify(actors),
        affectedAssets: JSON.stringify(assets),
        riskChanges: 'N/A - initial assessment',
      });

      const briefContent = await chat(
        [{ role: 'user', content: prompt }],
        { systemPrompt: SYSTEM_PROMPTS.THREAT_BRIEFING },
      );

      return {
        id: crypto.randomUUID(),
        title: 'Security Threat Briefing',
        summary: briefContent,
        severity: cves.some((cv) => cv.exploited) ? 'critical' : 'high',
        affectedAssets: assets.length,
        relatedCVEs: cves.map((cv) => cv.cveId as string),
        recommendations: [],
        generatedAt: new Date().toISOString(),
      };
    });

    return c.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Threat brief generation failed';
    return c.json({
      success: true,
      data: {
        id: crypto.randomUUID(),
        title: 'Security Threat Briefing',
        summary: `Unable to generate threat briefing: ${msg}`,
        severity: 'medium',
        affectedAssets: 0,
        relatedCVEs: [],
        recommendations: [],
        generatedAt: new Date().toISOString(),
      },
    });
  }
});
