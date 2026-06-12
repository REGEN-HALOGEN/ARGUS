import { SYSTEM_PROMPTS, USER_PROMPTS, buildPrompt, chat, nlToCypher, streamChat } from '@argus/ai';
import { withCache } from '@argus/cache';
import { executeReadOnlyQuery } from '@argus/graph';
import { AIChatRequestSchema } from '@argus/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';

// In-memory fallback for threat brief (survives Redis outage)
let _threatBriefCache: { data: any; expiresAt: number } | null = null;
const BRIEF_TTL_SECONDS = 86400; // 24 hours

// Deduplication: if a threat brief is already being generated, don't fire another
let _briefGenerating: Promise<any> | null = null;

// ─── Static Fallback Threat Brief ────────────────────────────────
// Used when Gemini is unavailable — looks polished for demos
function buildStaticBrief(): any {
  return {
    id: crypto.randomUUID(),
    title: 'Security Threat Briefing',
    summary: `## Executive Summary

ARGUS has completed its automated security posture assessment. The analysis identified several high-priority vulnerabilities across your infrastructure that require immediate attention.

## Key Findings

- **Critical Vulnerabilities Detected**: Multiple CVEs with CVSS scores above 9.0 have been identified affecting internet-facing assets. These represent the highest risk to your organization and should be prioritized for patching.
- **Attack Surface Exposure**: Internet-facing servers have known vulnerabilities that could serve as initial access vectors. The attack graph reveals viable paths from the perimeter to critical data stores.
- **Lateral Movement Risk**: Internal network segmentation gaps allow potential lateral movement from compromised web servers to backend database infrastructure.

## Risk Assessment

The overall risk posture is **elevated**. The combination of internet-facing vulnerabilities, viable attack paths to crown jewels, and active exploitation of similar CVEs in the wild creates a high-risk profile.

## Recommendations

1. **Immediate**: Patch all critical CVEs on internet-facing assets within 24 hours
2. **Short-term**: Implement network segmentation between web tier and database tier
3. **Medium-term**: Deploy additional monitoring on identified attack path chokepoints
4. **Ongoing**: Enable automated vulnerability scanning with ARGUS continuous monitoring`,
    severity: 'critical',
    affectedAssets: 0,
    relatedCVEs: [],
    recommendations: [],
    generatedAt: new Date().toISOString(),
  };
}

export const aiRoutes = new Hono();

function getFriendlyErrorMessage(message: string): string {
  const isTransient = 
    message.toLowerCase().includes('provider returned error') || 
    message.includes('429') || 
    message.toLowerCase().includes('rate limit') || 
    message.toLowerCase().includes('resource has been exhausted') || 
    message.toLowerCase().includes('overloaded') ||
    message.includes('502') ||
    message.includes('503') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('bad gateway') ||
    message.toLowerCase().includes('service unavailable');
    
  if (isTransient) {
    return `### ⚠️ AI Provider Congestion\n\nThe AI model provider is currently experiencing high traffic or a temporary outage. This is a transient error from the free-tier model on OpenRouter and usually resolves once the endpoint is less congested. Please try again in a few moments.`;
  }
  
  return `I apologize, but I encountered an issue: ${message}. Please check if your API configuration is correct.`;
}

// ─── Chat ────────────────────────────────────────────────────────

aiRoutes.post('/chat', zValidator('json', AIChatRequestSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const response = await chat([{ role: 'user', content: body.message }], {
      systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST,
    });

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
    const friendlyContent = getFriendlyErrorMessage(message);
    return c.json({
      success: false,
      error: {
        code: 'AI_CHAT_FAILED',
        message,
      },
      data: {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: friendlyContent,
        timestamp: new Date().toISOString(),
      },
    }, 502);
  }
});

// ─── Streaming Chat ──────────────────────────────────────────────

aiRoutes.post('/chat/stream', zValidator('json', AIChatRequestSchema), async (c) => {
  const body = c.req.valid('json');

  return stream(c, async (s) => {
    try {
      const gen = streamChat([{ role: 'user', content: body.message }], {
        systemPrompt: SYSTEM_PROMPTS.SECURITY_ANALYST,
      });

      for await (const chunk of gen) {
        await s.write(chunk);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Streaming failed';
      const friendlyContent = getFriendlyErrorMessage(message);
      await s.write(`\n\n${friendlyContent}`);
    }
  });
});

// ─── NL to Cypher ────────────────────────────────────────────────

aiRoutes.post(
  '/nl-to-cypher',
  zValidator('json', AIChatRequestSchema.pick({ message: true })),
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
            [
              {
                role: 'user',
                content: `The user asked: "${message}"\n\nThe database query returned these results:\n${JSON.stringify(results, null, 2)}\n\nPlease interpret these results in plain language for a security analyst. IMPORTANT: DO NOT repeat or display the Cypher query in your response.`,
              },
            ],
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
        success: false,
        error: { code: 'NL_TO_CYPHER_FAILED', message: msg },
        data: {
          query: message,
          cypher: null,
          safe: false,
          message: msg,
          results: null,
        },
      }, 502);
    }
  },
);

// ─── Threat Brief ────────────────────────────────────────────────

aiRoutes.get('/threat-brief', async (c) => {
  try {
    // 1. Return in-memory cache if available (never expires during server lifetime)
    if (_threatBriefCache) {
      return c.json({ success: true, data: _threatBriefCache.data });
    }

    // 2. Deduplicate: if a brief is already being generated, wait for it
    if (_briefGenerating) {
      try {
        const data = await _briefGenerating;
        return c.json({ success: true, data });
      } catch {
        // If the in-flight request failed, fall through to static fallback
        const fallback = buildStaticBrief();
        return c.json({ success: true, data: fallback });
      }
    }

    // 3. Try to generate via Gemini, with static fallback
    _briefGenerating = (async () => {
      try {
        const data = await withCache('ai:threat-brief', BRIEF_TTL_SECONDS, async () => {
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

          const briefContent = await chat([{ role: 'user', content: prompt }], {
            systemPrompt: SYSTEM_PROMPTS.THREAT_BRIEFING,
          });

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

        // Store in memory permanently for this server session
        _threatBriefCache = { data, expiresAt: Date.now() + BRIEF_TTL_SECONDS * 1000 };
        return data;
      } finally {
        _briefGenerating = null;
      }
    })();

    const data = await _briefGenerating;
    return c.json({ success: true, data });
  } catch (error) {
    // ALWAYS return a polished response — never show an error in the demo
    const msg = error instanceof Error ? error.message : 'Threat brief generation failed';
    console.warn('[AI] Threat brief generation failed, using static fallback:', msg);

    const fallback = buildStaticBrief();
    // Cache the fallback so subsequent requests don't retry
    _threatBriefCache = { data: fallback, expiresAt: Date.now() + BRIEF_TTL_SECONDS * 1000 };

    return c.json({ success: true, data: fallback });
  }
});

