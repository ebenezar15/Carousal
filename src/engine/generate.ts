// Single entry point for turning content into a CarouselPlan. Picks a provider, validates the JSON
// with Zod, asks the model to repair invalid output, and always falls back to the rules splitter,
// so generation never hard-fails.
import { CarouselPlanSchema, planJsonSchema, type CarouselPlan } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { normalizePlan } from './normalize';
import { planFromText } from './rules';
import type { AIProvider, ChatMessage, GenerateOptions, GenerateResult, ProviderId } from './types';

export type ProviderPreference = 'auto' | ProviderId;

export const MAX_REPAIRS = 2;

/** Pulls a JSON object out of model text (handles ```json fences and leading/trailing chatter). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1]! : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new SyntaxError('No JSON object found in the response.');
  }
}

export type ParseOutcome = { ok: true; plan: CarouselPlan } | { ok: false; error: string };

export function parsePlan(text: string): ParseOutcome {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const result = CarouselPlanSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { ok: false, error: issues.join('\n') };
  }
  if (result.data.slides.length === 0) return { ok: false, error: 'slides: must contain at least one slide' };
  return { ok: true, plan: result.data };
}

/** Runs one provider with the validate → repair loop. Throws if the provider fails or never yields valid JSON. */
export async function runProvider(
  provider: AIProvider,
  content: string,
  opts: GenerateOptions,
  signal?: AbortSignal,
): Promise<{ plan: CarouselPlan; attempts: number }> {
  const system = buildSystemPrompt();
  const jsonSchema = planJsonSchema();
  const messages: ChatMessage[] = [buildUserMessage(content, opts)];
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_REPAIRS + 1; attempt++) {
    const text = await provider.complete({ system, messages, jsonSchema, signal });
    const parsed = parsePlan(text);
    if (parsed.ok) return { plan: normalizePlan(parsed.plan, opts), attempts: attempt };
    lastError = parsed.error;
    messages.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `That output did not match the required schema:\n${parsed.error}\n\nReturn the complete corrected JSON object only.`,
      },
    );
  }
  throw new Error(`Output still invalid after ${MAX_REPAIRS} repair attempts: ${lastError}`);
}

export async function generatePlan(
  content: string,
  opts: GenerateOptions,
  preference: ProviderPreference,
  providers: AIProvider[],
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const rules = (notice?: string): GenerateResult => ({ plan: planFromText(content, opts), provider: 'rules', notice, attempts: 1 });
  if (preference === 'rules') return rules();

  const candidates = preference === 'auto' ? providers : providers.filter((p) => p.id === preference);
  const notes: string[] = [];
  for (const p of candidates) {
    if (!(await p.isAvailable())) {
      notes.push(`${p.label} unavailable`);
      continue;
    }
    try {
      const { plan, attempts } = await runProvider(p, content, opts, signal);
      return { plan, provider: p.id, attempts, notice: notes.length ? notes.join('; ') : undefined };
    } catch (e) {
      if (signal?.aborted) throw e;
      notes.push(`${p.label} failed: ${(e as Error).message}`);
    }
  }
  const reason = notes.length ? notes.join('; ') : 'No AI provider configured';
  return rules(`${reason}. Used the built-in rules instead.`);
}
