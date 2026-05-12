import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { getEnv } from '@argus/config';

// ─── Singleton Client ────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | undefined;

export function getGeminiClient(): GoogleGenerativeAI {
  if (_genAI) return _genAI;

  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for AI features');
  }

  _genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return _genAI;
}

// ─── Model Constants ─────────────────────────────────────────────

export const MODELS = {
  PRO: 'gemini-2.0-flash',
  FLASH: 'gemini-2.0-flash-lite',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ─── Get Model Instance ──────────────────────────────────────────

export function getModel(modelId: ModelId = MODELS.PRO): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: modelId });
}
