// ─── AI Package Exports ──────────────────────────────────────────

export { getGeminiClient, getModel, getProvider, MODELS } from './client';
export type { ModelId } from './client';

export { chat, streamChat, nlToCypher } from './services';
export type { ChatOptions, ChatMessage } from './services';

export { SYSTEM_PROMPTS, USER_PROMPTS, buildPrompt } from './prompts';
export type { PromptTemplate } from './prompts';

export { qdrant, initQdrant, generateEmbedding, indexCVE, searchCVEs, COLLECTION_NAME } from './embeddings';
