// Regeneration at three levels: whole carousel (re-run generatePlan), one slide (copy via AI, layout
// offline), one element (headline alternatives via AI, emphasis offline).
import { z } from 'zod';
import { patterns } from '@/styles';
import { completeJson, pickProvider, type ProviderPreference } from './generate';
import { SlidePlanSchema, type CarouselPlan, type SlidePlan } from './schema';
import { normalizePlan } from './normalize';
import { words } from './text';
import type { AIProvider, GenerateOptions } from './types';
import { ROLE_LAYOUTS } from './layout/layouts';

export class NeedsAIError extends Error {
  constructor(what: string) {
    super(`${what} needs an AI model (Claude, a free online model, or Ollama). Set one up in Settings — layout and emphasis changes work offline.`);
  }
}

/**
 * Short, task-specific instructions for one-slide jobs. (The full plan-generation prompt is ~5k
 * characters about building whole carousels; sending it for a single headline wastes credits.)
 */
const EDIT_SYSTEM = `You edit one slide of a social media carousel. Return only JSON matching the schema.
Keep the author's facts and voice; never invent statistics, quotes or sources. One idea per slide; short, concrete, scannable words.`;

/** Headline ideas already fetched for the same slide text (asking again is free). */
const headlineCache = new Map<string, string[]>();

const planContext = (plan: CarouselPlan, index: number) =>
  plan.slides.map((s, i) => `${i === index ? '>>' : '  '} ${i + 1}. [${s.role}] ${s.headline}${s.body ? ` — ${s.body}` : ''}${s.bullets.length ? ` • ${s.bullets.join(' • ')}` : ''}`).join('\n');

/** Rewrites one slide's copy with the AI, keeping its role and the rest of the deck. */
export async function rewriteSlide(
  plan: CarouselPlan,
  index: number,
  opts: GenerateOptions,
  pref: ProviderPreference,
  providers: AIProvider[],
  instruction = '',
  signal?: AbortSignal,
): Promise<{ plan: CarouselPlan; provider: string }> {
  const provider = await pickProvider(pref, providers);
  if (!provider) throw new NeedsAIError('Rewriting a slide');
  const slide = plan.slides[index]!;
  const r = patterns.roles[slide.role];
  const { value } = await completeJson(
    provider,
    EDIT_SYSTEM,
    {
      role: 'user',
      content: `Here is a carousel (">>" marks the slide to rewrite):
${planContext(plan, index)}

Rewrite slide ${index + 1} only. Keep its role "${slide.role}" and its core meaning, but give it a fresh, sharper take. ${instruction}
Limits for ${slide.role}: headline ≤ ${r.headlineMaxWords} words, body ≤ ${r.bodyMaxWords} words${r.maxBullets ? `, ≤ ${r.maxBullets} bullets` : ''}. Tone: ${opts.tone}. Same language as the deck.
Return one slide object as JSON (fields: role, headline, body, bullets, stat, quote, emphasis = 1-2 words from the headline, layoutHint, iconKeywords).`,
    },
    SlidePlanSchema,
    undefined,
    signal,
    'fast',
    2000,
  );
  const slides = plan.slides.map((s, i) => (i === index ? { ...value, role: slide.role } : s));
  // normalize enforces limits/emphasis; keep slide count by passing an explicit count.
  const next = normalizePlan({ ...plan, slides }, { ...opts, slideCount: plan.slides.length, maxSlides: Math.max(opts.maxSlides, plan.slides.length) });
  return { plan: next, provider: provider.id };
}

const HeadlineOptions = z.object({ options: z.array(z.string()) });

/** Three alternative headlines for one slide (AI). */
export async function headlineOptions(plan: CarouselPlan, index: number, opts: GenerateOptions, pref: ProviderPreference, providers: AIProvider[], signal?: AbortSignal): Promise<string[]> {
  const provider = await pickProvider(pref, providers);
  if (!provider) throw new NeedsAIError('Rewriting a headline');
  const slide = plan.slides[index]!;
  const key = JSON.stringify([plan.language, opts.tone, slide.role, slide.headline, slide.body, index > 0 ? plan.slides[0]!.headline : '']);
  const cached = headlineCache.get(key);
  if (cached) return cached;
  const max = patterns.roles[slide.role].headlineMaxWords || 12;
  const { value } = await completeJson(
    provider,
    EDIT_SYSTEM,
    {
      role: 'user',
      content: `Carousel (">>" marks the slide):
${planContext(plan, index)}

Write 3 alternative headlines for slide ${index + 1} (role "${slide.role}"), each ≤ ${max} words, each using a different angle${slide.role === 'hook' ? ' (e.g. number promise, question, bold claim)' : ''}. Tone: ${opts.tone}. Same language. Return {"options": [..3 strings..]}.`,
    },
    HeadlineOptions,
    undefined,
    signal,
    'fast',
    600,
  );
  const out = value.options.map((o) => o.trim()).filter(Boolean).slice(0, 3);
  headlineCache.set(key, out);
  return out;
}

export function setHeadline(plan: CarouselPlan, index: number, headline: string): CarouselPlan {
  return { ...plan, slides: plan.slides.map((s, i) => (i === index ? { ...s, headline, emphasis: s.emphasis.filter((w) => headline.toLowerCase().includes(w.toLowerCase())) } : s)) };
}

/** Offline: moves emphasis to the next meaningful word of the headline. */
export function cycleEmphasis(plan: CarouselPlan, index: number): CarouselPlan {
  const s = plan.slides[index]!;
  const candidates = words(s.headline)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, ''))
    .filter((w) => w.length > 2 || /\d/.test(w));
  if (!candidates.length) return plan;
  const cur = s.emphasis[0]?.toLowerCase();
  const at = candidates.findIndex((w) => w.toLowerCase() === cur);
  const next = candidates[(at + 1) % candidates.length]!;
  const slides: SlidePlan[] = plan.slides.map((x, i) => (i === index ? { ...x, emphasis: [next] } : x));
  return { ...plan, slides };
}

/** Offline: the next layout in the role's catalog after `current`. */
export function nextLayoutId(role: SlidePlan['role'], current: string | undefined): string {
  const list = ROLE_LAYOUTS[role];
  const at = current ? list.indexOf(current) : -1;
  return list[(at + 1) % list.length]!;
}
