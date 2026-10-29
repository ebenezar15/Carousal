// Enforces the structural rules from design-patterns.json on any plan (AI or rules):
// hook first, CTA last, slide count within limits, per-role word limits, emphasis words that exist.
import { phrasesFor } from './phrases';
import { patterns } from '@/styles';
import { emptySlide, type CarouselPlan, type SlidePlan } from './schema';
import { clampWords, pickEmphasis } from './text';
import type { GenerateOptions } from './types';

function clampSlide(s: SlidePlan): SlidePlan {
  const r = patterns.roles[s.role];
  const out = { ...s };
  if (r.headlineMaxWords > 0) out.headline = clampWords(s.headline, r.headlineMaxWords + 2);
  out.body = clampWords(s.body, Math.max(r.bodyMaxWords, 8));
  const maxBullets = Math.max(r.maxBullets, s.role === 'list' || s.role === 'summary' ? patterns.density.maxBulletsAnySlide : 0);
  out.bullets = s.bullets.slice(0, maxBullets || s.bullets.length).map((b) => clampWords(b, 12));
  if (s.quote) out.quote = { ...s.quote, text: clampWords(s.quote.text, r.bodyMaxWords || 25) };
  const lower = out.headline.toLowerCase();
  out.emphasis = s.emphasis.filter((w) => w && lower.includes(w.toLowerCase())).slice(0, 2);
  if (!out.emphasis.length && out.headline) out.emphasis = pickEmphasis(out.headline);
  return out;
}

/** Slide count range the engine aims for: the explicit option, or up to 12 in auto mode (sweet spot 7-10). */
export function targetCount(opts: GenerateOptions): { min: number; max: number } {
  const hardMax = Math.min(opts.maxSlides, patterns.slideCount.max);
  if (opts.slideCount !== 'auto') {
    const n = Math.min(hardMax, Math.max(patterns.slideCount.min, opts.slideCount));
    return { min: n, max: n };
  }
  return { min: Math.min(patterns.slideCount.min, hardMax), max: Math.min(12, hardMax) };
}

export function normalizePlan(plan: CarouselPlan, opts: GenerateOptions): CarouselPlan {
  // Drop empty slides and repeats (small local models sometimes loop over the same few slides).
  const seen = new Set<string>();
  let slides = plan.slides.filter((s) => {
    if (!(s.headline.trim() || s.body.trim() || s.bullets.length || s.stat || s.quote)) return false;
    const key = [s.headline, s.body, ...s.bullets].map((t) => t.toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Exactly one hook at the front and one CTA at the back.
  let hook = slides.find((s) => s.role === 'hook');
  let cta = [...slides].reverse().find((s) => s.role === 'cta');
  slides = slides.filter((s) => s !== hook && s !== cta).map((s) => (s.role === 'hook' || s.role === 'cta' ? { ...s, role: 'body' as const } : s));
  hook ??= emptySlide('hook', plan.title || slides[0]?.headline || 'Untitled');
  const words = phrasesFor(plan.language || 'en');
  cta ??= emptySlide('cta', words.ctaHeadline, words.ctaBody);

  const { min, max } = targetCount(opts);
  // One- or two-slide formats (e.g. a single story frame): condense into a cover and/or a recap.
  if (max <= 2) {
    const recap = emptySlide('summary', max === 1 ? hook.headline : words.recap);
    recap.bullets = slides.map((s) => s.headline.replace(/ \(cont\.\)$/, '')).filter(Boolean).slice(0, patterns.density.maxBulletsAnySlide);
    recap.emphasis = max === 1 ? hook.emphasis : [];
    const out = max === 1 ? [recap.bullets.length ? recap : hook] : [hook, recap.bullets.length ? recap : cta];
    return { ...plan, title: plan.title.trim() || hook.headline, slides: out.map(clampSlide), hashtags: plan.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, '')).slice(0, 15) };
  }
  const middleMax = Math.max(0, max - 2);
  if (slides.length > middleMax) {
    // Fold continuation slides back into their parent first, then drop from the tail.
    const merged: SlidePlan[] = [];
    for (const s of slides) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === 'body' && s.role === 'body' && s.headline.endsWith('(cont.)')) prev.body = `${prev.body} ${s.body}`;
      else merged.push({ ...s });
    }
    slides = merged.slice(0, middleMax);
  }
  // Too few: split the longest bodies at sentence boundaries is handled by the AI/rules generators;
  // here we only pad with a summary slide when we can build one from existing headlines.
  if (slides.length + 2 < min && slides.length >= 2) {
    const summary = emptySlide('summary', words.recap);
    summary.bullets = slides.map((s) => s.headline.replace(/ \(cont\.\)$/, '')).slice(0, patterns.density.maxBulletsAnySlide);
    slides.push(summary);
  }

  return {
    ...plan,
    title: plan.title.trim() || hook.headline,
    slides: [hook, ...slides, cta].map(clampSlide),
    hashtags: plan.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, '')).slice(0, 15),
  };
}
