import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { getEnv } from '@argus/config';

// ─── Singleton Client ────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | undefined;

function resolveApiKey(): string {
  const env = getEnv();
  const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

  if (key) return key;
  throw new Error('GEMINI_API_KEY is required for Gemini AI features');
}

export function getGeminiClient(): GoogleGenerativeAI {
  if (_genAI) return _genAI;

  const apiKey = resolveApiKey();
  console.info(`[AI] Gemini client initialized (key: ${apiKey.substring(0, 8)}...)`);
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

// ─── Provider & Model Constants ──────────────────────────────────

export const MODELS = {
  PRO: 'gemini-2.0-flash-lite',
  FLASH: 'gemini-2.0-flash-lite',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS] | string;

// ─── Get Model Instance (Gemini Only) ─────────────────────────────

export function getModel(modelId: ModelId = MODELS.PRO): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: modelId as string });
}

export function getProvider() {
  const env = getEnv();
  return env.LLM_PROVIDER;
}
