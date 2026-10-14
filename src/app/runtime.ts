// Wires the engine's providers to the current settings.
import { createClaudeProvider, createOllamaProvider, createOpenAIProvider, type AIProvider } from '@/engine';
import { useSettings } from './store';

const settings = () => useSettings.getState().settings;

/** In "Auto" mode the first available one is used: Claude → free/local OpenAI-compatible (once set up) → Ollama → rules. */
export const providers: AIProvider[] = [
  createClaudeProvider(() => settings().claudeModel, () => settings().claudeFastModel),
  createOpenAIProvider(() => ({ preset: settings().openaiPreset, baseUrl: settings().openaiBaseUrl, model: settings().openaiModel, fastModel: settings().openaiFastModel })),
  createOllamaProvider(() => ({ baseUrl: settings().ollamaUrl, model: settings().ollamaModel, fastModel: settings().ollamaFastModel })),
];
