# 🧠 AI Analyst Enhancements — Implementation Guide

> **Priority:** High  
> **Estimated Effort:** 2–3 days  
> **Files:** `apps/web/src/app/(dashboard)/analyst/page.tsx`, `apps/api/src/routes/v1/ai.ts`, `packages/ai/src/services.ts`

---

## Overview

The AI Analyst page currently supports basic NL-to-Cypher conversion and streaming chat. This guide covers adding **reasoning traces**, **graph citations**, **conversation history**, **suggested follow-ups**, and **markdown rendering** to make it feel like a production-grade AI security copilot.

---

## Current State

| Component | Status |
|---|---|
| `apps/web/.../analyst/page.tsx` | ✅ Chat UI with streaming, suggested prompts |
| `apps/api/.../v1/ai.ts` | ✅ `/chat`, `/chat/stream`, `/nl-to-cypher`, `/threat-brief` |
| `packages/ai/src/services.ts` | ✅ `chat()`, `streamChat()`, `nlToCypher()` with Gemini |
| `packages/ai/src/prompts.ts` | ✅ System prompts for analyst, NL-to-Cypher, briefing |
| Reasoning trace (show Cypher + steps) | ⚠️ Partial — shows Cypher but no step breakdown |
| Citations linking to entities | ❌ Not implemented |
| Conversation history (multi-turn) | ❌ Each message is independent |
| Markdown rendering in responses | ❌ Raw text displayed |
| Follow-up suggestions | ❌ Not implemented |

---

## Implementation Steps

### Step 1: Install Markdown Renderer

The AI responses contain markdown formatting (headers, code blocks, lists) but the frontend renders them as plain text.

```bash
bun add react-markdown remark-gfm rehype-highlight
```

### Step 2: Create Markdown Message Component

```typescript
// apps/web/src/components/ai/message-bubble.tsx

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrainCircuit, User, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface Citation {
  type: 'cve' | 'asset' | 'threat_actor' | 'technique';
  id: string;
  label: string;
  href: string; // internal link to graph node
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  reasoning?: ReasoningTrace;
  timestamp?: string;
}

interface ReasoningTrace {
  query: string;
  cypher: string | null;
  safe: boolean;
  executionTime?: number;
  resultCount?: number;
}

export function MessageBubble({ role, content, citations, reasoning, timestamp }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[80%] ${role === 'user' ? '' : ''}`}>
        {/* Avatar + Name */}
        <div className={`flex items-center gap-2 mb-1.5 ${role === 'user' ? 'justify-end' : ''}`}>
          {role === 'assistant' && (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500/15">
              <BrainCircuit className="h-3.5 w-3.5 text-primary-400" />
            </div>
          )}
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            {role === 'user' ? 'You' : 'ARGUS'}
          </span>
          {timestamp && (
            <span className="text-[10px] text-slate-600">{timestamp}</span>
          )}
        </div>

        {/* Message Content */}
        <div
          className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
            role === 'user'
              ? 'bg-primary-500/15 text-primary-100 ring-1 ring-primary-500/20'
              : 'bg-white/[0.04] text-slate-200 ring-1 ring-white/[0.06]'
          }`}
        >
          {role === 'assistant' ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-slate-200 prose-headings:font-semibold
              prose-p:text-slate-300 prose-p:leading-relaxed
              prose-strong:text-slate-100
              prose-code:text-primary-300 prose-code:bg-primary-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-[#0b0f19] prose-pre:ring-1 prose-pre:ring-white/[0.06]
              prose-li:text-slate-300
              prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <span className="whitespace-pre-wrap">{content}</span>
          )}
        </div>

        {/* Reasoning Trace (collapsible) */}
        {reasoning && role === 'assistant' && (
          <div className="mt-2">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
            >
              <span className={`transition-transform ${showReasoning ? 'rotate-90' : ''}`}>▶</span>
              Reasoning Trace
            </button>

            {showReasoning && (
              <div className="mt-2 rounded-xl bg-[#0b0f19] p-3 ring-1 ring-white/[0.04] text-xs space-y-2">
                <div>
                  <span className="text-slate-500 font-medium">Query:</span>
                  <span className="text-slate-400 ml-2">{reasoning.query}</span>
                </div>
                {reasoning.cypher && (
                  <div>
                    <span className="text-slate-500 font-medium">Cypher:</span>
                    <pre className="mt-1 rounded-lg bg-white/[0.02] p-2 text-primary-300 overflow-x-auto">
                      {reasoning.cypher}
                    </pre>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <span className="text-slate-500">
                    Safe: <span className={reasoning.safe ? 'text-success-400' : 'text-threat-400'}>
                      {reasoning.safe ? '✓' : '✗'}
                    </span>
                  </span>
                  {reasoning.resultCount !== undefined && (
                    <span className="text-slate-500">
                      Results: <span className="text-slate-300">{reasoning.resultCount}</span>
                    </span>
                  )}
                  {reasoning.executionTime !== undefined && (
                    <span className="text-slate-500">
                      Time: <span className="text-slate-300">{reasoning.executionTime}ms</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {citations.map((cite) => (
              <a
                key={cite.id}
                href={cite.href}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-primary-300 ring-1 ring-white/[0.06] hover:bg-white/[0.08] transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {cite.label}
              </a>
            ))}
          </div>
        )}

        {/* Copy button */}
        {role === 'assistant' && content && (
          <button
            onClick={handleCopy}
            className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Enhanced AI Route with Reasoning Trace

Update `apps/api/src/routes/v1/ai.ts` to return structured metadata:

```typescript
// Modify the /nl-to-cypher endpoint to return timing and metadata

