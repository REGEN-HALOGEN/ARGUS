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

// ─── Model Constants ─────────────────────────────────────────────

export const MODELS = {
  // OpenRouter free models
  FLASH: 'qwen/qwen3-next-80b-a3b-instruct:free',
  THINKING: 'nvidia/nemotron-3-ultra-550b-a55b:free',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
