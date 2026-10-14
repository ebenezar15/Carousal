import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor, LAYOUTS, ROLE_LAYOUTS } from '@/engine/layout';
import { makeCtx } from '@/engine/layout/context';
import { fitFontSize, layoutText } from '@/engine/layout/textLayout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { makeItMore, pickVariations } from '@/engine/variations';
import { emptySlide, type CarouselPlan } from '@/engine/schema';
import { getPalette, getPreset, styles } from '@/styles';
import { contrast } from '@/styles/color';
import { loadIcons } from '@/styles/icons';
import type { Carousel, SlideElement, TextElement } from '@/model/types';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());

const plan = planFromText(ARTICLE, defaultOptions);
const f = { fontId: 'inter', size: 40, weight: 400, italic: false, letterSpacing: 0 };
const PRESETS = ['instagram-portrait-4x5', 'instagram-square-1x1', 'linkedin-document-landscape-16x9', 'tiktok-photo-9x16'];

/** Text that carries content (not chrome or decoration labels drawn on top of shapes). */
const CONTENT = new Set(['headline', 'body', 'subline', 'bullet', 'bullet-number', 'stat-value', 'stat-label', 'stat-title', 'quote', 'attribution', 'kicker', 'step-number', 'step-label', 'hook-number', 'handle', 'tweet-text', 'recap-kicker']);
const CHROME = new Set(['slide-number', 'swipe-cue', 'swipe-cue-label']);

const texts = (els: SlideElement[]) => els.filter((e): e is TextElement => e.kind === 'text');
const intersects = (a: SlideElement, b: SlideElement) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

function assertSane(c: Carousel, label: string) {
  const { width: W, height: H } = getPreset(c.presetId);
  for (const [si, slide] of c.slides.entries()) {
    const ts = texts(slide.elements);
    const content = ts.filter((t) => CONTENT.has(t.slot ?? ''));
    const chrome = ts.filter((t) => CHROME.has(t.slot ?? ''));
    for (const t of ts) {
      const where = `${label} slide ${si + 1} (${slide.layoutId}) ${t.slot} "${t.text.slice(0, 30)}"`;
      expect(t.x, where).toBeGreaterThanOrEqual(0);
      expect(t.y, where).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width, where).toBeLessThanOrEqual(W + 1);
      expect(t.y + t.height, where).toBeLessThanOrEqual(H + 1);
    }
    for (let i = 0; i < content.length; i++) {
      for (let j = i + 1; j < content.length; j++) {
        expect(intersects(content[i]!, content[j]!), `${label} slide ${si + 1} (${slide.layoutId}): ${content[i]!.slot} overlaps ${content[j]!.slot}`).toBe(false);
      }
      for (const ch of chrome) expect(intersects(content[i]!, ch), `${label} slide ${si + 1} (${slide.layoutId}): ${content[i]!.slot} overlaps ${ch.slot}`).toBe(false);
    }
  }
}

describe('layoutText', () => {
  it('wraps within the max width and reports height = lines × line height', () => {
    const l = layoutText('one two three four five six seven eight nine ten', f, 200, 1.5);
    expect(l.lines.length).toBeGreaterThan(1);
    for (const line of l.lines) expect(line.width).toBeLessThanOrEqual(200);
    expect(l.height).toBeCloseTo(l.lines.length * 60);
  });
  it('respects explicit newlines', () => expect(layoutText('a\nb\nc', f, 1000, 1).lines).toHaveLength(3));
  it('hard-breaks words longer than the box', () => {
    for (const line of layoutText('x'.repeat(100), f, 200, 1).lines) expect(line.width).toBeLessThanOrEqual(200);
  });
  it('marks emphasized words as separate runs (case/punctuation-insensitive)', () => {
    expect(layoutText('Write decisions down.', f, 2000, 1, ['Decisions']).lines[0]!.runs.map((r) => [r.text, r.emphasized])).toEqual([
      ['Write', false], ['decisions', true], ['down.', false],
    ]);
  });
  it('fitFontSize finds the largest size that fits', () => {
    const r = fitFontSize('A fairly long headline that needs to fit', { fontId: 'inter', weight: 700, italic: false, letterSpacing: 0 }, { width: 400, height: 200 }, 1.1, 20, 200);
    expect(r.fits).toBe(true);
    const bigger = layoutText('A fairly long headline that needs to fit', { ...f, size: r.size + 1 }, 400, 1.1);
    expect(bigger.height > 200 || bigger.width > 400).toBe(true);
  });
});

