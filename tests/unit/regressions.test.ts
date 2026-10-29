import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { addSlide, applyTheme, continueAcross, deleteSlide, duplicateSlide, moveSlide } from '@/editor/ops';
import { TEXT_EFFECTS, currentEffect } from '@/editor/textEffects';
import { loadIcons } from '@/styles/icons';
import type { TextElement } from '@/model/types';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());
const plan = planFromText(ARTICLE, defaultOptions);
const doc = (styleId = 'minimal-swiss', extra = {}) => ({ carousel: buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: { ...themeFor(styleId), ...extra } }), plan });
const counter = (d: ReturnType<typeof doc>, i: number) => (d.carousel.slides[i]!.elements.find((e) => e.slot === 'slide-number') as TextElement | undefined)?.text;

describe('text effects never leave text invisible or stacked', () => {
  const pal = { bg: '#FFFFFF', surface: '#F4F4F5', text: '#111111', mutedText: '#52525B', primary: '#5B5BF0', accent: '#F97316', highlight: '#FDE047' };
  const base: TextElement = { id: 't', kind: 'text', x: 0, y: 0, width: 600, height: 100, rotation: 0, opacity: 1, text: 'Hello', fontId: 'inter', fontSize: 80, fontWeight: 700, italic: false, fill: '#222222', align: 'left', verticalAlign: 'top', lineHeight: 1.1, letterSpacing: 0, textCase: 'none', autoFit: false };
  const fx = (el: TextElement, id: string) => ({ ...el, ...TEXT_EFFECTS.find((f) => f.id === id)!.apply(el, pal) }) as TextElement;
  it('restores the original color after Outline or Neon', () => {
    for (const first of ['outline', 'neon']) for (const next of ['none', 'retro', 'extrude', 'glitch', 'echo', 'gradient']) {
      const el = fx(fx(base, first), next);
      expect(el.fill, `${first} → ${next}`).toBe('#222222');
      expect(currentEffect(el)).toBe(next);
    }
  });
  it("the highlighter's span goes away with the next effect, the user's own spans stay", () => {
    expect(fx(fx(base, 'highlighter'), 'glitch').spans).toBeUndefined();
    const rich = { ...base, spans: [{ start: 0, end: 2, color: '#FF0000' }] };
    expect(fx(rich, 'glitch').spans).toEqual(rich.spans);
  });
});

describe('slide operations keep the sequence right', () => {
  it('renumbers slides after add, duplicate, delete and move', () => {
    const d0 = doc();
    const n = d0.carousel.slides.length;
    const d1 = addSlide(d0, 0);
    expect(counter(d1, 2)).toContain(String(3));
    expect(counter(d1, 2)).toContain(String(n + 1));
    const d2 = deleteSlide(duplicateSlide(d0, 1), 0);
    expect(d2.carousel.slides).toHaveLength(n);
    expect(counter(d2, 0)).toContain('1');
    const d3 = moveSlide(d0, 0, 2);
    expect(counter(d3, 0)).toContain('1');
  });
  it('re-slices continuous backgrounds and keeps per-slide layouts with their slides', () => {
    const d0 = doc('bold-gradient', { modifiers: { panoramic: true, continuous: 'ribbon' }, layoutOverrides: { 2: 'body-card' } });
    const d1 = addSlide(d0, 0);
    expect(d1.carousel.slides.map((s) => s.background.span?.index)).toEqual(d1.carousel.slides.map((_, i) => i));
    expect(d1.carousel.slides.every((s) => s.background.span?.count === d1.carousel.slides.length)).toBe(true);
    expect(d1.carousel.theme.layoutOverrides).toEqual({ 3: 'body-card' });
  });
  it('a duplicated slide follows theme changes like the original', () => {
    const d = duplicateSlide(doc(), 1);
    expect(d.carousel.slides[2]!.manual).toBeFalsy();
    const re = applyTheme(d, themeFor('neo-pop'));
    expect(re.carousel.slides[2]!.background).toEqual(re.carousel.slides[1]!.background);
  });
  it('"Continue on next slide" twice does not stack copies', () => {
    const d = doc();
    const el = d.carousel.slides[1]!.elements[0]!;
    const once = continueAcross(d, 1, el.id, 'next', 1080);
    expect(continueAcross(once, 1, el.id, 'next', 1080)).toBe(once);
  });
});

describe('layout fixes', () => {
  it('continuous drawings still run when decorations are off (Plain)', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('minimal-swiss'), modifiers: { background: 'plain', decoration: 'none', panoramic: true, continuous: 'ribbon' } } });
    expect(c.slides.every((s) => s.elements.some((e) => e.slot === 'panorama-ribbon'))).toBe(true);
  });
  it('the split cover keeps the emphasized word visible on the colored block', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('editorial-bold') });
    const h = c.slides[0]!.elements.find((e) => e.slot === 'headline') as TextElement;
    const block = c.slides[0]!.elements.find((e) => e.slot === 'split-block') as { fill: string } | undefined;
    if (block && h.emphasis) expect(h.emphasis.color.toLowerCase()).not.toBe(block.fill.toLowerCase());
  });
});
