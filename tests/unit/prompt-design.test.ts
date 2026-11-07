import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildCarousel } from '@/engine/layout';
import { interpretPrompt, interpretPromptWithAI, needsAI, themeFromBrief, variationsFromBrief, STYLE_PROMPTS } from '@/engine/designPrompt';
import { planFromText } from '@/engine/rules';
import { defaultOptions, type AIProvider } from '@/engine/types';
import { detectLanguage } from '@/engine/phrases';
import { getPalette, getStyle } from '@/styles';
import { contrast } from '@/styles/color';
import { loadIcons } from '@/styles/icons';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());
const plan = planFromText(ARTICLE, defaultOptions);

describe('design prompts (offline)', () => {
  it('reads style, colors, texture, motion and continuity from plain words', () => {
    const { brief, understood } = interpretPrompt('Dreamy surreal look in pink with a ribbon across slides and kinetic type, no texture');
    expect(brief).toMatchObject({ styleId: 'surreal', hue: 335, continuous: 'ribbon', motion: 'kinetic', texture: 'none' });
    expect(understood).toContain('Surreal style');
  });
  it('maps each of the 10 style chips to its own style', () => {
    const ids = STYLE_PROMPTS.map((s) => interpretPrompt(s.prompt).brief.styleId);
    expect(ids).toEqual(['minimalism', 'maximalism', 'surreal', 'swiss-poster', 'editorial-bold', 'paper-cut', 'clay-3d', 'vector-art', 'handwritten-journal', 'graffiti-street']);
  });
  it('honors dark mode, a hex brand color and serif type', () => {
    const theme = themeFromBrief(interpretPrompt('clay, dark mode, #FF6600, serif').brief, 'minimal-swiss');
    expect(theme.styleId).toBe('clay-3d');
    const pal = theme.customPalette ?? getPalette(theme.paletteId).colors;
    expect(getPalette(theme.paletteId).scheme).toBe('dark');
    expect([pal.primary, pal.accent]).toContain('#FF6600');
    expect(contrast(pal.text, pal.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('picks a palette near the asked color', () => {
    const theme = themeFromBrief(interpretPrompt('vector art, green').brief, 'minimal-swiss');
    expect(theme.paletteId).toBe('vector-forest');
  });
  it('builds designs whose first follows the prompt and the rest share its wishes', () => {
    const v = variationsFromBrief(plan, interpretPrompt('graffiti, static, continuous').brief, { count: 4, tone: 'bold' });
    expect(v[0]!.theme.styleId).toBe('graffiti-street');
    expect(new Set(v.map((x) => x.theme.styleId)).size).toBe(4);
    for (const x of v) expect(x.theme).toMatchObject({ motion: 'none', modifiers: { panoramic: true, continuous: 'flow' } });
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: v[0]!.theme });
    expect(c.slides.every((s) => s.background.span)).toBe(true);
  });
  it('only asks the AI when the prompt has words it does not know', () => {
    expect(needsAI(interpretPrompt('minimalist, pastel, no animation'))).toBe(false);
    expect(needsAI(interpretPrompt('like a cozy rainy afternoon in a japanese stationery shop'))).toBe(true);
  });
  it('AI reading is one fast call, cached per prompt, and explicit words still win', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ styleId: 'paper-cut', scheme: 'light', mainColor: '#3366FF', font: 'style', texture: 'kraft', pattern: 'style', continuous: 'style', motion: 'paper' }));
    const provider: AIProvider = { id: 'claude', label: 'Claude', isAvailable: async () => true, complete };
    const prompt = 'cozy afternoon in a stationery shop, no animation';
    const a = await interpretPromptWithAI(prompt, provider);
    const b = await interpretPromptWithAI(prompt, provider);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0]![0]).toMatchObject({ tier: 'fast' });
    expect(a.brief).toMatchObject({ styleId: 'paper-cut', texture: 'kraft', motion: 'none' });
    expect(b.brief).toEqual(a.brief);
  });
});

describe('the 10 design styles', () => {
  it.each(['minimalism', 'maximalism', 'surreal', 'swiss-poster', 'editorial-bold', 'paper-cut', 'clay-3d', 'vector-art', 'handwritten-journal', 'graffiti-street'])('%s has typography, motion and its own motifs', (id) => {
    const s = getStyle(id);
    expect(s.motion).toBeTruthy();
    const c = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: { styleId: id, paletteId: s.palettes[0]!, headingFont: s.fonts.heading, bodyFont: s.fonts.body } });
    // Every slide is animated in the style's motion, and every palette keeps body text readable.
    expect(c.slides.every((sl) => sl.elements.some((e) => e.anim))).toBe(true);
    for (const p of s.palettes) expect(contrast(getPalette(p).colors.text, getPalette(p).colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('built-in rules in other languages', () => {
  it('detects the script and writes the CTA in that language', () => {
    expect(detectLanguage('தமிழ் ஒரு அழகான மொழி. இது பல நூற்றாண்டுகள் பழமையானது.')).toBe('ta');
    expect(detectLanguage('यह एक परीक्षण है')).toBe('hi');
    expect(detectLanguage('Plain English text')).toBe('en');
    const ta = planFromText('# தலைப்பு\n\nமுதல் பத்தி இங்கே உள்ளது. இரண்டாவது வாக்கியம்.\n\n- ஒன்று\n- இரண்டு\n- மூன்று', defaultOptions);
    expect(ta.language).toBe('ta');
    expect(ta.slides.at(-1)!.headline).toBe('இது பயனுள்ளதாக இருந்ததா?');
  });
  it('counts the ideas after trimming to the platform limit', () => {
    const p = planFromText(ARTICLE, { ...defaultOptions, maxSlides: 5 });
    expect(p.slides.length).toBeLessThanOrEqual(5);
    const m = /^(\d+) ideas/.exec(p.slides[0]!.body);
    if (m) expect(Number(m[1])).toBe(p.slides.length - 2);
  });
  it('condenses into one slide for single-frame formats (stories)', () => {
    const p = planFromText(ARTICLE, { ...defaultOptions, maxSlides: 1 });
    expect(p.slides).toHaveLength(1);
    expect(p.slides[0]!.bullets.length).toBeGreaterThan(0);
  });
});
