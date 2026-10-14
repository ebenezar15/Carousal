import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { graphemes, isComplexScript, layoutText, lineHeightFor, tokenize, trackingFor } from '@/engine/layout/textLayout';
import { planFromText } from '@/engine/rules';
import { defaultOptions, type AIProvider } from '@/engine/types';
import { decodeTags, encodeTags, reconcile, stripTags } from '@/engine/translate/tags';
import {
  aiTranslator, applyTranslation, batchUnits, collectUnits, fitTranslated, memoryPairs, translateUnits, type Accepted, type TranslationMemory, type Translator,
} from '@/engine/translate';
import { categoryOf, isRtlLang, isRtlText, parseRange, scriptForLang, scripts, subsetsForText } from '@/styles/scriptFonts';
import { loadIcons } from '@/styles/icons';
import type { Project, TextElement } from '@/model/types';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());

function project(): Project {
  const plan = planFromText(ARTICLE, defaultOptions);
  const carousel = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('bold-gradient') });
  return { id: 'p1', name: 'Hooks', createdAt: 1, updatedAt: 1, plan, carousel, altText: ['Cover slide'], settings: { presetId: 'instagram-portrait-4x5', tone: 'professional', audience: '', language: 'en', slideCount: 'auto', variationCount: 4 } };
}

const memory = (): TranslationMemory & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    async lookup(lang, sources) {
      return new Map(sources.filter((s) => data.has(`${lang}|${s}`)).map((s) => [s, data.get(`${lang}|${s}`)!]));
    },
    async store(lang, pairs) {
      pairs.forEach(([s, t]) => data.set(`${lang}|${s}`, t));
    },
  };
};

/** Fake translator: prefixes each word with "த" and keeps tags (like a well-behaved model). */
const fake = (): Translator & { seen: number } => {
  const t = {
    id: 'fake',
    label: 'Fake',
    seen: 0,
    async translate(units: { id: string; source: string }[]) {
      t.seen += units.length;
      return new Map(units.map((u) => [u.id, u.source.split(/(<\/?(?:em|s\d+)>)/).map((p) => (p.startsWith('<') ? p : p.replace(/[A-Za-z]+/g, (w) => `த${w}`))).join('')]));
    },
  };
  return t;
};

describe('style tags', () => {
  it('wraps emphasis phrases and spans, and decodes them onto translated text', () => {
    const tagged = encodeTags({ text: 'Ship small, ship often', emphasis: ['small'], spans: [{ start: 12, end: 16, color: '#f00' }] });
    expect(tagged).toBe('Ship <em>small,</em> <s0>ship</s0> often');
    const d = decodeTags('சிறியதாக <em>அனுப்பு</em>, <s0>அடிக்கடி</s0>', [{ start: 12, end: 16, color: '#f00' }]);
    expect(d).toMatchObject({ text: 'சிறியதாக அனுப்பு, அடிக்கடி', emphasis: ['அனுப்பு'], ok: true });
    expect(d.spans).toEqual([{ start: 18, end: 26, color: '#f00' }]);
  });
  it('escapes markup-like text and flags broken tags', () => {
    expect(stripTags(encodeTags({ text: 'a <3 b & c' }))).toBe('a <3 b & c');
    expect(decodeTags('<em>x</s0>').ok).toBe(false);
    expect(decodeTags('<em>x').ok).toBe(false);
  });
  it('keeps styling on edited text where the styled words remain', () => {
    const d = decodeTags('ஒன்று <em>இரண்டு</em> <s0>மூன்று</s0>', [{ start: 0, end: 1, color: '#0f0' }]);
    expect(reconcile('மூன்று மற்றும் இரண்டு', d)).toEqual({ spans: [{ start: 0, end: 6, color: '#0f0' }], emphasis: ['இரண்டு'] });
  });
});

