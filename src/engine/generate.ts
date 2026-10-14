// Single entry point for turning content into a CarouselPlan. Picks a provider, validates the JSON
// with Zod, asks the model to repair invalid output, and always falls back to the rules splitter,
// so generation never hard-fails.
import { z } from 'zod';
import { CarouselPlanSchema, type CarouselPlan } from './schema';
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

type JsonSchemaNode = { type?: string | string[]; anyOf?: JsonSchemaNode[]; properties?: Record<string, JsonSchemaNode>; items?: JsonSchemaNode };

const allows = (node: JsonSchemaNode, type: string): boolean =>
  node.type === type || (Array.isArray(node.type) && node.type.includes(type)) || !!node.anyOf?.some((n) => allows(n, type));

/**
 * Fills properties a model left out with their empty value (null, [] or ''), guided by the JSON schema.
 * Small local models in plain JSON mode often skip fields they have nothing for; filling them avoids a
 * slow repair round-trip. Enums, numbers and objects are left alone, so real gaps still fail validation.
 */
export function fillMissing(schema: JsonSchemaNode, data: unknown): unknown {
  if (Array.isArray(data)) return schema.items ? data.map((d) => fillMissing(schema.items!, d)) : data;
  if (!data || typeof data !== 'object' || !schema.properties) return data;
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (out[key] === undefined) {
      if (allows(prop, 'null')) out[key] = null;
      else if (allows(prop, 'array')) out[key] = [];
      else if (prop.type === 'string' && !('enum' in prop)) out[key] = '';
    } else out[key] = fillMissing(prop.anyOf?.find((n) => n.type === 'object') ?? prop, out[key]);
  }
  return out;
}

export const jsonSchemaOf = (schema: z.ZodType): Record<string, unknown> => {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
};

export type ParseOutcome = { ok: true; plan: CarouselPlan } | { ok: false; error: string };

export function parsePlan(text: string): ParseOutcome {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const result = CarouselPlanSchema.safeParse(fillMissing(jsonSchemaOf(CarouselPlanSchema), data));
  if (!result.success) {
    const issues = result.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { ok: false, error: issues.join('\n') };
  }
  if (result.data.slides.length === 0) return { ok: false, error: 'slides: must contain at least one slide' };
  return { ok: true, plan: result.data };
}

/** Validates model text against any Zod schema (shared by plans, slide rewrites, headline options). */
export function parseWith<T>(schema: z.ZodType<T>, text: string): { ok: true; value: T } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const r = schema.safeParse(fillMissing(jsonSchemaOf(schema), data));
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n') };
}

/** One provider call with the validate → repair loop, for any schema. */
export async function completeJson<T>(
  provider: AIProvider,
  system: string,
  first: ChatMessage,
  schema: z.ZodType<T>,
  validate: (text: string) => { ok: true; value: T } | { ok: false; error: string } = (t) => parseWith(schema, t),
  signal?: AbortSignal,
): Promise<{ value: T; attempts: number }> {
  const jsonSchema = jsonSchemaOf(schema);
  const messages: ChatMessage[] = [first];
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_REPAIRS + 1; attempt++) {
    const text = await provider.complete({ system, messages, jsonSchema, signal });
    const parsed = validate(text);
    if (parsed.ok) return { value: parsed.value, attempts: attempt };
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

/** Runs one provider for a whole plan. Throws if the provider fails or never yields valid JSON. */
export async function runProvider(
  provider: AIProvider,
  content: string,
  opts: GenerateOptions,
  signal?: AbortSignal,
): Promise<{ plan: CarouselPlan; attempts: number }> {
  const validate = (t: string) => {
    const r = parsePlan(t);
    return r.ok ? ({ ok: true, value: r.plan } as const) : r;
  };
  const { value, attempts } = await completeJson(provider, buildSystemPrompt(), buildUserMessage(content, opts), CarouselPlanSchema, validate, signal);
  return { plan: normalizePlan(value, opts), attempts };
}

/** First available provider for a preference (rules excluded), or null. */
export async function pickProvider(preference: ProviderPreference, providers: AIProvider[]): Promise<AIProvider | null> {
  if (preference === 'rules') return null;
  const candidates = preference === 'auto' ? providers : providers.filter((p) => p.id === preference);
  for (const p of candidates) if (await p.isAvailable()) return p;
  return null;
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