describe('every style system', () => {
  const combos = styles.flatMap((s) => PRESETS.map((p) => [s.id, p] as const));
  it.each(combos)('%s on %s: inside canvas, no overlapping content, no overlap with chrome', (styleId, presetId) => {
    const c = buildCarousel({ plan, presetId, theme: themeFor(styleId) });
    expect(c.slides).toHaveLength(plan.slides.length);
    assertSane(c, `${styleId}/${presetId}`);
  });
});

/** A plan with one slide per role, rich enough for every layout. */
const allRoles: CarouselPlan = {
  title: 'Seven ways to ship faster', language: 'en', paletteMood: 'bold', caption: '', hashtags: [],
  slides: [
    { ...emptySlide('hook', '7 ways to ship faster without burning out', 'A field guide for small teams'), emphasis: ['faster'] },
    emptySlide('intro', 'Speed is a habit, not a sprint', 'Most teams slow down because work waits in queues, not because people are slow.'),
    { ...emptySlide('body', 'Write decisions down', 'A short written record of what we chose, why, and who owns it keeps everyone in the loop.'), iconKeywords: ['note'] },
    { ...emptySlide('list', 'What actually helps'), bullets: ['Smaller pull requests', 'Daily written updates', 'One owner per decision', 'Automate the boring checks'] },
    emptySlide('step', '1. Cut the batch size', 'Ship the smallest useful change, then iterate with real feedback.'),
    { ...emptySlide('stat', 'Small batches win'), stat: { value: '46%', label: 'fewer rollbacks with smaller changes' } },
    { ...emptySlide('quote', ''), quote: { text: 'Slow is smooth, smooth is fast.', attribution: 'Old proverb' } },
    { ...emptySlide('comparison', 'Before vs After'), bullets: ['Weekly big-bang releases', 'Manual QA', 'Daily small releases', 'Automated checks'] },
    { ...emptySlide('summary', 'Recap'), bullets: ['Smaller batches', 'Written updates', 'Clear owners'] },
    { ...emptySlide('cta', 'Save this for your next planning session', 'Share it with a teammate who needs it.') },
  ],
};

describe('every layout in the catalog', () => {
  const cases = Object.entries(ROLE_LAYOUTS).flatMap(([role, ids]) => ids.flatMap((id) => PRESETS.map((p) => [role, id, p] as const)));
  it('catalog covers every layout id', () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual(expect.arrayContaining([...new Set(Object.values(ROLE_LAYOUTS).flat())]));
  });
  it.each(cases)('%s → %s on %s', (role, layoutId, presetId) => {
    const index = allRoles.slides.findIndex((s) => s.role === role);
    for (const styleId of ['minimal-swiss', 'neo-pop', 'editorial-magazine']) {
      const c = buildCarousel({ plan: allRoles, presetId, theme: { ...themeFor(styleId), layoutOverrides: { [index]: layoutId }, handle: '@studio' } });
      expect(c.slides[index]!.layoutId).toBe(layoutId);
      assertSane(c, `${styleId}/${layoutId}`);
    }
  });
});

