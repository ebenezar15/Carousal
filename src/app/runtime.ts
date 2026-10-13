// Wires the engine's providers to the current settings.
import { createClaudeProvider, createOllamaProvider, type AIProvider } from '@/engine';
import { useSettings } from './store';

const settings = () => useSettings.getState().settings;

export const providers: AIProvider[] = [
  createClaudeProvider(() => settings().claudeModel),
  createOllamaProvider(() => ({ baseUrl: settings().ollamaUrl, model: settings().ollamaModel })),
];