describe('multi-script text layout', () => {
  it('breaks Thai and CJK at word boundaries and keeps vowel signs with their consonant', () => {
    const th = tokenize('ทำไมการปล่อยงานเล็กๆ ถึงชนะ');
    expect(th.length).toBeGreaterThan(3);
    expect(th.slice(1).some((t) => t.glue)).toBe(true);
    expect(tokenize('Ship small').map((t) => t.glue)).toEqual([false, false]);
    expect(graphemes('வெளியீடுகள்')).toEqual(['வெ', 'ளி', 'யீ', 'டு', 'க', 'ள்']);
  });
  it('never tracks complex scripts and gives tall scripts more line height', () => {
    expect(trackingFor('தமிழ்', 4)).toBe(0);
    expect(trackingFor('LATIN', 4)).toBe(4);
    expect(isComplexScript('مرحبا')).toBe(true);
    expect(lineHeightFor('தமிழ்', 1)).toBe(1.3);
    expect(lineHeightFor('Latin', 1)).toBe(1);
  });
  it('mirrors right-to-left lines so the first word sits on the right', () => {
    const f = { fontId: 'inter', size: 40, weight: 400, italic: false, letterSpacing: 0 };
    const l = layoutText('مرحبا بالعالم', f, 2000, 1.2, ['بالعالم']);
    const [a, b] = l.lines[0]!.runs;
    expect(a!.text).toBe('مرحبا');
    expect(a!.x).toBeGreaterThan(b!.x);
  });
  it('maps languages to scripts and texts to font subsets', () => {
    expect(scriptForLang('ta-IN')?.id).toBe('tamil');
    expect(isRtlLang('ar')).toBe(true);
    expect(isRtlText('שלום')).toBe(true);
    expect([...subsetsForText('Hello தமிழ் Привет')]).toEqual(expect.arrayContaining(['tamil', 'cyrillic']));
    expect(subsetsForText('Plain Latin text').size).toBe(0);
    expect(categoryOf('playfair-display')).toBe('serif');
    expect(parseRange('U+0B82-0BFA,U+20B9')).toEqual([[0x0b82, 0x0bfa], [0x20b9, 0x20b9]]);
    for (const s of scripts) expect(Object.keys(s.fonts).sort()).toEqual(['display', 'handwriting', 'sans-serif', 'serif']);
  });
});

