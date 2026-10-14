// Post caption + hashtags + per-slide alt text, via AI when available, else built from the plan offline.
import { z } from 'zod';
import { completeJson, pickProvider, type ProviderPreference } from './generate';
import type { CarouselPlan } from './schema';
import type { AIProvider, Tone } from './types';
import { clampWords, sentences } from './text';

export type CaptionLength = 'short' | 'medium' | 'long';

/** Caption limits per platform (characters) and recommended hashtag counts. */
export const CAPTION_RULES: Record<string, { maxChars: number; hashtags: [number, number]; note: string }> = {
  instagram: { maxChars: 2200, hashtags: [3, 5], note: 'First ~125 characters show before “more”. Max 30 hashtags.' },
  linkedin: { maxChars: 3000, hashtags: [3, 5], note: 'First ~210 characters show before “see more”.' },
  tiktok: { maxChars: 4000, hashtags: [3, 6], note: 'Short, punchy captions work best.' },
  facebook: { maxChars: 63206, hashtags: [0, 3], note: 'Hashtags matter less on Facebook.' },
  x: { maxChars: 280, hashtags: [1, 2], note: '280 characters including hashtags (standard accounts).' },
  pinterest: { maxChars: 500, hashtags: [2, 5], note: 'Descriptions are searchable — use keywords.' },
  threads: { maxChars: 500, hashtags: [0, 1], note: 'Threads supports one topic tag per post.' },
};

export interface CaptionOptions { platform: string; tone: Tone; length: CaptionLength; emoji: boolean; cta: boolean; language: string }

export const CaptionSchema = z.object({ caption: z.string(), hashtags: z.array(z.string()), altText: z.array(z.string()) });
export type CaptionResult = z.infer<typeof CaptionSchema> & { provider: string };

const STOP = new Set(
  'the and for with that this from your you are was were have has had into about what when where which while will would there their they them then than just more most very also over only such some these those been being does doing make makes made how why our its not but can all any out use using get got one two three every each other team teams'.split(' '),
);

