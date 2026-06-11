import { type GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

// ─── Singleton Client ────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | undefined;

function resolveApiKey(): string {
  // Try process.env directly first (bun auto-loads .env from CWD),
  // then fall back to getEnv() which parses via zod.
  const key = process.env.GEMINI_API_KEY;
  if (key) return key;

  // Synchronous fallback: the env file should already be loaded by the time
  // the AI client is used, since the API entry point calls getEnv() early.
  try {
    // Use dynamic import pattern compatible with Bun's module system
    const { getEnv } = require('@argus/config') as typeof import('@argus/config');
    const env = getEnv();
    if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
  } catch {}

  throw new Error('GEMINI_API_KEY is required for AI features');
}

export function getGeminiClient(): GoogleGenerativeAI {
  if (_genAI) return _genAI;

  const apiKey = resolveApiKey();
  console.info(`[AI] Gemini client initialized (key: ${apiKey.substring(0, 8)}...)`);
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

// ─── Model Constants ─────────────────────────────────────────────

export const MODELS = {
  // Use gemini-1.5-flash as the fast reliable free-tier model
  FLASH: 'gemini-1.5-flash',
  // Use gemini-1.5-pro for advanced thinking tasks
  THINKING: 'gemini-1.5-pro',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ─── Get Model Instance ──────────────────────────────────────────

export function getModel(modelId: ModelId = MODELS.FLASH): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: modelId });
}
