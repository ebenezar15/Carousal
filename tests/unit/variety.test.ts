import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel } from '@/engine/layout';
import { planFromText, scriptureQuote } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { isFaithContent, pickVariations } from '@/engine/variations';
import { generatePalette } from '@/styles/generatePalette';
import { contrast } from '@/styles/color';
import { loadIcons } from '@/styles/icons';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());
const plan = planFromText(ARTICLE, defaultOptions);

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('endless designs', () => {
  it('generated palettes always meet the contrast rules', () => {
    for (let h = 0; h < 360; h += 15) for (const scheme of ['light', 'dark'] as const) for (const mood of ['pastel', 'bold', undefined]) {
      const { colors: c } = generatePalette(h, scheme, rng(h + 7), mood);
      expect(contrast(c.text, c.bg), `${h} ${scheme} ${mood}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.mutedText, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.primary, c.bg)).toBeGreaterThanOrEqual(3);
    }
  });
  it('every "New designs" press gives a different set, and designs rarely repeat', () => {
    const sig = (seed: number) => pickVariations(plan, { count: 4, tone: 'professional', seed }).map((v) => JSON.stringify([v.theme.styleId, v.theme.paletteId, v.theme.customPalette, v.theme.headingFont, v.theme.layoutOverrides, v.theme.modifiers])).join('|');
    const sets = new Set(Array.from({ length: 30 }, (_, i) => sig(i + 1)));
    expect(sets.size).toBe(30);
    const designs = new Set(Array.from({ length: 30 }, (_, i) => sig(i + 1).split('|')).flat());
    expect(designs.size).toBeGreaterThan(110); // of 120 designs, almost all unique
  });
  it('remixed designs still lay out cleanly', () => {
    for (let seed = 1; seed <= 12; seed++) for (const v of pickVariations(plan, { count: 4, tone: 'bold', seed })) {
      const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: v.theme });
      expect(c.slides).toHaveLength(plan.slides.length);
    }
  });
  it('styles shown recently step back', () => {
    const first = pickVariations(plan, { count: 4, tone: 'professional', seed: 0 }).map((v) => v.theme.styleId);
    const next = pickVariations(plan, { count: 4, tone: 'professional', seed: 0, recent: [...first, ...first] }).map((v) => v.theme.styleId);
    expect(next.filter((id) => first.includes(id)).length).toBeLessThan(first.length);
  });
});

describe('faith content', () => {
  const devotional = planFromText(`# The Lord is my shepherd

> "The LORD is my shepherd; I shall not want." — Psalm 23:1

## He gives rest
He leads us beside still waters. Rest is trust.

Psalm 23:6 — Surely goodness and mercy shall follow me all the days of my life.

## Prayer
Lord, be my shepherd today. Amen.`, defaultOptions);
  it('detects verses with their references and prayers', () => {
    expect(scriptureQuote('Love is patient, love is kind. (1 Corinthians 13:4 NIV)')).toEqual({ text: 'Love is patient, love is kind.', attribution: '1 Corinthians 13:4' });
    expect(scriptureQuote('We met on Sunday to talk about John.')).toBeNull();
    const quotes = devotional.slides.filter((s) => s.quote);
    expect(quotes.map((q) => q.quote!.attribution)).toEqual(['Psalm 23:1', 'Psalm 23:6']);
    expect(quotes.every((q) => q.layoutHint === 'verse')).toBe(true);
    expect(devotional.slides.some((s) => s.layoutHint === 'prayer')).toBe(true);
  });
  it('leads with faith styles for Christian content, not for other content', () => {
    expect(isFaithContent(devotional)).toBe(true);
    expect(isFaithContent(plan)).toBe(false);
    const faith = ['scripture-serif', 'stained-glass', 'parchment', 'sunday-light', 'illustrated-story', 'night-prayer', 'bible-comic'];
    const picks = pickVariations(devotional, { count: 4, tone: 'educational', seed: 0 }).map((v) => v.theme.styleId);
    expect(picks.filter((id) => faith.includes(id)).length).toBeGreaterThanOrEqual(2);
  });
});
