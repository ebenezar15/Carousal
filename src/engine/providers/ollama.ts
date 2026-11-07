// Offline provider: a local model served by Ollama (default http://localhost:11434), plus a small model
// manager (list, pull with progress, delete) so users can fetch free models from inside the app.
import { appFetch } from '../net';
import type { AIProvider, CompletionRequest } from '../types';
import { estimateTokens, schemaPrompt } from './shared';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Generation limits for local models. num_predict is a hard stop for the rare model that loops instead
 * of closing the JSON; num_ctx is sized per request (big enough for prompt + answer, no bigger: a
 * smaller window loads faster and needs less memory).
 */
export const OLLAMA_OPTIONS = { temperature: 0.4, num_predict: 4096 };
/** Keeps the model in memory between calls (a reload costs seconds to minutes on CPU). */
export const OLLAMA_KEEP_ALIVE = '30m';

export function contextFor(promptTokens: number, numPredict: number): number {
  const need = promptTokens + numPredict + 256;
  return Math.min(32768, Math.max(4096, Math.ceil(need / 2048) * 2048));
}

export interface OllamaModel { name: string; size?: number; details?: { parameter_size?: string; family?: string } }

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

/** Free models that work well with CarouselForge (sizes are the default 4-bit downloads). */
export const RECOMMENDED_OLLAMA_MODELS = [
  { name: 'gemma3:4b', size: '3.3 GB', ram: '8 GB', note: 'Best all-rounder for small machines. Strong in 140+ languages, including Tamil and other Indian languages — recommended for translation.', license: 'Gemma Terms of Use' },
  { name: 'gemma3:1b', size: '0.8 GB', ram: '4 GB', note: 'Tiny and fast for older laptops; simpler copy and weaker translations.', license: 'Gemma Terms of Use' },
  { name: 'llama3.2:3b', size: '2.0 GB', ram: '6 GB', note: 'Fast English copywriting; limited for non-European languages.', license: 'Llama 3.2 Community License' },
  { name: 'qwen2.5:7b', size: '4.7 GB', ram: '10 GB', note: 'Very reliable JSON and structure; good multilingual quality.', license: 'Apache-2.0' },
  { name: 'gemma3:12b', size: '8.1 GB', ram: '16 GB', note: 'Best quality and translation if you have the memory (or a GPU).', license: 'Gemma Terms of Use' },
] as const;

export interface PullProgress { status: string; completed?: number; total?: number }

/** Downloads a model through the local Ollama server, streaming progress. Resolves when it is ready. */
export async function pullOllamaModel(baseUrl: string, model: string, onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void> {
  const res = await appFetch(`${baseUrl}/api/pull`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: true }), signal });
  if (!res.ok || !res.body) throw new Error(`Ollama could not pull ${model} (${res.status}): ${await res.text().catch(() => '')}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as PullProgress & { error?: string };
      if (msg.error) throw new Error(msg.error);
      onProgress(msg);
    }
  }
}

export async function deleteOllamaModel(baseUrl: string, model: string): Promise<void> {
  const res = await appFetch(`${baseUrl}/api/delete`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) });
  if (!res.ok) throw new Error(`Ollama could not delete ${model} (${res.status}).`);
}

export function createOllamaProvider(getConfig: () => { baseUrl: string; model: string; fastModel?: string }): AIProvider {
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
      const { baseUrl, model, fastModel } = getConfig();
      let useModel = (req.tier === 'fast' && fastModel) || model;
      if (!useModel) {
        const models = await listOllamaModels(baseUrl);
        useModel = models?.[0]?.name ?? '';
        if (!useModel) throw new Error('No Ollama models installed. Pull one in Settings (e.g. gemma3:4b).');
      }
      const system = schemaPrompt(req.system, req.jsonSchema);
      const promptTokens = estimateTokens(system + req.messages.map((m) => m.content).join('\n'));
      const res = await appFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: req.signal,
        body: JSON.stringify({
          model: useModel,
          stream: false,
          format: 'json',
          keep_alive: OLLAMA_KEEP_ALIVE,
          options: { ...OLLAMA_OPTIONS, ...(req.maxTokens ? { num_predict: Math.min(OLLAMA_OPTIONS.num_predict, req.maxTokens) } : {}), num_ctx: contextFor(promptTokens, req.maxTokens ? Math.min(OLLAMA_OPTIONS.num_predict, req.maxTokens) : OLLAMA_OPTIONS.num_predict) },
          messages: [{ role: 'system', content: system }, ...req.messages],
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
