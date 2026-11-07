import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, rebuildSlide } from '@/engine/layout';
import { invertPalette } from '@/engine/layout/context';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { generatePlan } from '@/engine/generate';
import { buildUserMessage } from '@/engine/prompt';
import { CAROUSEL_TYPES, readCarouselBrief, shapeForType } from '@/engine/carouselTypes';
import { templateVariations } from '@/engine/templatePicks';
import { interpretPrompt, themeFromBrief } from '@/engine/designPrompt';
import { findFont, getPalette, getPreset, getStyle, palettes, styles } from '@/styles';
import { contrast } from '@/styles/color';
import { FAITH_CATEGORIES, TEMPLATES, searchTemplates, themeFromTemplate } from '@/styles/templates';
import { loadIcons } from '@/styles/icons';
import type { SlideElement, TextElement } from '@/model/types';

beforeAll(() => loadIcons());

const TRINITY = `# The Trinity almost tore the church apart

And one of its oldest errors is still taught with water, ice and steam.

## Three questions
- Is Jesus truly God?
- Are the three distinct?
- How is God still one?

## Jesus did not become God
Adoptionism taught that Jesus began as a man and was later adopted as God's Son.

## God does not change masks
Modalism says one divine person plays three successive roles. But at Jesus' baptism the Son stands in the water, the Spirit descends and the Father speaks.

> In the beginning was the Word, and the Word was with God, and the Word was God. — John 1:1`;

const texts = (els: SlideElement[]) => els.filter((e): e is TextElement => e.kind === 'text');
const bgColor = (s: { background: { type: string; color?: string } }) => (s.background.type === 'solid' ? s.background.color : undefined);

describe('template catalog', () => {
  it('has at least 200 templates with unique ids and valid styles, palettes and fonts', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(200);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    const pal = new Set(palettes.map((p) => p.id));
    for (const t of TEMPLATES) {
      expect(() => getStyle(t.styleId)).not.toThrow();
      expect(pal.has(t.paletteId), t.id).toBe(true);
      expect(findFont(t.headingFont), t.id).toBeTruthy();
      expect(findFont(t.bodyFont), t.id).toBeTruthy();
      expect(t.types.every((x) => CAROUSEL_TYPES.some((c) => c.id === x)), t.id).toBe(true);
    }
    // Every style is used by some template, and the faith families are well covered.
    for (const s of styles) expect(TEMPLATES.some((t) => t.styleId === s.id), s.id).toBe(true);
    expect(TEMPLATES.filter((t) => FAITH_CATEGORIES.includes(t.category)).length).toBeGreaterThanOrEqual(120);
  });

  it('no two templates are the same design', () => {
    const keys = TEMPLATES.map((t) => JSON.stringify([t.styleId, t.paletteId, t.headingFont, t.bodyFont, t.modifiers ?? {}]));
    expect(new Set(keys).size).toBe(TEMPLATES.length);
  });

  it('every template lays out a carousel with all text inside the canvas', () => {
    const plan = shapeForType(planFromText(TRINITY, defaultOptions), 'doctrine-explainer');
    const preset = getPreset('instagram-portrait-4x5');
    for (const t of TEMPLATES) {
      const c = buildCarousel({ plan, presetId: preset.id, theme: themeFromTemplate(t, { handle: '@church' }) });
      expect(c.slides.length).toBe(plan.slides.length);
      for (const s of c.slides) {
        for (const e of texts(s.elements)) {
          if (/^panorama-/.test(e.slot ?? '')) continue;
          expect(e.x, `${t.id} ${e.slot}`).toBeGreaterThanOrEqual(-1);
          expect(e.y + e.height, `${t.id} ${e.slot}`).toBeLessThanOrEqual(preset.height + 1);
        }
      }
    }
  });

  it('search finds templates by look and purpose', () => {
    expect(searchTemplates('engraving').length).toBeGreaterThan(5);
    expect(searchTemplates('crimson').length).toBeGreaterThan(2);
    expect(searchTemplates('kids sky').some((t) => t.category === 'kids')).toBe(true);
  });
});