describe('readability', () => {
  it('body text stays at or above the mobile minimum (36px @1080)', () => {
    for (const s of styles) {
      const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor(s.id) });
      for (const sl of c.slides) for (const e of texts(sl.elements)) if (e.slot === 'body' || e.slot === 'bullet') expect(e.fontSize, `${s.id} ${e.slot}`).toBeGreaterThanOrEqual(36);
    }
  });

  it('background tints keep text contrast ≥ 4.5', () => {
    for (const s of styles) for (const pid of s.palettes) {
      const pal = getPalette(pid).colors;
      for (const mod of [undefined, { background: 'gradient' as const }, { background: 'mesh' as const }]) {
        const c = buildCarousel({ plan, presetId: 'instagram-square-1x1', theme: { ...themeFor(s.id, pid), modifiers: mod } });
        const bg = c.slides[1]!.background;
        const colors = bg.type === 'solid' || bg.type === 'image' ? [bg.color] : bg.type === 'mesh' ? [bg.base, ...bg.points.map((p) => p.color)] : bg.stops.map((x) => x.color);
        for (const col of colors) expect(contrast(pal.text, col), `${s.id}/${pid} ${bg.type} ${col}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('panoramic backgrounds', () => {
  it('span the whole carousel and shapes continue across seams', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('panoramic-flow') });
    const W = getPreset(c.presetId).width;
    c.slides.forEach((s, i) => expect(s.background.span).toEqual({ index: i, count: c.slides.length }));
    for (let seam = 1; seam < c.slides.length; seam++) {
      const left = c.slides[seam - 1]!.elements.filter((e) => e.slot === 'seam-shape').map((e) => e.x + e.width / 2);
      const right = c.slides[seam]!.elements.filter((e) => e.slot === 'seam-shape').map((e) => e.x + e.width / 2);
      expect(left).toContain(W);
      expect(right).toContain(0);
    }
  });
  it('can be toggled off by modifiers', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('panoramic-flow'), modifiers: { panoramic: false } } });
    expect(c.slides[0]!.background.span).toBeUndefined();
  });
});

describe('chrome', () => {
  it('hook has a swipe cue, last slide has none', () => {
    for (const s of styles) {
      const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor(s.id) });
      const cue = (i: number) => c.slides[i]!.elements.some((e) => e.slot?.startsWith('swipe') || e.slot === 'progress-dot' || e.slot === 'progress-fill' || e.slot === 'seam-shape');
      expect(cue(0), s.id).toBe(true);
      expect(c.slides.at(-1)!.elements.some((e) => e.slot?.startsWith('swipe')), s.id).toBe(false);
    }
  });
});

describe('variations', () => {
  it('picks distinct styles, palettes and heading fonts with a light/dark mix', () => {
    const v = pickVariations(plan, { count: 6, tone: 'professional' });
    expect(v).toHaveLength(6);
    expect(new Set(v.map((x) => x.theme.styleId)).size).toBe(6);
    expect(new Set(v.map((x) => x.theme.paletteId)).size).toBe(6);
    expect(new Set(v.map((x) => x.theme.headingFont)).size).toBe(6);
    const schemes = v.map((x) => getPalette(x.theme.paletteId).scheme);
    expect(schemes).toContain('dark');
    expect(schemes).toContain('light');
  });
  it('differ in layout logic, not just color', () => {
    const v = pickVariations(plan, { count: 4, tone: 'bold' });
    const hooks = new Set(v.map((x) => styles.find((s) => s.id === x.theme.styleId)!.roleLayouts.hook));
    expect(hooks.size).toBeGreaterThanOrEqual(3);
  });
  it('is deterministic per seed and changes with the seed', () => {
    const a = pickVariations(plan, { count: 4, tone: 'playful', seed: 1 }).map((x) => x.theme.styleId);
    expect(pickVariations(plan, { count: 4, tone: 'playful', seed: 1 }).map((x) => x.theme.styleId)).toEqual(a);
    const others = [2, 3, 4].map((seed) => pickVariations(plan, { count: 4, tone: 'playful', seed }).map((x) => x.theme.styleId).join());
    expect(others.some((o) => o !== a.join())).toBe(true);
  });
  it('honors a preferred style', () => {
    expect(pickVariations(plan, { count: 3, tone: 'bold', preferStyleId: 'quote-card' })[0]!.theme.styleId).toBe('quote-card');
  });
});

describe('make it more …', () => {
  const base = themeFor('neo-pop');
  it('bold enlarges type and strengthens emphasis', () => {
    const t = makeItMore(base, 'bold');
    expect(t.modifiers!.typeScale!).toBeGreaterThan(1);
    expect(t.modifiers!.headlineWeight).toBe(900);
  });
  it('minimal removes decoration and gradients', () => {
    const t = makeItMore(themeFor('bold-gradient'), 'minimal');
    expect(t.modifiers!.decoration).toBe('minimal');
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: t });
    expect(c.slides[0]!.background.type).toBe('solid');
  });
  it('colorful switches to a gradient/mesh background', () => {
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: makeItMore(themeFor('minimal-swiss'), 'colorful') });
    expect(['linear', 'mesh']).toContain(c.slides[0]!.background.type);
  });
  it('professional swaps casual fonts and calms decoration', () => {
    const t = makeItMore(themeFor('hand-drawn-notes'), 'professional');
    expect(t.headingFont).toBe('plus-jakarta-sans');
    expect(t.modifiers!.decoration).toBe('minimal');
    expect(makeCtx(plan, 'instagram-portrait-4x5', t).headline.rotateDeg).toBe(0);
  });
  it('every direction still lays out cleanly for every style', () => {
    for (const s of styles) for (const dir of ['bold', 'minimal', 'colorful', 'professional'] as const) {
      assertSane(buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: makeItMore(themeFor(s.id), dir) }), `${s.id}+${dir}`);
    }
  });
});
