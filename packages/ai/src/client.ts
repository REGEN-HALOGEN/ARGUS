import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

// ─── Singleton Client ────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | undefined;

function resolveApiKey(): string {
  // Try process.env directly first (bun auto-loads .env from CWD),
  // then fall back to getEnv() which parses via zod.
  const key = process.env.GEMINI_API_KEY;
  if (key) return key;

  try {
    const { getEnv } = require('@argus/config');
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
  PRO: 'gemini-2.0-flash',
  FLASH: 'gemini-2.0-flash',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ─── Get Model Instance ──────────────────────────────────────────

export function getModel(modelId: ModelId = MODELS.PRO): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: modelId });
}
