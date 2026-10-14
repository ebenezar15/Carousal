import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { makeItMore, TEXTURE_CYCLE } from '@/engine/variations';
import { scripts, setScriptFontOverrides } from '@/styles/scriptFonts';
import { findFont } from '@/styles';
import { loadIcons } from '@/styles/icons';
import { TEXT_EFFECTS, currentEffect } from '@/editor/textEffects';
import type { TextElement } from '@/model/types';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());
const plan = planFromText(ARTICLE, defaultOptions);

describe('modern Tamil fonts', () => {
  it('maps Tamil only to fonts that render the reformed (modern) script', () => {
    const tamil = scripts.find((s) => s.id === 'tamil')!;
    const used = [...Object.values(tamil.fonts), ...(tamil.alternatives ?? [])];
    for (const old of ['noto-sans-tamil', 'noto-serif-tamil', 'anek-tamil', 'tiro-tamil']) expect(used).not.toContain(old);
    for (const id of tamil.alternatives!) expect(findFont(id)?.group).toBe('tamil'); // also selectable in the editor
  });
  it('switches the Tamil font override and reports changes once', () => {
    expect(setScriptFontOverrides({ tamil: 'mukta-malar' })).toBe(true);
    expect(setScriptFontOverrides({ tamil: 'mukta-malar' })).toBe(false);
    expect(setScriptFontOverrides({ tamil: '' })).toBe(true);
  });
});

describe('backgrounds', () => {
  const bgs = (modifiers: object) => buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('editorial-magazine'), modifiers } }).slides.map((s) => s.background);
  it('plain is one flat color with nothing on top', () => {
    for (const bg of bgs({ background: 'plain', decoration: 'none' })) {
      expect(bg.type).toBe('solid');
      expect(bg.pattern ?? bg.texture ?? bg.noise).toBeUndefined();
    }
  });
  it('applies texture and pattern overrides', () => {
    const [bg] = bgs({ texture: 'linen', textureAmount: 0.3, pattern: 'waves' });
    expect(bg!.texture).toEqual({ kind: 'linen', amount: 0.3 });
    expect(bg!.pattern?.kind).toBe('waves');
    expect(bgs({ texture: 'none', pattern: 'none' })[0]!.texture).toBeUndefined();
  });
  it('"Textured" cycles through textures and "Plain" clears them', () => {
    let theme = themeFor('minimal-swiss');
    theme = makeItMore(theme, 'textured');
    expect(theme.modifiers?.texture).toBe(TEXTURE_CYCLE[0]);
    theme = makeItMore(theme, 'textured');
    expect(theme.modifiers?.texture).toBe(TEXTURE_CYCLE[1]);
    theme = makeItMore(theme, 'plain');
    expect(theme.modifiers).toMatchObject({ background: 'plain', texture: 'none', pattern: 'none', decoration: 'none' });
  });
});

describe('text effects', () => {
  const el: TextElement = { id: 't', kind: 'text', x: 0, y: 0, width: 600, height: 100, rotation: 0, opacity: 1, text: 'Hello', fontId: 'inter', fontSize: 80, fontWeight: 700, italic: false, fill: '#111111', align: 'left', verticalAlign: 'top', lineHeight: 1.1, letterSpacing: 0, textCase: 'none', autoFit: false };
  const pal = { bg: '#FFFFFF', surface: '#F4F4F5', text: '#111111', mutedText: '#52525B', primary: '#5B5BF0', accent: '#F97316', highlight: '#FDE047' };
  it('each preset is recognised after applying it, and presets never stack', () => {
    for (const fx of TEXT_EFFECTS) {
      const applied = { ...el, ...fx.apply(el, pal) };
      expect(currentEffect(applied)).toBe(fx.id);
      const effectFields = ['extrude', 'glitch', 'echo', 'fillGradient'].filter((k) => applied[k as keyof TextElement] !== undefined);
      expect(effectFields.length).toBeLessThanOrEqual(1);
    }
  });
  it('neon adapts to light and dark backgrounds', () => {
    const neon = TEXT_EFFECTS.find((f) => f.id === 'neon')!;
    expect(neon.apply(el, pal).fill).toBe(pal.accent);
    expect(neon.apply(el, { ...pal, bg: '#0B1020' }).fill).toBe('#FFFFFF');
  });
});
