// "Free models" provider: any server that speaks the OpenAI-compatible chat API. Covers free online
// tiers (OpenRouter's free models, Groq, Google Gemini) and local servers (LM Studio, llama.cpp, Jan).
// Keys are the user's own and stay in the OS keychain (desktop) or this browser (web).
import { getSecret } from '@/secrets';
import { appFetch } from '../net';
import { extractJson } from '../generate';
import type { AIProvider, CompletionRequest } from '../types';
import { schemaPrompt } from './shared';

export type OpenAIPresetId = 'openrouter' | 'groq' | 'gemini' | 'lmstudio' | 'llamacpp' | 'jan' | 'custom';

export interface OpenAIPreset {
  id: OpenAIPresetId;
  label: string;
  baseUrl: string;
  /** Secret name for the key; undefined = local server without a key. */
  keyName?: string;
  keyUrl?: string;
  online: boolean;
  /** Suggested model if the list can't be loaded. */
  suggested?: string;
  hint: string;
}

export const OPENAI_PRESETS: OpenAIPreset[] = [
  { id: 'openrouter', label: 'OpenRouter (free models)', baseUrl: 'https://openrouter.ai/api/v1', keyName: 'openrouter_api_key', keyUrl: 'https://openrouter.ai/keys', online: true, hint: 'One free key gives access to many open models; the list shows the free ones (":free"). Free models have daily limits.' },
  { id: 'groq', label: 'Groq (free tier)', baseUrl: 'https://api.groq.com/openai/v1', keyName: 'groq_api_key', keyUrl: 'https://console.groq.com/keys', online: true, suggested: 'llama-3.3-70b-versatile', hint: 'Very fast open models with a generous free tier.' },
  { id: 'gemini', label: 'Google Gemini (free tier)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyName: 'gemini_api_key', keyUrl: 'https://aistudio.google.com/apikey', online: true, suggested: 'gemini-2.5-flash', hint: 'Strong multilingual quality (good for Tamil and other Indian languages); free tier with rate limits.' },
  { id: 'lmstudio', label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', online: false, hint: 'Download free models in LM Studio, then start its local server (Developer tab).' },
  { id: 'llamacpp', label: 'llama.cpp server (local)', baseUrl: 'http://localhost:8080/v1', online: false, hint: 'Run `llama-server -m model.gguf` and point CarouselForge at it.' },
  { id: 'jan', label: 'Jan (local)', baseUrl: 'http://localhost:1337/v1', online: false, hint: 'Enable Jan’s local API server in its settings.' },
  { id: 'custom', label: 'Custom OpenAI-compatible server', baseUrl: '', keyName: 'custom_openai_api_key', online: true, hint: 'Any server with /v1/chat/completions (vLLM, LocalAI, a company gateway…). The key is optional.' },
];

export const getOpenAIPreset = (id: string) => OPENAI_PRESETS.find((p) => p.id === id) ?? OPENAI_PRESETS[0]!;

export interface OpenAIConfig { preset: OpenAIPresetId; baseUrl: string; model: string; fastModel?: string }

export interface OpenAIModelInfo { id: string; free: boolean }

const trimSlash = (u: string) => u.replace(/\/+$/, '');

async function headersFor(preset: OpenAIPreset): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const key = preset.keyName ? await getSecret(preset.keyName).catch(() => null) : null;
  if (key) h.authorization = `Bearer ${key}`;
  if (preset.id === 'openrouter') {
    h['X-Title'] = 'CarouselForge';
    h['HTTP-Referer'] = 'https://github.com/carouselforge';
  }
  return h;
}

/** Models the server offers; OpenRouter's list is narrowed to (and sorted by) free models. */
export async function listOpenAIModels(cfg: Pick<OpenAIConfig, 'preset' | 'baseUrl'>, timeoutMs = 6000): Promise<OpenAIModelInfo[] | null> {
  const preset = getOpenAIPreset(cfg.preset);
  const base = trimSlash(cfg.baseUrl || preset.baseUrl);
  if (!base) return null;
  try {
    const res = await appFetch(`${base}/models`, { headers: await headersFor(preset), signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
    const models = (json.data ?? []).map((m) => ({
      id: m.id.replace(/^models\//, ''),
      free: m.id.endsWith(':free') || (m.pricing ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 : !preset.online),
    }));
    return preset.id === 'openrouter' ? models.filter((m) => m.free).sort((a, b) => a.id.localeCompare(b.id)) : models.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return null;
  }
}

export function createOpenAIProvider(getConfig: () => OpenAIConfig): AIProvider {
  return {
    id: 'openai',
    label: 'Free / local model (OpenAI-compatible)',
    async isAvailable() {
      const cfg = getConfig();
      const preset = getOpenAIPreset(cfg.preset);
      if (!cfg.model || !(cfg.baseUrl || preset.baseUrl)) return false;
      if (preset.online) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
        if (preset.id === 'custom') return true;
        return Boolean(preset.keyName && (await getSecret(preset.keyName).catch(() => null)));
      }
      return (await listOpenAIModels(cfg, 1500)) !== null;
    },
    async complete(req: CompletionRequest) {
      const cfg = getConfig();
      const preset = getOpenAIPreset(cfg.preset);
      const base = trimSlash(cfg.baseUrl || preset.baseUrl);
      const model = (req.tier === 'fast' && cfg.fastModel) || cfg.model;
      if (!model) throw new Error('Choose a model for the free / local provider in Settings.');
      const headers = await headersFor(preset);
      const body = {
        model,
        temperature: 0.4,
        max_tokens: 8192,
        messages: [{ role: 'system', content: schemaPrompt(req.system, req.jsonSchema) }, ...req.messages],
        response_format: { type: 'json_object' },
      };
      const send = (b: object) => appFetch(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(b), signal: req.signal });
      let res = await send(body);
      // Some local servers reject json_object mode; the schema is in the prompt anyway.
      if (res.status === 400 || res.status === 422) {
        const err = await res.text().catch(() => '');
        if (/response_format|json/i.test(err)) {
          const { response_format: _rf, ...rest } = body;
          void _rf;
          res = await send(rest);
        } else throw new Error(`${preset.label} error ${res.status}: ${err.slice(0, 300)}`);
      }
      if (res.status === 429) throw new Error(`${preset.label}: rate limit reached (free tiers have per-minute/day limits). Try again shortly or pick another model.`);
      if (!res.ok) throw new Error(`${preset.label} error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      const text = json.choices?.[0]?.message?.content ?? '';
      if (!text) throw new Error(`${preset.label} returned an empty response.`);
      // Normalize: some models wrap JSON in prose or fences.
      try {
        return JSON.stringify(extractJson(text));
      } catch {
        return text;
      }
    },
  };
}
