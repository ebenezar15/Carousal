// Picks N distinctly different designs for the same content: different style systems (layout logic,
// backgrounds, decorations), palettes and font pairings — chosen for fit with the tone/content, then
// greedily for diversity. Deterministic for a given seed ("New designs" bumps the seed).
import { findFont, fonts as allFonts, getPalette, getStyle, palettes, styles, type StyleSystem } from '@/styles';
import type { CarouselTheme, DesignModifiers } from '@/model/types';
import type { CarouselPlan } from './schema';
import type { Tone } from './types';

export interface Variation { theme: CarouselTheme; label: string }

const TONE_MOODS: Record<Tone, string[]> = {
  professional: ['professional', 'minimal', 'editorial', 'calm', 'data'],
  playful: ['playful', 'pastel', 'colorful', 'handdrawn', 'soft'],
  bold: ['bold', 'brutalist', 'colorful', 'energetic', 'dark'],
  educational: ['educational', 'data', 'professional', 'handdrawn', 'minimal'],
};

function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bgKind = (s: StyleSystem) => (s.layout.panoramic ? 'panoramic' : s.background.type);
const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

function contentBoost(s: StyleSystem, plan: CarouselPlan): number {
  const roles = plan.slides.map((x) => x.role);
  const count = (r: string) => roles.filter((x) => x === r).length;
  let b = 0;
  if (count('step') >= 2 && s.id === 'step-tutorial') b += 1.5;
  if (count('stat') >= 1 && s.moods.includes('data')) b += 1;
  if (count('quote') >= 2 && s.id === 'quote-card') b += 1;
  if (s.id === 'tweet-style') b -= 0.6; // niche look; still eligible
  return b;
}

export function pickVariations(plan: CarouselPlan, opts: { count: number; tone: Tone; seed?: number; preferStyleId?: string; handle?: string }): Variation[] {
  const rand = rng((opts.seed ?? 0) * 7919 + 17);
  const wanted = [...TONE_MOODS[opts.tone], plan.paletteMood];
  const scored = styles.map((s) => {
    const pm = s.palettes.flatMap((p) => getPalette(p).moods);
    return { s, base: overlap(s.moods, wanted) * 1.2 + Math.min(2, overlap(pm, wanted)) * 0.4 + contentBoost(s, plan) + rand() * 1.6 };
  });

  const picked: { s: StyleSystem; dark: boolean; heading: string; paletteId: string }[] = [];
  const n = Math.max(1, Math.min(6, opts.count));
  while (picked.length < n && picked.length < scored.length) {
    let best: { s: StyleSystem; score: number } | null = null;
    for (const { s, base } of scored) {
      if (picked.some((p) => p.s.id === s.id)) continue;
      let score = base;
      if (opts.preferStyleId === s.id && picked.length === 0) score += 100;
      for (const p of picked) {
        if (bgKind(p.s) === bgKind(s)) score -= 1;
        if (p.s.roleLayouts.hook === s.roleLayouts.hook) score -= 1.5;
        if (p.s.roleLayouts.body === s.roleLayouts.body) score -= 0.5;
        if (p.s.layout.alignment === s.layout.alignment) score -= 0.4;
        if (p.s.fonts.heading === s.fonts.heading) score -= 1;
      }
      if (!best || score > best.score) best = { s, score };
    }
    if (!best) break;
    const s = best.s;
    // Palette: mood fit, then alternate light/dark across the set.
    const darkCount = picked.filter((p) => p.dark).length;
    const wantDark = darkCount < picked.length / 2;
    const paletteId = [...s.palettes].sort((a, b) => {
      const pa = getPalette(a);
      const pb = getPalette(b);
      const sa = overlap(pa.moods, wanted) + ((pa.scheme === 'dark') === wantDark ? 0.8 : 0) + (picked.some((p) => p.paletteId === a) ? -3 : 0);
      const sb = overlap(pb.moods, wanted) + ((pb.scheme === 'dark') === wantDark ? 0.8 : 0) + (picked.some((p) => p.paletteId === b) ? -3 : 0);
      return sb - sa;
    })[0]!;
    // Fonts: primary pairing unless its heading font is already used by another variation.
    const pairs = [s.fonts, ...s.altFonts].filter((f) => findFont(f.heading) && findFont(f.body));
    const fontsPick = pairs.find((f) => !picked.some((p) => p.heading === f.heading)) ?? pairs[0] ?? s.fonts;
    picked.push({ s, dark: getPalette(paletteId).scheme === 'dark', heading: fontsPick.heading, paletteId });
  }

  return picked.map(({ s, paletteId }, i) => {
    const pairs = [s.fonts, ...s.altFonts].filter((f) => findFont(f.heading) && findFont(f.body));
    const f = pairs.find((x) => x.heading === picked[i]!.heading) ?? s.fonts;
    const theme: CarouselTheme = { styleId: s.id, paletteId, headingFont: f.heading, bodyFont: f.body, handle: opts.handle };
    theme.label = `${s.name} · ${getPalette(paletteId).name}`;
    return { theme, label: theme.label };
  });
}

