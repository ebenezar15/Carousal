export * from './schema';
export * from './types';
export { generatePlan, parsePlan, parseWith, extractJson, runProvider, completeJson, pickProvider, type ProviderPreference } from './generate';
export { pickVariations, makeItMore, type Variation, type MoreDirection } from './variations';
export { rewriteSlide, headlineOptions, setHeadline, cycleEmphasis, nextLayoutId, NeedsAIError } from './regenerate';
export { planFromText, parseBlocks } from './rules';
export { normalizePlan } from './normalize';
export { createClaudeProvider, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from './providers/claude';
export { createOllamaProvider, listOllamaModels, DEFAULT_OLLAMA_URL, type OllamaModel } from './providers/ollama';