describe('editorial theology look (from the reference posts)', () => {
  const plan = shapeForType(planFromText(TRINITY, defaultOptions), 'doctrine-explainer');
  const theme = { ...themeFromTemplate(TEMPLATES.find((t) => t.styleId === 'theology-editorial')!), handle: '@studio', series: 'Theology / Early Church' };
  const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme });

  it('alternates cream and ink slides', () => {
    expect(bgColor(c.slides[0]!)).toBe(getPalette('codex-crimson').colors.bg);
    expect(bgColor(c.slides[1]!)).not.toBe(bgColor(c.slides[0]!));
    expect(bgColor(c.slides[2]!)).toBe(bgColor(c.slides[0]!));
  });

  it('draws the editorial header and footer: handle, page count, series, swipe', () => {
    const t0 = texts(c.slides[0]!.elements).map((e) => e.text);
    expect(t0).toContain('@STUDIO');
    expect(t0).toContain(`01 / ${String(c.slides.length).padStart(2, '0')}`);
    expect(t0).toContain('THEOLOGY / EARLY CHURCH');
    expect(t0.some((x) => /SWIPE/.test(x))).toBe(true);
    const t2 = texts(c.slides[2]!.elements).map((e) => e.text);
    expect(t2).toContain('STUDIO  /  03');
    expect(c.slides[2]!.elements.filter((e) => e.slot === 'slide-number-rule').length).toBe(2);
  });

  it('labels slides with a dash kicker, rules under headlines and italic serif body', () => {
    const s2 = c.slides[2]!;
    const kicker = texts(s2.elements).find((e) => e.slot === 'kicker');
    expect(kicker?.text).toMatch(/CLAIM 0\d/);
    const dash = s2.elements.find((e) => e.slot === 'kicker-dash')!;
    expect(dash).toBeTruthy();
    expect(dash.x + dash.width).toBeLessThan(kicker!.x);
    expect(c.slides.some((s) => s.elements.some((e) => e.slot === 'headline-rule'))).toBe(true);
    const body = texts(c.slides.flatMap((s) => s.elements)).find((e) => e.slot === 'body');
    expect(body?.italic).toBe(true);
  });

  it('keeps text readable on the inverted (dark) slides', () => {
    for (const p of palettes) {
      const inv = invertPalette(p.colors);
      expect(contrast(inv.text, inv.bg), p.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(inv.mutedText, inv.bg), p.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(inv.primary, inv.bg), p.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('rebuilding one slide keeps its light/dark place in the rhythm', () => {
    const s1 = rebuildSlide(plan, 'instagram-portrait-4x5', theme, 1);
    expect(bgColor(s1)).toBe(bgColor(c.slides[1]!));
  });
});

describe('what kind of carousel', () => {
  it('reads the type, slide count and series from a description', () => {
    const b = readCarouselBrief('A 10-slide doctrine explainer on the Trinity and early heresies, series: Theology / Early Church');
    expect(b.typeId).toBe('doctrine-explainer');
    expect(b.slideCount).toBe(10);
    expect(b.series).toBe('Theology / Early Church');
    expect(readCarouselBrief('tell the story of David and Goliath for kids').typeId).toBe('bible-story');
    expect(readCarouselBrief('myths people believe about prayer').typeId).toBe('myth-vs-truth');
    expect(readCarouselBrief('anything', 'sermon-recap').typeId).toBe('sermon-recap');
  });

  it('tells the AI how to structure it, with the author’s own words', () => {
    const m = buildUserMessage('text', { ...defaultOptions, carouselType: 'doctrine-explainer', carouselBrief: 'one heresy per slide' });
    expect(m.content).toMatch(/Carousel type: Doctrine explainer/);
    expect(m.content).toMatch(/one heresy per slide/);
    expect(buildUserMessage('text', defaultOptions).content).not.toMatch(/Carousel type/);
  });

  it('shapes the offline plan: numbered kickers and hints, keeping existing ones', async () => {
    const r = await generatePlan(TRINITY, { ...defaultOptions, carouselType: 'church-history' }, 'rules', []);
    const middle = r.plan.slides.slice(1, -1).filter((s) => s.role !== 'summary');
    expect(middle[0]!.kicker).toBe('CHAPTER 01');
    expect(middle.every((s) => s.layoutHint)).toBe(true);
    const p = planFromText(TRINITY, defaultOptions);
    p.slides[1]!.kicker = 'AD 325 / NICAEA';
    expect(shapeForType(p, 'church-history').slides[1]!.kicker).toBe('AD 325 / NICAEA');
  });

  it('suggests templates made for the type, the chosen template first, distinct styles', () => {
    const plan = planFromText(TRINITY, defaultOptions);
    const v = templateVariations(plan, { count: 4, typeId: 'doctrine-explainer' });
    expect(v).toHaveLength(4);
    expect(new Set(v.map((x) => x.theme.styleId)).size).toBe(4);
    expect(TEMPLATES.find((t) => t.id === v[0]!.theme.templateId)!.types).toContain('doctrine-explainer');
    const chosen = TEMPLATES.find((t) => t.styleId === 'bible-comic')!;
    expect(templateVariations(plan, { count: 3, templateId: chosen.id, typeId: 'bible-story' })[0]!.theme.templateId).toBe(chosen.id);
    // Story types turn pictures on.
    const story = templateVariations(plan, { count: 3, typeId: 'bible-story', templateId: TEMPLATES.find((t) => t.styleId === 'theology-editorial')!.id });
    expect(story[0]!.theme.modifiers?.illustrations).toBe('story');
    // New designs keep coming.
    const a = templateVariations(plan, { count: 4, seed: 1 }).map((x) => x.theme.templateId);
    const b = templateVariations(plan, { count: 4, seed: 2 }).map((x) => x.theme.templateId);
    expect(a.join()).not.toBe(b.join());
  });

  it('design prompts reach the new looks and options', () => {
    const it1 = interpretPrompt('theology editorial with engraved illustrations, alternating cream and black slides');
    expect(it1.brief.styleId).toBe('theology-editorial');
    expect(it1.brief.art).toBe('engraving');
    expect(it1.brief.rhythm).toBe('alternate');
    const th = themeFromBrief(it1.brief, 'minimal-swiss');
    expect(th.modifiers).toMatchObject({ art: 'engraving', rhythm: 'alternate' });
    expect(interpretPrompt('illuminated manuscript, gold').brief.styleId).toBe('manuscript-codex');
    expect(interpretPrompt('linocut poster').brief.styleId).toBe('woodcut-poster');
  });
});
