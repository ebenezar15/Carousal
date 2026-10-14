// Offline provider: a local model served by Ollama (default http://localhost:11434).
import { appFetch } from '../net';
import type { AIProvider, CompletionRequest } from '../types';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Generation limits for local models. num_ctx: Ollama's default window can cut off our system prompt;
 * num_predict: a hard stop for the rare model that loops instead of closing the JSON.
 */
export const OLLAMA_OPTIONS = { temperature: 0.4, num_ctx: 8192, num_predict: 4096 };

/**
 * We ask for plain JSON mode with the schema in the prompt instead of `format: <schema>`. Grammar-
 * constrained decoding emits keys in alphabetical order (role and title come last), which in live
 * tests made small models write repetitive, role-less slides and run several times longer.
 */
export function ollamaSystemPrompt(system: string, jsonSchema: Record<string, unknown>): string {
  return `${system}

Reply with a single JSON object only, no prose. It must match this JSON Schema, with keys in the order listed:
${JSON.stringify(jsonSchema)}`;
}

export interface OllamaModel { name: string; size?: number }

export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_URL, timeoutMs = 1500): Promise<OllamaModel[] | null> {
  try {
    const res = await appFetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const json = (await res.json()) as { models?: OllamaModel[] };
    return json.models ?? [];
  } catch {
    return null; // not running, blocked by CORS, or timed out
  }
}

export function createOllamaProvider(getConfig: () => { baseUrl: string; model: string }): AIProvider {
  return {
    id: 'ollama',
    label: 'Ollama (local)',
    async isAvailable() {
      const { baseUrl, model } = getConfig();
      const models = await listOllamaModels(baseUrl);
      if (!models || models.length === 0) return false;
      return !model || models.some((m) => m.name === model || m.name === `${model}:latest`);
    },
    async complete(req: CompletionRequest) {
      const { baseUrl, model } = getConfig();
      let useModel = model;
      if (!useModel) {
        const models = await listOllamaModels(baseUrl);
        useModel = models?.[0]?.name ?? '';
        if (!useModel) throw new Error('No Ollama models installed. Run e.g. `ollama pull qwen2.5:7b`.');
      }
      const res = await appFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: req.signal,
        body: JSON.stringify({
          model: useModel,
          stream: false,
          format: 'json',
          options: OLLAMA_OPTIONS,
          messages: [{ role: 'system', content: ollamaSystemPrompt(req.system, req.jsonSchema) }, ...req.messages],
        }),
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text().catch(() => '')}`);
      const json = (await res.json()) as { message?: { content?: string } };
      const text = json.message?.content ?? '';
      if (!text) throw new Error('Ollama returned an empty response.');
      return text;
    },
  };
}
