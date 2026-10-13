import { describe, expect, it } from 'vitest';
import { buildCarousel } from '@/engine/layout/basic';
import { fitFontSize, layoutText } from '@/engine/layout/textLayout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { presets, styles, getPreset } from '@/styles';
import type { TextElement } from '@/model/types';
import { ARTICLE } from './fixtures';

const plan = planFromText(ARTICLE, defaultOptions);
const f = { fontId: 'inter', size: 40, weight: 400, italic: false, letterSpacing: 0 };

describe('layoutText', () => {
  it('wraps within the max width and reports height = lines × line height', () => {
    const l = layoutText('one two three four five six seven eight nine ten', f, 200, 1.5);
    expect(l.lines.length).toBeGreaterThan(1);
    for (const line of l.lines) expect(line.width).toBeLessThanOrEqual(200);
    expect(l.height).toBeCloseTo(l.lines.length * 60);
  });

  it('respects explicit newlines', () => {
    expect(layoutText('a\nb\nc', f, 1000, 1).lines).toHaveLength(3);
  });

  it('hard-breaks words longer than the box', () => {
    const l = layoutText('x'.repeat(100), f, 200, 1);
    for (const line of l.lines) expect(line.width).toBeLessThanOrEqual(200);
  });

  it('marks emphasized words as separate runs (case/punctuation-insensitive)', () => {
    const l = layoutText('Write decisions down.', f, 2000, 1, ['Decisions']);
    expect(l.lines[0]!.runs.map((r) => [r.text, r.emphasized])).toEqual([
      ['Write', false],
      ['decisions', true],
      ['down.', false],
    ]);
  });

  it('fitFontSize finds the largest size that fits', () => {
    const r = fitFontSize('A fairly long headline that needs to fit', { fontId: 'inter', weight: 700, italic: false, letterSpacing: 0 }, { width: 400, height: 200 }, 1.1, 20, 200);
    expect(r.fits).toBe(true);
    const bigger = layoutText('A fairly long headline that needs to fit', { ...f, size: r.size + 1 }, 400, 1.1);
    expect(bigger.height > 200 || bigger.width > 400).toBe(true);
  });
});

describe('buildCarousel', () => {
  const combos = styles.flatMap((s) => ['instagram-portrait-4x5', 'instagram-square-1x1', 'linkedin-document-landscape-16x9', 'tiktok-photo-9x16'].map((p) => [s.id, p] as const));

  it.each(combos)('%s on %s: text stays inside the canvas and blocks never overlap', (styleId, presetId) => {
    const c = buildCarousel({ plan, presetId, styleId });
    const { width: W, height: H } = getPreset(presetId);
    expect(c.slides).toHaveLength(plan.slides.length);
    for (const slide of c.slides) {
      const texts = slide.elements.filter((e): e is TextElement => e.kind === 'text');
      for (const t of texts) {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.x + t.width).toBeLessThanOrEqual(W);
        expect(t.y + t.height).toBeLessThanOrEqual(H);
      }
      const content = texts.filter((t) => !['slide-number', 'swipe-cue'].includes(t.slot ?? '')).sort((a, b) => a.y - b.y);
      for (let i = 1; i < content.length; i++) {
        expect(content[i]!.y, `${slide.role}: ${content[i]!.slot} overlaps ${content[i - 1]!.slot}`).toBeGreaterThanOrEqual(content[i - 1]!.y + content[i - 1]!.height);
      }
    }
  });

  it('uses the preset size and the style palette', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', styleId: 'dark-tech' });
    expect(c.presetId).toBe('instagram-portrait-4x5');
    expect(c.theme.paletteId).toBe('midnight-electric');
    expect(c.slides[0]!.background).toEqual({ type: 'solid', color: '#0B1020' });
  });

  it('keeps body text at or above the mobile minimum', () => {
    for (const p of presets.filter((x) => x.width === 1080)) {
      const c = buildCarousel({ plan, presetId: p.id, styleId: 'minimal-swiss' });
      for (const s of c.slides) for (const e of s.elements) if (e.kind === 'text' && e.slot === 'body') expect(e.fontSize).toBeGreaterThanOrEqual(36);
    }
  });
});