describe('carousel translation', () => {
  it('collects unique strings once, including plan, caption and alt text', () => {
    const units = collectUnits(project());
    expect(units.length).toBeGreaterThan(5);
    expect(new Set(units.map((u) => u.source)).size).toBe(units.length);
    expect(units.some((u) => u.where === 'Alt text 1')).toBe(true);
    expect(units.some((u) => u.uses > 1)).toBe(true); // headline text appears in the slide and in the plan
  });

  it('uses memory first and only sends the rest to the translator', async () => {
    const p = project();
    const units = collectUnits(p);
    const mem = memory();
    await mem.store('ta', [[units[0]!.source, 'நினைவு']]);
    const tr = fake();
    const run = await translateUnits(units, 'ta', tr, mem);
    expect(run.fromMemory).toBe(1);
    expect(tr.seen).toBe(units.length - 1);
    expect(run.results.get(units[0]!.id)).toEqual({ tagged: 'நினைவு', origin: 'memory' });
  });

  it('marks failures instead of throwing, and does not remember untranslated text', async () => {
    const units = collectUnits(project());
    const broken: Translator = { id: 'x', label: 'x', translate: async () => { throw new Error('rate limited'); } };
    const run = await translateUnits(units, 'ta', broken, null);
    expect(run).toMatchObject({ failed: units.length, error: 'rate limited' });
    const accepted: Accepted = new Map(units.map((u) => [u.id, { tagged: u.source, text: u.plain }]));
    expect(memoryPairs(units, accepted)).toEqual([]);
  });

  it('builds a translated copy with the same design and translated plan', async () => {
    const p = project();
    const units = collectUnits(p);
    const run = await translateUnits(units, 'ta', fake(), null);
    const accepted: Accepted = new Map(units.map((u) => [u.id, { tagged: run.results.get(u.id)!.tagged, text: stripTags(run.results.get(u.id)!.tagged) }]));
    const copy = await applyTranslation(p, units, accepted, 'ta', 'Fake');
    expect(copy.id).not.toBe(p.id);
    expect(copy.name).toBe('Hooks · தமிழ்');
    expect(copy.translation).toMatchObject({ fromId: 'p1', lang: 'ta' });
    expect(p.carousel.slides[0]!.elements.find((e) => e.kind === 'text' && /த/.test(e.text))).toBeUndefined(); // original untouched
    copy.carousel.slides.forEach((s, i) => {
      const orig = p.carousel.slides[i]!.elements;
      expect(s.elements.map((e) => [e.kind, e.x, e.y, e.width])).toEqual(orig.map((e) => [e.kind, e.x, e.y, e.width]));
    });
    const headline = copy.carousel.slides[0]!.elements.find((e): e is TextElement => e.kind === 'text' && e.slot === 'headline')!;
    expect(headline.text).toMatch(/த/);
    expect((copy.plan as { language: string }).language).toBe('ta');
    expect((copy.plan as { slides: { headline: string }[] }).slides[0]!.headline).toMatch(/த/);
    expect(copy.altText![0]).toBe('தCover தslide');
  });

  it('mirrors alignment for right-to-left languages', async () => {
    const p = project();
    const units = collectUnits(p);
    const accepted: Accepted = new Map(units.map((u) => [u.id, { tagged: 'نص', text: 'نص' }]));
    const copy = await applyTranslation(p, units, accepted, 'ar', 'Fake');
    const before = p.carousel.slides.flatMap((s) => s.elements).filter((e): e is TextElement => e.kind === 'text' && e.align === 'left').length;
    const after = copy.carousel.slides.flatMap((s) => s.elements).filter((e): e is TextElement => e.kind === 'text' && e.align === 'right').length;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('shrinks text that no longer fits its box before growing it', () => {
    const el: TextElement = { id: 't', kind: 'text', x: 0, y: 0, width: 300, height: 60, rotation: 0, opacity: 1, text: 'மிகவும் நீளமான மொழிபெயர்க்கப்பட்ட தலைப்பு வாக்கியம்', fontId: 'inter', fontSize: 40, fontWeight: 700, italic: false, fill: '#000', align: 'left', verticalAlign: 'top', lineHeight: 1.1, letterSpacing: 0, textCase: 'none', autoFit: false };
    const fitted = fitTranslated(el);
    expect(fitted.fontSize).toBeLessThan(40);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(22);
    expect(fitTranslated({ ...el, text: 'சிறிய', height: 200 })).toMatchObject({ fontSize: 40, height: 200 });
  });

  it('batches by size and repairs a batch whose answer missed an item', async () => {
    expect(batchUnits([{ source: 'a'.repeat(5) }, { source: 'b'.repeat(5) }, { source: 'c'.repeat(5) }], 10).map((b) => b.length)).toEqual([2, 1]);
    const complete = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ items: [{ id: 't1', text: 'ஒன்று' }] }))
      .mockResolvedValueOnce(JSON.stringify({ items: [{ id: 't1', text: 'ஒன்று' }, { id: 't2', text: '<em>இரண்டு</em>' }] }));
    const provider: AIProvider = { id: 'claude', label: 'Claude', isAvailable: async () => true, complete };
    const out = await aiTranslator(provider).translate([{ id: 't1', source: 'one' }, { id: 't2', source: '<em>two</em>' }], 'ta', {});
    expect(out.get('t2')).toBe('<em>இரண்டு</em>');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[0]![0]).toMatchObject({ tier: 'fast' });
    expect(complete.mock.calls[1]![0].messages.at(-1).content).toContain('missing items: t2');
  });
});
