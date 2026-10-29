// Picks N distinctly different designs for the same content: different style systems (layout logic,
// backgrounds, decorations), palettes and font pairings — chosen for fit with the tone/content, then
// greedily for diversity. Deterministic for a given seed ("New designs" bumps the seed).
import { findFont, fonts as allFonts, getPalette, getStyle, palettes, styles, type StyleSystem } from '@/styles';
import type { CarouselTheme, DesignModifiers } from '@/model/types';
import type { CarouselPlan } from './schema';
import type { Tone } from './types';
import { generatePalette } from '@/styles/generatePalette';
import { pairings } from '@/styles';
import { ROLE_LAYOUTS } from './layout/layouts';
import { SCRIPTURE_REF } from './art/topics';
import type { TextureKind } from '@/model/types';

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

const FAITH_WORDS = /\b(god|jesus|christ|lord|holy spirit|bible|scripture|gospel|prayer|pray|faith|church|psalm|grace|worship|sermon|amen|devotional|salvation|heaven)\b/i;

/** Christian content (scripture references or faith vocabulary on several slides). */
export function isFaithContent(plan: CarouselPlan): boolean {
  const text = plan.slides.map((s) => `${s.headline} ${s.body} ${s.bullets.join(' ')} ${s.quote?.text ?? ''} ${s.quote?.attribution ?? ''}`);
  return text.some((t) => SCRIPTURE_REF.test(t)) || text.filter((t) => FAITH_WORDS.test(t)).length >= Math.min(3, Math.ceil(plan.slides.length / 3));
}

function contentBoost(s: StyleSystem, plan: CarouselPlan): number {
  const roles = plan.slides.map((x) => x.role);
  const count = (r: string) => roles.filter((x) => x === r).length;
  let b = 0;
  if (count('step') >= 2 && s.id === 'step-tutorial') b += 1.5;
  if (count('stat') >= 1 && s.moods.includes('data')) b += 1;
  if (count('quote') >= 2 && s.id === 'quote-card') b += 1;
  if (s.id === 'tweet-style') b -= 0.6; // niche look; still eligible
  // Faith content leads with the faith styles (Scripture, Stained glass, Storybook…), mixed with others.
  if (s.moods.includes('faith')) b += isFaithContent(plan) ? 1.6 : -1.2;
  return b;
}

/**
 * Variations of `theme` for "New designs" beyond the first set: generated palettes, other font
 * pairings, per-slide layout alternatives, textures and decoration amounts. Each seed gives a new
 * combination, so the supply of designs never runs out and rarely repeats.
 */
export function remix(theme: CarouselTheme, plan: CarouselPlan, rand: () => number, wantDark: boolean, mood?: string): CarouselTheme {
  const style = getStyle(theme.styleId);
  const next: CarouselTheme = { ...theme, modifiers: { ...theme.modifiers } };
  const m = next.modifiers!;
  if (rand() < 0.45) {
    const g = generatePalette(Math.floor(rand() * 360), wantDark ? 'dark' : 'light', rand, mood);
    next.customPalette = g.colors;
    next.label = `${style.name} · ${g.name}`;
  }
  if (rand() < 0.4) {
    const groupOf = (id: string) => allFonts.find((f) => f.id === id)?.group;
    const fits = pairings.filter((p) => findFont(p.heading) && findFont(p.body) && (p.mood.some((x) => style.moods.includes(x)) || groupOf(p.heading) === groupOf(style.fonts.heading)));
    const p = fits[Math.floor(rand() * fits.length)];
    if (p) {
      next.headingFont = p.heading;
      next.bodyFont = p.body;
    }
  }
  const overrides: Record<number, string> = {};
  plan.slides.forEach((s, i) => {
    if (s.role === 'hook' || s.role === 'cta' || rand() > 0.35) return;
    const alts = ROLE_LAYOUTS[s.role];
    overrides[i] = alts[Math.floor(rand() * alts.length)]!;
  });
  if (Object.keys(overrides).length) next.layoutOverrides = overrides;
  const textures: TextureKind[] = ['paper', 'linen', 'watercolor', 'kraft', 'canvas', 'riso', 'stucco', 'crumpled'];
  if (rand() < 0.3) m.texture = textures[Math.floor(rand() * textures.length)];
  const r = rand();
  if (r < 0.15) m.decoration = 'rich';
  else if (r < 0.25) m.decoration = 'minimal';
  m.typeScale = Math.round((0.92 + rand() * 0.2) * 100) / 100;
  next.seed = Math.floor(rand() * 1e6);
  if (!next.label) next.label = `${style.name} · ${getPalette(next.paletteId).name}`;
  return next;
}

export function pickVariations(plan: CarouselPlan, opts: { count: number; tone: Tone; seed?: number; preferStyleId?: string; handle?: string; recent?: string[] }): Variation[] {
  const rand = rng((opts.seed ?? 0) * 7919 + 17);
  const wanted = [...TONE_MOODS[opts.tone], plan.paletteMood];
  const scored = styles.map((s) => {
    const pm = s.palettes.flatMap((p) => getPalette(p).moods);
    // Styles shown recently (across projects) step back so designs keep changing.
    const recency = opts.recent ? opts.recent.slice(0, 12).filter((r) => r === s.id).length : 0;
    return { s, base: overlap(s.moods, wanted) * 1.2 + Math.min(2, overlap(pm, wanted)) * 0.4 + contentBoost(s, plan) + rand() * 1.6 - recency * 0.9 };
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
    let theme: CarouselTheme = { styleId: s.id, paletteId, headingFont: f.heading, bodyFont: f.body, handle: opts.handle };
    theme.label = `${s.name} · ${getPalette(paletteId).name}`;
    // "New designs" (seed > 0) remixes every pick, so each press is a fresh set.
    if ((opts.seed ?? 0) > 0) theme = remix(theme, plan, rand, getPalette(paletteId).scheme === 'dark', wanted[0]);
    return { theme, label: theme.label! };
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
