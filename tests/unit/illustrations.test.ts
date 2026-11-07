import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { artFor } from '@/engine/art/topics';
import { emptySlide } from '@/engine/schema';
import { frameOf, slideHasAnimation } from '@/editor/animation';
import { loadIcons } from '@/styles/icons';
import type { GroupElement, SlideElement, TextElement } from '@/model/types';

beforeAll(() => loadIcons());

const devotional = planFromText(`# The Lord is my shepherd

> "The LORD is my shepherd; I shall not want." — Psalm 23:1

## He gives rest
He leads us beside still waters. Rest is trust.

## When the storm comes
Fear and worry feel loud, but he is with us in the boat.

## Read the Word daily
Open the Bible each morning before your phone.

## Prayer
Lord, be my shepherd today. Amen.`, defaultOptions);

const PRESETS = ['instagram-portrait-4x5', 'instagram-square-1x1', 'tiktok-photo-9x16', 'linkedin-document-landscape-16x9'];
const art = (els: SlideElement[]) => els.filter((e): e is GroupElement => e.kind === 'group' && e.slot === 'illustration');
const texts = (els: SlideElement[]) => els.filter((e): e is TextElement => e.kind === 'text');

describe('picking pictures from the words', () => {
  it('maps faith topics to scenes, poses and symbols (headline first)', () => {
    expect(artFor({ ...emptySlide('hook', 'The Lord is my shepherd', 'Psalm 23 for anxious days') })).toMatchObject({ kind: 'scene', scene: 'shepherd' });
    expect(artFor(emptySlide('body', 'When the storm comes', 'Fear feels loud'))).toMatchObject({ kind: 'scene', scene: 'storm-sea' });
    expect(artFor(emptySlide('body', 'Pray without ceasing', 'Talk to God through the day.'))).toMatchObject({ kind: 'character', pose: 'pray' });
    expect(artFor(emptySlide('body', 'The Holy Spirit', 'Our helper and comforter.'))).toMatchObject({ kind: 'prop', prop: 'dove' });
    expect(artFor(emptySlide('body', 'Quarterly revenue targets', 'Numbers for Q3.'))).toBeNull();
  });
  it('does not repeat a scene within a carousel', () => {
    expect(artFor(emptySlide('hook', 'Shepherd and sheep', ''), ['shepherd'])?.kind).not.toBe('scene');
  });
});

describe('illustrated slides', () => {
  it.each(['illustrated-story', 'bible-comic', 'sunday-light', 'night-prayer', 'scripture-serif', 'stained-glass', 'parchment'])('%s draws pictures that never cover the text', (styleId) => {
    for (const presetId of PRESETS) {
      const c = buildCarousel({ plan: devotional, presetId, theme: themeFor(styleId) });
      const withArt = c.slides.filter((s) => art(s.elements).length);
      expect(withArt.length, `${styleId} ${presetId}`).toBeGreaterThan(0);
      for (const s of withArt) {
        const pics = art(s.elements);
        for (const t of texts(s.elements).filter((t) => ['headline', 'body', 'subline', 'quote-text', 'attribution'].includes(t.slot ?? ''))) {
          for (const p of pics) {
            // Scene bands sit below/beside the text; characters and props beside or below it.
            const overlap = Math.max(0, Math.min(t.x + t.width, p.x + p.width) - Math.max(t.x, p.x)) * Math.max(0, Math.min(t.y + t.height, p.y + p.height) - Math.max(t.y, p.y));
            expect(overlap / (t.width * t.height), `${styleId} ${presetId} ${s.layoutId} ${t.slot}`).toBeLessThan(0.05);
          }
        }
      }
    }
  });
  it('story styles put a picture on every content slide; plain styles stay picture-free', () => {
    const story = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: themeFor('bible-comic') });
    expect(story.slides.filter((s) => (s.layoutId ?? '').startsWith('illus-') || (s.layoutId ?? '').startsWith('diagram-')).length).toBeGreaterThanOrEqual(story.slides.length - 2);
    const plain = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: themeFor('minimal-swiss') });
    expect(plain.slides.every((s) => !art(s.elements).length)).toBe(true);
    const off = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('illustrated-story'), modifiers: { illustrations: 'none' } } });
    expect(off.slides.every((s) => !art(s.elements).length)).toBe(true);
  });
  it('characters and scenes come alive in animations (moving parts loop)', () => {
    const c = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: themeFor('illustrated-story') });
    const slide = c.slides.find((s) => art(s.elements).some((g) => g.children.some((ch) => ch.anim?.loop)))!;
    expect(slide).toBeTruthy();
    expect(slideHasAnimation(slide)).toBe(true);
    const mover = (sl: typeof slide) => art(sl.elements).flatMap((g) => g.children).find((ch) => ch.anim?.loop)!;
    const a = frameOf(slide, 3).elements;
    const b = frameOf(slide, 3.4).elements;
    expect(mover({ ...slide, elements: a }).pose).not.toEqual(mover({ ...slide, elements: b }).pose);
  });
  it('different seeds draw different art for the same slide', () => {
    const a = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('illustrated-story'), seed: 1 } });
    const b = buildCarousel({ plan: devotional, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('illustrated-story'), seed: 2 } });
    const sig = (c: typeof a) => JSON.stringify(c.slides.map((s) => art(s.elements).map((g) => g.children.map((ch) => (ch.kind === 'path' ? ch.data[0] : '')))));
    expect(sig(a)).not.toBe(sig(b));
  });
});
