// ─── Api Key Resolution ────────────────────────────────────────────

export function resolveApiKey(): string {
  // Try process.env directly first (bun auto-loads .env from CWD)
  const key = process.env.GEMINI_API_KEY;
  if (key) return key;

  try {
    const { getEnv } = require('@argus/config') as typeof import('@argus/config');
    const env = getEnv();
    if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
  } catch {}

  throw new Error('GEMINI_API_KEY is required for AI features');
}

export function resolveBaseUrl(): string {
  const key = resolveApiKey();
  if (key.startsWith('AIzaSy')) {
    return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  }
  return 'https://openrouter.ai/api/v1/chat/completions';
}

export function resolveModelId(modelId: string): string {
  const key = resolveApiKey();
  const isGoogle = key.startsWith('AIzaSy');

  if (modelId === 'gemini-2.5-flash' || modelId === 'openrouter/free') {
    return isGoogle ? 'gemini-2.5-flash' : 'google/gemini-2.5-flash';
  }
  if (modelId === 'gemini-2.5-pro') {
    return isGoogle ? 'gemini-2.5-pro' : 'google/gemini-2.5-pro';
  }
  return modelId;
}

// ─── Model Constants ─────────────────────────────────────────────

export const MODELS = {
  FLASH: 'gemini-2.5-flash',
  THINKING: 'gemini-2.5-pro',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS] | 'openrouter/free';
