import { MODELS, resolveApiKey } from './client';
import type { ModelId } from './client';
import { SYSTEM_PROMPTS } from './prompts';

// ─── Global Rate Limiter ─────────────────────────────────────────
// Ensures we never exceed Gemini free-tier limits (15 RPM for flash).
// All Gemini calls go through this gate — queued, not rejected.

const RATE_LIMIT_RPM = 10; // stay under the 15 RPM free-tier ceiling
const RATE_WINDOW_MS = 60_000;

const _requestTimestamps: number[] = [];
let _requestQueue: Array<{ resolve: () => void }> = [];
let _draining = false;

async function drainQueue() {
  if (_draining) return;
  _draining = true;
  while (_requestQueue.length > 0) {
    const now = Date.now();
    // Purge timestamps older than the window
    while (_requestTimestamps.length > 0 && _requestTimestamps[0]! < now - RATE_WINDOW_MS) {
      _requestTimestamps.shift();
    }
    if (_requestTimestamps.length < RATE_LIMIT_RPM) {
      // Slot available — release the next queued request
      const next = _requestQueue.shift();
      if (next) {
        _requestTimestamps.push(Date.now());
        next.resolve();
      }
    } else {
      // Wait until the oldest timestamp expires
      const waitMs = _requestTimestamps[0]! + RATE_WINDOW_MS - now + 100;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  _draining = false;
}

async function acquireSlot(): Promise<void> {
  const now = Date.now();
  // Purge old timestamps
  while (_requestTimestamps.length > 0 && _requestTimestamps[0]! < now - RATE_WINDOW_MS) {
    _requestTimestamps.shift();
  }
  if (_requestTimestamps.length < RATE_LIMIT_RPM) {
    _requestTimestamps.push(Date.now());
    return; // immediate
  }
  // Queue up
  return new Promise<void>((resolve) => {
    _requestQueue.push({ resolve });
    drainQueue();
  });
}

// ─── In-Flight Deduplication ─────────────────────────────────────
// If two components request the same thing simultaneously, only one
// Gemini call is made. The second caller piggybacks on the first.

const _inflight = new Map<string, Promise<string>>();

function deduplicationKey(messages: ChatMessage[], options: ChatOptions): string {
  const last = messages[messages.length - 1]?.content ?? '';
  return `${options.systemPrompt?.slice(0, 40) ?? 'default'}::${last.slice(0, 120)}`;
}

// ─── Rate Limit Retry Helper ────────────────────────────────────

const MAX_RETRIES = 2;

async function withRetry<T>(fn: () => Promise<T>, label = 'AI'): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const is429 = error?.message?.includes('429') || error?.status === 429;
      if (!is429 || attempt === MAX_RETRIES) throw error;

      // Extract retry delay from error message, default to exponential backoff
      const retryMatch = error.message?.match(/retry in ([\d.]+)s/i);
      const delaySec = retryMatch ? parseFloat(retryMatch[1]) : Math.pow(2, attempt + 1) * 5;
      const delayMs = Math.min(delaySec * 1000, 30000); // Cap at 30s

      console.warn(`[${label}] Rate limited (429). Retrying in ${delaySec.toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}

// ─── Chat Completion ─────────────────────────────────────────────

export interface ChatOptions {
  systemPrompt?: string;
  model?: ModelId;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  // Deduplicate concurrent identical requests
  const dedupKey = deduplicationKey(messages, options);
  const existing = _inflight.get(dedupKey);
  if (existing) {
    console.info('[AI] Deduplicating concurrent request');
    return existing;
  }

  const promise = _chatInternal(messages, options);
  _inflight.set(dedupKey, promise);

  try {
    return await promise;
  } finally {
    _inflight.delete(dedupKey);
  }
}

async function _chatInternal(messages: ChatMessage[], options: ChatOptions): Promise<string> {
  const modelId = options.model ?? MODELS.FLASH;

  await acquireSlot();

  const mappedMessages = messages.map((msg) => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const payload = {
    model: modelId,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...mappedMessages,
    ],
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.3,
  };

  const result = await withRetry(async () => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resolveApiKey()}`,
        'HTTP-Referer': 'https://argus-local.com', // Optional for openrouter rankings
        'X-Title': 'ARGUS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || response.statusText;
      const err = new Error(errMsg);
      (err as any).status = response.status;
      throw err;
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Unknown API error');
    }
    return data.choices?.[0]?.message?.content || '';
  }, 'Chat');

  return result;
}

// ─── Streaming Chat ──────────────────────────────────────────────

export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const modelId = options.model ?? MODELS.FLASH;

  await acquireSlot();

  const mappedMessages = messages.map((msg) => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const payload = {
    model: modelId,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...mappedMessages,
    ],
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.3,
    stream: true,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resolveApiKey()}`,
      'HTTP-Referer': 'https://argus-local.com',
      'X-Title': 'ARGUS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || response.statusText);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No stream available');
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
      if (line === 'data: [DONE]') return;
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) {
            console.error('Stream error payload:', data.error);
            break;
          }
          const content = data.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch (e) {
          // ignore invalid json from stream chunk boundaries
        }
      }
    }
  }
}

// ─── NL to Cypher ────────────────────────────────────────────────

const CYPHER_BLOCKLIST = [
  'CREATE',
  'DELETE',
  'SET',
  'MERGE',
  'REMOVE',
  'DETACH',
  'DROP',
  'CALL',
  'LOAD',
  'FOREACH',
];

export async function nlToCypher(query: string): Promise<{ cypher: string; safe: boolean }> {
  const response = await chat([{ role: 'user', content: query }], {
    systemPrompt: SYSTEM_PROMPTS.NL_TO_CYPHER,
    model: MODELS.FLASH,
    temperature: 0.1,
    maxTokens: 200,
  });

  let cypher = response.trim();

  // 1. Try to extract from <tool_call> tags if the model hallucinated them
  const toolCallMatch = cypher.match(/<tool_call>\s*cypher\s*([\s\S]*?)(?:<\/tool_call>|<tool_call>|$)/i);
  if (toolCallMatch && toolCallMatch[1]) {
    cypher = toolCallMatch[1].trim();
  } else {
    // 2. Try to extract from markdown code blocks
    const mdMatch = cypher.match(/```[a-zA-Z]*\n([\s\S]*?)```/i);
    if (mdMatch && mdMatch[1]) {
      cypher = mdMatch[1].trim();
    }
  }

  // 3. Fallback cleanup just in case
  cypher = cypher.replace(/<tool_call>[\s\S]*?\n/gi, '').replace(/<\/tool_call>/gi, '').trim();
  cypher = cypher.replace(/^```[a-zA-Z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  // Safety validation
  if (cypher === 'UNSAFE_QUERY') {
    return { cypher: '', safe: false };
  }

  const upperCypher = cypher.toUpperCase();
  const hasBlockedKeyword = CYPHER_BLOCKLIST.some((keyword) => upperCypher.includes(keyword));

  if (hasBlockedKeyword) {
    return { cypher: '', safe: false };
  }

  return { cypher, safe: true };
}
