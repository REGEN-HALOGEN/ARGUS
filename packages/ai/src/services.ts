import { MODELS, getModel } from './client';
import { SYSTEM_PROMPTS } from './prompts';

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
  const modelId = options.model ?? MODELS.FLASH;

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
