import { MODELS, getModel } from './client';
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

  // Wait for a rate-limit slot before calling Gemini
  await acquireSlot();

  const model = getModel(modelId);
  const chatSession = model.startChat({
    history: messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    systemInstruction: {
      role: 'user',
      parts: [{ text: options.systemPrompt ?? SYSTEM_PROMPTS.SECURITY_ANALYST }],
    },
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
    },
  });

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return '';
  const result = await withRetry(
    () => chatSession.sendMessage(lastMessage.content),
    'Chat',
  );
  return result.response.text();
}

// ─── Streaming Chat ──────────────────────────────────────────────

export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const modelId = options.model ?? MODELS.FLASH;

  // Wait for a rate-limit slot before calling Gemini
  await acquireSlot();

  const model = getModel(modelId);
  const chatSession = model.startChat({
    history: messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    systemInstruction: {
      role: 'user',
      parts: [{ text: options.systemPrompt ?? SYSTEM_PROMPTS.SECURITY_ANALYST }],
    },
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
    },
  });

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return;
  const result = await chatSession.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
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
  });

  const cypher = response.trim();

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