/** Hashtags from the most frequent meaningful words (and two-word title phrases). */
export function keywordHashtags(plan: CarouselPlan, n = 5): string[] {
  const text = [plan.title, ...plan.slides.flatMap((s) => [s.headline, s.body, ...s.bullets])].join(' ').toLowerCase();
  const counts = new Map<string, number>();
  for (const w of text.match(/\p{L}[\p{L}\p{N}'-]{3,}/gu) ?? []) {
    const k = w.replace(/['-]/g, '');
    if (STOP.has(k)) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const titleWords = (plan.title.toLowerCase().match(/\p{L}[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w));
  for (const w of titleWords) counts.set(w, (counts.get(w) ?? 0) + 2);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => `#${w[0]!.toUpperCase()}${w.slice(1)}`);
}

export function altTextFor(plan: CarouselPlan): string[] {
  return plan.slides.map((s, i) => {
    const parts = [s.headline, s.stat ? `${s.stat.value} ${s.stat.label}` : '', s.quote ? `Quote: “${s.quote.text}”${s.quote.attribution ? ` — ${s.quote.attribution}` : ''}` : '', s.body, s.bullets.join('; ')].filter(Boolean);
    return `Slide ${i + 1} of ${plan.slides.length}: ${parts.join('. ')}`.slice(0, 420);
  });
}

/** Offline caption: hook line, 1–4 takeaways, CTA, hashtags — sized to the platform. */
export function rulesCaption(plan: CarouselPlan, o: CaptionOptions): CaptionResult {
  const rule = CAPTION_RULES[o.platform] ?? CAPTION_RULES.instagram!;
  const hook = plan.slides.find((s) => s.role === 'hook');
  const points = plan.slides.filter((s) => !['hook', 'cta', 'quote'].includes(s.role) && s.headline && !s.headline.endsWith('(cont.)')).map((s) => s.headline.replace(/^\d+[.)]\s*/, ''));
  const count = o.length === 'short' ? 1 : o.length === 'medium' ? 3 : 5;
  const lead = hook ? `${hook.headline}${/[.!?]$/.test(hook.headline) ? '' : '.'}` : plan.title;
  const sub = hook?.body ? ` ${sentences(hook.body)[0] ?? ''}` : '';
  const bullet = o.emoji ? '→' : '-';
  const lines = [lead + (o.length !== 'short' ? sub : '')];
  if (points.length && o.length !== 'short') lines.push('', ...points.slice(0, count).map((p) => `${bullet} ${p}`));
  if (o.cta) lines.push('', o.emoji ? '💾 Save this for later and share it with someone who needs it.' : 'Save this for later and share it with someone who needs it.');
  const tags = keywordHashtags(plan, rule.hashtags[1]);
  let caption = lines.join('\n').trim();
  const budget = rule.maxChars - (tags.join(' ').length + 2);
  if (caption.length > budget) caption = clampWords(caption, Math.max(5, Math.floor(budget / 6)));
  return { caption, hashtags: rule.hashtags[1] === 0 ? [] : tags.slice(0, Math.max(rule.hashtags[0], Math.min(tags.length, rule.hashtags[1]))), altText: altTextFor(plan), provider: 'rules' };
}

export async function generateCaption(plan: CarouselPlan, o: CaptionOptions, pref: ProviderPreference, providers: AIProvider[], signal?: AbortSignal): Promise<CaptionResult & { notice?: string }> {
  const provider = await pickProvider(pref, providers);
  if (!provider) return rulesCaption(plan, o);
  const rule = CAPTION_RULES[o.platform] ?? CAPTION_RULES.instagram!;
  const deck = plan.slides.map((s, i) => `${i + 1}. [${s.role}] ${s.headline}${s.body ? ` — ${s.body}` : ''}${s.bullets.length ? ` • ${s.bullets.join(' • ')}` : ''}${s.stat ? ` (${s.stat.value} ${s.stat.label})` : ''}`).join('\n');
  try {
    const { value } = await completeJson(
      provider,
      'You write social media post copy that accompanies a carousel. Return only JSON matching the schema.',
      {
        role: 'user',
        content: `Carousel:
${deck}

Write the post caption for ${o.platform}.
- Length: ${o.length} (${o.length === 'short' ? '1-2 sentences' : o.length === 'medium' ? '3-5 short lines' : '6-10 short lines'}); max ${rule.maxChars} characters including hashtags. ${rule.note}
- The first line must hook the reader and make sense before the "more" cut-off.
- Tone: ${o.tone}. ${o.emoji ? 'Use a few relevant emoji.' : 'No emoji.'} ${o.cta ? 'End with one clear call to action.' : 'No call to action.'}
- ${o.language === 'auto' ? 'Same language as the carousel.' : `Language: ${o.language}.`}
- hashtags: ${rule.hashtags[0]}-${rule.hashtags[1]} specific, relevant hashtags (with #, no spaces); don't put them inside the caption.
- altText: one concise description per slide (${plan.slides.length} items) for screen readers, including the slide's text.
Never invent facts or statistics that aren't in the carousel.`,
      },
      CaptionSchema,
      undefined,
      signal,
    );
    const hashtags = value.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, '')).slice(0, rule.hashtags[1] || 30);
    const alt = value.altText.length === plan.slides.length ? value.altText : altTextFor(plan);
    return { caption: value.caption.trim(), hashtags, altText: alt, provider: provider.id };
  } catch (e) {
    return { ...rulesCaption(plan, o), notice: `${provider.label} failed (${(e as Error).message}); used the built-in caption writer.` };
  }
}

/** Full text to paste into the platform: caption + hashtags, trimmed to the limit. */
export function captionText(caption: string, hashtags: string[], platform: string): string {
  const rule = CAPTION_RULES[platform] ?? CAPTION_RULES.instagram!;
  const full = hashtags.length ? `${caption}\n\n${hashtags.join(' ')}` : caption;
  return full.length <= rule.maxChars ? full : full.slice(0, rule.maxChars - 1) + '…';
}
