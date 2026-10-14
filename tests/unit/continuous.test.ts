import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { continueAcross } from '@/editor/ops';
import { getPreset } from '@/styles';
import { loadIcons } from '@/styles/icons';
import type { ContinuousStyle, SlideElement } from '@/model/types';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());

const plan = planFromText(ARTICLE, defaultOptions);
const PRESET = 'instagram-square-1x1';
const W = getPreset(PRESET).width;
const build = (continuous: ContinuousStyle) => buildCarousel({ plan, presetId: PRESET, theme: { ...themeFor('bold-gradient'), modifiers: { panoramic: true, continuous } } });

/** Element position in panorama coordinates (slide index × width + local x). */
const globalX = (el: SlideElement, slide: number) => el.x + slide * W;

describe('continuous slides', () => {
  it.each(['flow', 'ribbon', 'path', 'blocks', 'word'] as ContinuousStyle[])('%s: the shared drawing lines up exactly at every seam', (kind) => {
    const c = build(kind);
    const slots: Record<ContinuousStyle, string> = { flow: 'panorama-line', ribbon: 'panorama-ribbon', path: 'panorama-route', blocks: 'seam-block', word: 'panorama-word' };
    const slot = slots[kind];
    const per = c.slides.map((s, i) => s.elements.filter((e) => e.slot === slot).map((e) => Math.round(globalX(e, i))));
    expect(per.every((xs) => xs.length > 0)).toBe(true);
    if (kind === 'blocks') {
      // Each seam shape appears on both neighbouring slides at the same panorama position.
      for (let i = 0; i < per.length - 1; i++) expect(per[i]!.some((x) => per[i + 1]!.includes(x))).toBe(true);
    } else {
      // One drawing spans the panorama: same global x on every slide.
      expect(new Set(per.flat()).size).toBe(1);
    }
    expect(c.slides.every((s) => s.background.span)).toBe(true);
  });

  it('continues an element onto the next and previous slide, offset by one slide width', () => {
    const c = build('flow');
    const el = c.slides[1]!.elements[0]!;
    const next = continueAcross({ carousel: c, plan }, 1, el.id, 'next', W);
    const copy = next.carousel.slides[2]!.elements.at(-1)!;
    expect(copy.x).toBe(el.x - W);
    expect(copy.id).not.toBe(el.id);
    expect(copy.name).toMatch(/continued/);
    const prev = continueAcross({ carousel: c, plan }, 1, el.id, 'prev', W);
    expect(prev.carousel.slides[0]!.elements.at(-1)!.x).toBe(el.x + W);
    expect(continueAcross({ carousel: c, plan }, 0, el.id, 'prev', W)).toEqual({ carousel: c, plan });
  });
});