aiRoutes.post('/nl-to-cypher', zValidator('json', AIChatRequestSchema.pick({ message: true })), async (c) => {
  const { message } = c.req.valid('json');
  const startTime = Date.now();

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
          reasoning: { query: message, cypher: null, safe: false, executionTime: Date.now() - startTime },
        },
      });
    }

    // Execute the generated Cypher
    let results = null;
    let resultCount = 0;
    try {
      const records = await executeReadOnlyQuery(cypher);
      results = records.map((r) => r.toObject());
      resultCount = results.length;
    } catch { /* Query might fail if schema doesn't match */ }

    // Extract citations from results
    const citations = extractCitations(results);

    // Get AI interpretation
    let interpretation = '';
    if (results && results.length > 0) {
      try {
        interpretation = await chat(
          [{
            role: 'user',
            content: `The user asked: "${message}"\n\nThe Cypher query "${cypher}" returned ${resultCount} results:\n${JSON.stringify(results.slice(0, 10), null, 2)}\n\nPlease interpret these results in plain language for a security analyst. Reference specific CVEs, assets, and threat actors by name.`,
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
        results: results?.slice(0, 20),
        interpretation,
        citations,
        reasoning: {
          query: message,
          cypher,
          safe: true,
          executionTime: Date.now() - startTime,
          resultCount,
        },
      },
    });
  } catch (error) {
    // ... existing error handling
  }
});

// Helper: extract entity references for citation links
function extractCitations(results: any[] | null): Array<{
  type: string; id: string; label: string; href: string;
}> {
  if (!results) return [];
  const citations: Array<{ type: string; id: string; label: string; href: string }> = [];
  const seen = new Set<string>();

  for (const row of results) {
    for (const value of Object.values(row)) {
      const v = value as any;
      if (v?.labels && v?.properties) {
        const label = v.properties.hostname ?? v.properties.cveId ?? v.properties.name ?? '';
        if (label && !seen.has(label)) {
          seen.add(label);
          citations.push({
            type: v.labels[0]?.toLowerCase() ?? 'unknown',
            id: v.elementId ?? '',
            label,
            href: `/graph?focus=${v.elementId}`,
          });
        }
      }
    }
  }

  return citations.slice(0, 10);
}
```

### Step 4: Conversation History Support

Update the frontend to maintain a full conversation history and send it to the backend:

```typescript
// Modify the analyst page handleSend function

const handleSend = async (text: string = input) => {
  if (!text.trim() || isLoading) return;

  const userMessage: Message = { role: 'user', content: text };
  const assistantMessage: Message = { role: 'assistant', content: '', citations: [], reasoning: undefined };

  setInput('');
  setMessages((prev) => [...prev, userMessage, assistantMessage]);
  setIsLoading(true);

  try {
    // Send full conversation history for context
    const history = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      content: m.content,
    }));

    // Try NL-to-Cypher first
    const res = await fetch(`${API_BASE}/ai/nl-to-cypher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history }),
    });

    const data = await res.json();

    if (data.success && data.data.interpretation) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1]!;
        last.content = data.data.interpretation;
        last.citations = data.data.citations;
        last.reasoning = data.data.reasoning;
        return updated;
      });
    } else {
      // Fallback to streaming chat with full history
      const streamRes = await fetch(`${API_BASE}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      // ... existing streaming logic
    }
  } catch (error) {
    // ... existing error handling
  } finally {
    setIsLoading(false);
  }
};
```

### Step 5: Follow-Up Suggestions

After each AI response, generate 2–3 contextual follow-up questions:

```typescript
// packages/ai/src/services.ts — add this function

export async function generateFollowUps(
  userQuery: string,
  aiResponse: string,
): Promise<string[]> {
  try {
    const response = await chat(
      [{
        role: 'user',
        content: `Given this security analysis conversation:
User asked: "${userQuery}"
AI responded: "${aiResponse.substring(0, 500)}"

Generate exactly 3 concise follow-up questions the user might want to ask next.
Return them as a JSON array of strings, nothing else.
Example: ["What is the blast radius?", "Show related CVEs", "Which assets are affected?"]`,
      }],
      {
        systemPrompt: 'You generate follow-up questions for security analysts. Return only a JSON array.',
        temperature: 0.5,
        maxTokens: 200,
      },
    );

    return JSON.parse(response);
  } catch {
    return [];
  }
}
```

### Step 6: Updated Message Interface

```typescript
// Update the Message interface in analyst/page.tsx

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    type: string;
    id: string;
    label: string;
    href: string;
  }>;
  reasoning?: {
    query: string;
    cypher: string | null;
    safe: boolean;
    executionTime?: number;
    resultCount?: number;
  };
  followUps?: string[];
  timestamp?: string;
}
```

---

## Backend Changes Summary

| Endpoint | Change |
|---|---|
| `POST /ai/nl-to-cypher` | Add `reasoning` and `citations` to response |
| `POST /ai/chat` | Accept `history` array for multi-turn context |
| `POST /ai/chat/stream` | Accept `history` array for multi-turn context |
| `POST /ai/follow-ups` (new) | Generate follow-up questions |

---

## Rollout Checklist

- [ ] Install `react-markdown`, `remark-gfm`, `rehype-highlight`
- [ ] Create `MessageBubble` component with markdown rendering
- [ ] Add reasoning trace (collapsible) to AI responses
- [ ] Extract entity citations from Cypher results
- [ ] Add citation links that navigate to Graph Explorer with focused node
- [ ] Implement multi-turn conversation history
- [ ] Add follow-up suggestion generation
- [ ] Add copy-to-clipboard for AI responses
- [ ] Add loading skeleton animation while AI is processing
- [ ] Style code blocks in AI responses with syntax highlighting
- [ ] Add keyboard shortcut `/` to focus the input field
- [ ] Test with complex multi-hop security queries
