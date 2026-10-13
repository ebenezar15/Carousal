import { describe, expect, it } from 'vitest';
import { planFromText, parseBlocks } from '@/engine/rules';
import { CarouselPlanSchema } from '@/engine/schema';
import { defaultOptions } from '@/engine/types';
import { wordCount } from '@/engine/text';
import { patterns } from '@/styles';
import { ARTICLE } from './fixtures';

describe('parseBlocks', () => {
  it('recognizes headings, bullets, quotes and paragraphs', () => {
    const kinds = parseBlocks(ARTICLE).map((b) => b.kind);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('bullets');
    expect(kinds).toContain('quote');
    expect(kinds).toContain('para');
  });

  it('parses quote attribution', () => {
    const q = parseBlocks(ARTICLE).find((b) => b.kind === 'quote');
    expect(q).toMatchObject({ text: 'Clarity beats cleverness every single time.', attribution: 'A wise editor' });
  });
});

describe('planFromText (no-AI fallback)', () => {
  const plan = planFromText(ARTICLE, defaultOptions);

  it('produces a schema-valid plan', () => {
    expect(CarouselPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('starts with a hook and ends with a CTA', () => {
    expect(plan.slides[0]!.role).toBe('hook');
    expect(plan.slides[0]!.headline).toBe('How to Write Hooks That Stop the Scroll');
    expect(plan.slides.at(-1)!.role).toBe('cta');
  });

  it('keeps slide count within the design limits', () => {
    expect(plan.slides.length).toBeGreaterThanOrEqual(patterns.slideCount.min);
    expect(plan.slides.length).toBeLessThanOrEqual(12);
  });

  it('detects list, stat and quote roles', () => {
    const roles = plan.slides.map((s) => s.role);
    expect(roles).toContain('list');
    expect(roles).toContain('stat');
    expect(roles).toContain('quote');
    expect(plan.slides.find((s) => s.role === 'stat')!.stat!.value).toBe('72%');
  });

  it('respects per-role word limits', () => {
    for (const s of plan.slides) {
      const r = patterns.roles[s.role];
      expect(wordCount(s.body), `${s.role} body: ${s.body}`).toBeLessThanOrEqual(Math.max(r.bodyMaxWords, 8) + 1);
      if (r.headlineMaxWords) expect(wordCount(s.headline), `${s.role} headline`).toBeLessThanOrEqual(r.headlineMaxWords + 3);
    }
  });

  it('only emphasizes words that appear in the headline', () => {
    for (const s of plan.slides) for (const w of s.emphasis) expect(s.headline.toLowerCase()).toContain(w.toLowerCase());
  });

  it('honors an explicit slide count upper bound', () => {
    const small = planFromText(ARTICLE, { ...defaultOptions, slideCount: 4 });
    expect(small.slides.length).toBe(4);
    expect(small.slides[0]!.role).toBe('hook');
    expect(small.slides.at(-1)!.role).toBe('cta');
  });

  it('handles plain unstructured prose', () => {
    const p = planFromText(
      'Remote teams need written culture. Meetings do not scale across time zones. Write decisions down. Default to async updates. Use video only for nuance and relationship building, not for status.',
      defaultOptions,
    );
    expect(p.slides.length).toBeGreaterThanOrEqual(3);
    expect(p.slides[0]!.headline).toBe('Remote teams need written culture');
  });

  it('never throws on empty or odd input', () => {
    for (const input of ['', '   ', '-', '#', '>', '12345', 'a'.repeat(5000)]) {
      expect(() => planFromText(input, defaultOptions)).not.toThrow();
    }
  });
});
