// Online provider: Anthropic Claude via the official SDK. The user supplies their own key (never
// bundled). On desktop the SDK's requests go through Tauri's HTTP plugin; on the web the SDK runs in
// browser mode, which Anthropic supports for user-supplied keys.
import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_KEY, getSecret } from '@/secrets';
import { appFetch } from '../net';
import type { AIProvider, CompletionRequest } from '../types';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best quality)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
] as const;
export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

export class ClaudeRefusalError extends Error {}

export function createClaudeProvider(getModel: () => string): AIProvider {
  return {
    id: 'claude',
    label: 'Claude (online)',
    async isAvailable() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      try {
        return Boolean(await getSecret(CLAUDE_KEY));
      } catch {
        return false;
      }
    },
    async complete(req: CompletionRequest) {
      const apiKey = await getSecret(CLAUDE_KEY);
      if (!apiKey) throw new Error('No Claude API key set. Add one in Settings.');
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        fetch: appFetch as typeof fetch,
        maxRetries: 2,
      });
      const model = getModel();
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          system: req.system,
          messages: req.messages,
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: req.jsonSchema } },
          // Server-side fallback re-runs a declined request on a suitable model instead of failing.
          ...(model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
        },
        { signal: req.signal },
      );
      if (response.stop_reason === 'refusal') {
        throw new ClaudeRefusalError(response.stop_details?.explanation ?? 'The request was declined.');
      }
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      if (!text) throw new Error(`Claude returned no text (stop_reason: ${response.stop_reason}).`);
      return text;
    },
  };
}
