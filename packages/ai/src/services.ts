import { MODELS, getModel, getProvider } from './client';
import type { ModelId } from './client';
import { SYSTEM_PROMPTS } from './prompts';
import { getEnv } from '@argus/config';

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

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const provider = getProvider();
  const env = getEnv();

  if (provider === 'ollama') {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: options.systemPrompt ?? SYSTEM_PROMPTS.SECURITY_ANALYST },
          ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
        ],
        stream: false,
        options: {
          num_predict: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.3,
        }
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.message.content;
  }

  // Fallback to Gemini
  const model = getModel(options.model ?? MODELS.PRO);

  const chat = model.startChat({
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
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

// ─── Streaming Chat ──────────────────────────────────────────────

export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const provider = getProvider();
  const env = getEnv();

  if (provider === 'ollama') {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: options.systemPrompt ?? SYSTEM_PROMPTS.SECURITY_ANALYST },
          ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
        ],
        stream: true,
        options: {
          num_predict: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.3,
        }
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch (e) {
          console.warn('[AI] Failed to parse Ollama stream chunk', e);
        }
      }
    }
    return;
  }

  // Fallback to Gemini
  const model = getModel(options.model ?? MODELS.PRO);

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
  const response = await chat(
    [{ role: 'user', content: query }],
    {
      systemPrompt: SYSTEM_PROMPTS.NL_TO_CYPHER,
      model: MODELS.PRO,
      temperature: 0.1,
    },
  );

  const cypher = response.trim();

  // Safety validation
  if (cypher === 'UNSAFE_QUERY' || cypher.includes('UNSAFE')) {
    return { cypher: '', safe: false };
  }

  const upperCypher = cypher.toUpperCase();
  const hasBlockedKeyword = CYPHER_BLOCKLIST.some((keyword) =>
    upperCypher.includes(keyword),
  );

  if (hasBlockedKeyword) {
    return { cypher: '', safe: false };
  }

  return { cypher, safe: true };
}
