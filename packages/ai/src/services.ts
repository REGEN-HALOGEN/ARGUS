import { MODELS, getModel } from './client';
import type { ModelId } from './client';
import { SYSTEM_PROMPTS } from './prompts';

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
  const primaryModelId = options.model ?? MODELS.PRO;
  const fallbacks: ModelId[] = ['gemini-2.5-flash', 'gemini-pro-latest'] as any;
  const modelsToTry = [primaryModelId, ...fallbacks];

  let lastError: any;
  for (const modelId of modelsToTry) {
    try {
      const model = getModel(modelId);
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
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error.message?.includes('429') || error.message?.includes('quota');
      const isNotFoundError = error.message?.includes('404') || error.message?.includes('not found');
      
      if (isQuotaError || isNotFoundError) {
        console.warn(`[AI-FALLBACK] Model ${modelId} failed (${isQuotaError ? '429' : '404'}). Trying next...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ─── Streaming Chat ──────────────────────────────────────────────

export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const primaryModelId = options.model ?? MODELS.PRO;
  const fallbacks: ModelId[] = ['gemini-2.5-flash', 'gemini-pro-latest'] as any;
  const modelsToTry = [primaryModelId, ...fallbacks];

  let lastError: any;
  for (const modelId of modelsToTry) {
    try {
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
      return; // Success
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error.message?.includes('429') || error.message?.includes('quota');
      const isNotFoundError = error.message?.includes('404') || error.message?.includes('not found');
      
      if (isQuotaError || isNotFoundError) {
        console.warn(`[AI-FALLBACK] Streaming model ${modelId} failed (${isQuotaError ? '429' : '404'}). Trying next...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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
  if (cypher === 'UNSAFE_QUERY') {
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
