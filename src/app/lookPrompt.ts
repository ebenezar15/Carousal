// Reads a "Describe the look" prompt: the free built-in interpreter first, an AI model only when the
// prompt has words it doesn't know (or always/never, per Settings). AI readings are cached per prompt.
import { interpretPrompt, interpretPromptWithAI, needsAI, pickProvider, type Interpretation } from '@/engine';
import { providers } from './runtime';
import { useSettings } from './store';

export async function readLookPrompt(prompt: string, signal?: AbortSignal): Promise<Interpretation | null> {
  if (!prompt.trim()) return null;
  const { settings } = useSettings.getState();
  const offline = interpretPrompt(prompt);
  if (settings.designAI === 'never' || (settings.designAI === 'auto' && !needsAI(offline))) return offline;
  const p = await pickProvider(settings.provider, providers);
  if (!p) return offline;
  try {
    return await interpretPromptWithAI(prompt, p, signal);
  } catch {
    return offline;
  }
}