export type MoreDirection = 'bold' | 'minimal' | 'colorful' | 'professional' | 'plain' | 'textured';

/** Order the "Textured" button cycles through. */
export const TEXTURE_CYCLE = ['paper', 'linen', 'watercolor', 'concrete', 'kraft', 'grunge', 'crumpled', 'terrazzo', 'canvas', 'stucco', 'riso', 'brushed'] as const;

/** Deterministic design transforms behind the "Make it more …" buttons (work offline). */
export function makeItMore(theme: CarouselTheme, dir: MoreDirection): CarouselTheme {
  const style = getStyle(theme.styleId);
  const m: DesignModifiers = { ...theme.modifiers };
  const current = getPalette(theme.paletteId);
  const byMood = (mood: string, pool: string[]) => pool.find((id) => id !== theme.paletteId && getPalette(id).moods.includes(mood));
  let paletteId = theme.paletteId;
  let headingFont = theme.headingFont;
  let bodyFont = theme.bodyFont;

  switch (dir) {
    case 'bold':
      m.typeScale = Math.min(1.45, (m.typeScale ?? 1) * 1.12);
      m.headlineWeight = 900;
      m.emphasis = m.emphasis === 'highlight' || style.layout.emphasis === 'highlight' ? 'box' : 'highlight';
      if (m.decoration === 'none' || m.decoration === 'minimal') m.decoration = 'normal';
      paletteId = byMood('bold', style.palettes) ?? byMood('bold', palettes.filter((p) => p.scheme === current.scheme).map((p) => p.id)) ?? paletteId;
      break;
    case 'minimal':
      m.decoration = m.decoration === 'minimal' ? 'none' : 'minimal';
      m.typeScale = Math.max(0.75, (m.typeScale ?? 1) * 0.92);
      m.marginDelta = Math.min(6, (m.marginDelta ?? 0) + 2);
      m.emphasis = 'color';
      m.background = 'solid';
      m.panoramic = false;
      paletteId = byMood('minimal', style.palettes) ?? byMood('minimal', palettes.filter((p) => p.scheme === current.scheme).map((p) => p.id)) ?? paletteId;
      break;
    case 'colorful':
      m.background = m.background === 'gradient' ? 'mesh' : 'gradient';
      m.decoration = 'rich';
      paletteId = byMood('colorful', style.palettes) ?? byMood('colorful', palettes.map((p) => p.id)) ?? paletteId;
      break;
    case 'plain':
      m.background = 'plain';
      m.decoration = 'none';
      m.texture = 'none';
      m.pattern = 'none';
      m.panoramic = false;
      break;
    case 'textured': {
      const at = TEXTURE_CYCLE.indexOf(m.texture as (typeof TEXTURE_CYCLE)[number]);
      m.texture = TEXTURE_CYCLE[(at + 1) % TEXTURE_CYCLE.length];
      m.textureAmount = undefined;
      if (m.background === 'plain') m.background = undefined;
      break;
    }
    case 'professional': {
      m.decoration = 'minimal';
      m.emphasis = 'color';
      m.headlineCase = 'none';
      m.background = 'solid';
      m.typeScale = Math.min(1, m.typeScale ?? 1);
      paletteId = byMood('professional', style.palettes) ?? byMood('professional', palettes.filter((p) => p.scheme === current.scheme).map((p) => p.id)) ?? byMood('professional', palettes.map((p) => p.id)) ?? paletteId;
      const casual = ['handwritten', 'playful', 'display-condensed'];
      const group = allFonts.find((f) => f.id === headingFont)?.group ?? '';
      if (casual.includes(group)) {
        headingFont = 'plus-jakarta-sans';
        bodyFont = 'inter';
      }
      break;
    }
  }
  const next: CarouselTheme = { ...theme, paletteId, headingFont, bodyFont, modifiers: m };
  next.label = `${style.name} · ${getPalette(paletteId).name}`;
  return next;
}
