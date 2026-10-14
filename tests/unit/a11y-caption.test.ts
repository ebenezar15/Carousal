import { describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions, type AIProvider } from '@/engine/types';
import { checkCarousel, isLargeText, modelSampler } from '@/editor/accessibility';
import { CAPTION_RULES, altTextFor, captionText, generateCaption, keywordHashtags, rulesCaption } from '@/engine/caption';
import type { Carousel, TextElement } from '@/model/types';
import { newId } from '@/model/id';
import { ARTICLE } from './fixtures';

const plan = planFromText(ARTICLE, defaultOptions);
const base = (): Carousel => buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('minimal-swiss') });
const text = (patch: Partial<TextElement>): TextElement => ({
  id: newId('el_'), kind: 'text', x: 200, y: 400, width: 600, height: 120, rotation: 0, opacity: 1, text: 'Hello readable world', fontId: 'inter', fontSize: 44, fontWeight: 400,
  italic: false, fill: '#111111', align: 'left', verticalAlign: 'top', lineHeight: 1.3, letterSpacing: 0, textCase: 'none', autoFit: false, ...patch,
});

describe('accessibility checker', () => {
  it('passes a generated carousel on a solid background', async () => {
    const issues = await checkCarousel(base(), modelSampler);
    expect(issues.filter((i) => i.kind === 'contrast' || i.kind === 'size')).toEqual([]);
  });

  it('flags low contrast with a fix that meets the ratio', async () => {
    const c = base();
    const bad = text({ fill: '#E8E4DC' }); // near the cream background
    c.slides[1]!.elements.push(bad);
    const issues = await checkCarousel(c, modelSampler);
    const issue = issues.find((i) => i.elementId === bad.id && i.kind === 'contrast')!;
    expect(issue.severity).toBe('error');
    expect((issue.fix?.patch as Partial<TextElement>).fill).toBeTruthy();
    c.slides[1]!.elements = c.slides[1]!.elements.map((e) => (e.id === bad.id ? { ...e, ...issue.fix!.patch } as TextElement : e));
    expect((await checkCarousel(c, modelSampler)).some((i) => i.elementId === bad.id && i.kind === 'contrast')).toBe(false);
  });

  it('uses the 3:1 large-text threshold for big headlines', async () => {
    expect(isLargeText({ fontSize: 80, fontWeight: 400 }, 1)).toBe(true);
    expect(isLargeText({ fontSize: 40, fontWeight: 700 }, 1)).toBe(false);
    const c = base();
    const mid = text({ fill: '#8A8A8A', fontSize: 90, fontWeight: 800, text: 'Big' }); // ~3.2:1 on cream
    c.slides[1]!.elements.push(mid);
    expect((await checkCarousel(c, modelSampler)).some((i) => i.elementId === mid.id && i.kind === 'contrast')).toBe(false);
  });

  it('checks every gradient stop', async () => {
    const c = base();
    const g = text({ fillGradient: { angle: 90, stops: [{ offset: 0, color: '#111111' }, { offset: 1, color: '#F2EEE6' }] } });
    c.slides[1]!.elements.push(g);
    expect((await checkCarousel(c, modelSampler)).some((i) => i.elementId === g.id && i.kind === 'contrast')).toBe(true);
  });

  it('flags tiny text, safe-zone overflow, missing alt text and slide limits', async () => {
    const c = base();
    const tiny = text({ fontSize: 20 });
    const edge = text({ x: 2, y: 2 });
    c.slides[2]!.elements.push(tiny, edge, { id: 'img', kind: 'image', src: 'asset:x', fit: 'cover', x: 300, y: 300, width: 200, height: 200, rotation: 0, opacity: 1 });
    c.slides = [...c.slides, ...Array.from({ length: 15 }, () => structuredClone(c.slides[1]!))];
    const issues = await checkCarousel(c, modelSampler);
    expect(issues.find((i) => i.elementId === tiny.id && i.kind === 'size')?.severity).toBe('error');
    expect(issues.some((i) => i.elementId === edge.id && i.kind === 'safe-zone')).toBe(true);
    expect(issues.some((i) => i.elementId === 'img' && i.kind === 'alt-text')).toBe(true);
    expect(issues.some((i) => i.kind === 'slide-count')).toBe(true);
    expect(issues[0]!.severity).toBe('error'); // sorted by severity
  });
});

describe('caption writer', () => {
  const opts = { platform: 'instagram', tone: 'professional' as const, length: 'medium' as const, emoji: false, cta: true, language: 'auto' };

  it('builds a caption with takeaways, CTA and keyword hashtags offline', () => {
    const r = rulesCaption(plan, opts);
    expect(r.caption.split('\n')[0]).toContain('Hooks');
    expect(r.caption).toMatch(/Save this/);
    expect(r.hashtags.length).toBeGreaterThanOrEqual(3);
    expect(r.hashtags.length).toBeLessThanOrEqual(5);
    for (const h of r.hashtags) expect(h).toMatch(/^#\p{Lu}[\p{L}\p{N}]+$/u);
    expect(r.altText).toHaveLength(plan.slides.length);
  });

  it('respects the X 280-character limit including hashtags', () => {
    const r = rulesCaption(plan, { ...opts, platform: 'x', length: 'long' });
    expect(captionText(r.caption, r.hashtags, 'x').length).toBeLessThanOrEqual(CAPTION_RULES.x!.maxChars);
  });

  it('keyword hashtags skip stop words', () => {
    const tags = keywordHashtags(plan, 8).map((t) => t.toLowerCase());
    for (const stop of ['#the', '#with', '#your', '#that']) expect(tags).not.toContain(stop);
    expect(tags).toContain('#hooks');
  });

  it('alt text describes each slide including stats and quotes', () => {
    const alt = altTextFor(plan);
    expect(alt.some((a) => a.includes('72%'))).toBe(true);
    expect(alt.some((a) => a.startsWith('Slide 1 of'))).toBe(true);
  });

  it('uses the AI result when available and falls back with a notice on failure', async () => {
    const ok: AIProvider = { id: 'ollama', label: 'Fake', isAvailable: async () => true, complete: async () => JSON.stringify({ caption: 'AI caption', hashtags: ['growth', '#Hooks'], altText: plan.slides.map((_, i) => `alt ${i}`) }) };
    const r = await generateCaption(plan, opts, 'auto', [ok]);
    expect(r).toMatchObject({ caption: 'AI caption', hashtags: ['#growth', '#Hooks'], provider: 'ollama' });
    const broken: AIProvider = { ...ok, complete: async () => { throw new Error('down'); } };
    const f = await generateCaption(plan, opts, 'auto', [broken]);
    expect(f.provider).toBe('rules');
    expect(f.notice).toContain('down');
  });
});
