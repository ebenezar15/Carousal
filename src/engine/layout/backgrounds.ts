// Background systems: solid, linear/radial/mesh gradients, patterns, grain and panoramic spans.
// Every tint is checked so body text keeps ≥ 4.5:1 contrast on the lightest/darkest point.
import type { Background, BackgroundPattern, TextureKind } from '@/model/types';
import { contrast, mix } from '@/styles/color';
import type { Ctx } from './context';

/** Mixes `bg` toward `target` as far as possible (≤ maxT) while `text` stays readable. */
export function safeTint(bg: string, target: string, text: string, maxT = 0.5, min = 4.5): string {
  for (let t = maxT; t > 0; t -= 0.05) {
    const c = mix(bg, target, t);
    if (contrast(text, c) >= min) return c;
  }
  return bg;
}

const PATTERNS: Record<string, BackgroundPattern['kind']> = {
  'halftone-dots': 'halftone',
  'dot-grid': 'dots',
  'lined-paper': 'lines',
  'fine-grid': 'grid',
  'perspective-grid': 'perspective-grid',
  diagonal: 'diagonal',
  waves: 'waves', checker: 'checker', zigzag: 'zigzag', stripes: 'stripes', crosses: 'crosses', rings: 'rings', triangles: 'triangles', dots: 'dots', grid: 'grid',
};

/** Area-filling patterns read much stronger than line patterns, so they start fainter. */
const FILLED = new Set<BackgroundPattern['kind']>(['stripes', 'checker', 'triangles']);

/** Texture names used in research/styles.json → procedural texture kinds. */
const STYLE_TEXTURES: Record<string, TextureKind> = {
  'paper-grain': 'paper', 'riso-grain': 'riso', paper: 'paper', grain: 'riso',
  kraft: 'kraft', crumpled: 'crumpled', linen: 'linen', canvas: 'canvas', watercolor: 'watercolor', concrete: 'concrete', stucco: 'stucco', grunge: 'grunge', terrazzo: 'terrazzo', brushed: 'brushed', riso: 'riso',
};

/** Strengths that keep text contrast intact on light and dark palettes (checked by the real-pixel audit). */
export const DEFAULT_TEXTURE_AMOUNT: Partial<Record<TextureKind, number>> = {
  paper: 0.35, kraft: 0.4, crumpled: 0.25, linen: 0.5, canvas: 0.5, watercolor: 0.3, concrete: 0.4, stucco: 0.35, grunge: 0.4, terrazzo: 0.55, brushed: 0.3, riso: 0.4,
};

export function isPanoramic(ctx: Ctx): boolean {
  return ctx.mod.panoramic ?? (ctx.style.layout.panoramic || ctx.style.background.type === 'panoramic');
}

export function buildBackground(ctx: Ctx, index: number): Background {
  const { pal, style, mod } = ctx;
  const sb = style.background;
  const text = pal.text;
  const plain = mod.background === 'plain';
  const kind = plain ? 'solid' : mod.background ?? (sb.type === 'linear-gradient' || sb.type === 'panoramic' ? 'gradient' : sb.type === 'mesh-gradient' ? 'mesh' : sb.type === 'radial-gradient' ? 'radial' : 'solid');
  const span = isPanoramic(ctx) ? { index, count: ctx.total } : undefined;

  let bg: Background;
  if (kind === 'gradient') {
    const end = safeTint(pal.bg, pal.primary, text, 0.55);
    const mid = safeTint(pal.bg, pal.accent, text, 0.35);
    bg = span
      ? { type: 'linear', angle: 90, stops: [{ offset: 0, color: pal.bg }, { offset: 0.5, color: end }, { offset: 1, color: mid }] }
      : { type: 'linear', angle: Number(sb.angle ?? 135), stops: [{ offset: 0, color: pal.bg }, { offset: 1, color: end }] };
  } else if (kind === 'mesh') {
    bg = {
      type: 'mesh',
      base: pal.bg,
      points: [
        { x: 0.85, y: 0.12, r: 0.65, color: safeTint(pal.bg, pal.primary, text, 0.7) },
        { x: 0.1, y: 0.85, r: 0.6, color: safeTint(pal.bg, pal.accent, text, 0.6) },
        { x: 0.15, y: 0.15, r: 0.4, color: safeTint(pal.bg, pal.highlight, text, 0.6) },
      ],
    };
  } else if (kind === 'radial') {
    bg = { type: 'radial', cx: 0.2, cy: 0.15, radius: 1.1, stops: [{ offset: 0, color: safeTint(pal.bg, pal.highlight, text, 0.8) }, { offset: 1, color: pal.bg }] };
  } else {
    bg = { type: 'solid', color: pal.bg };
  }

  const patternName = typeof sb.pattern === 'string' ? sb.pattern : null;
  const styleP = patternName ? PATTERNS[patternName] : undefined;
  const kindP = plain || mod.pattern === 'none' ? undefined : mod.pattern ?? (ctx.decoration !== 'none' ? styleP : undefined);
  if (kindP) {
    bg.pattern = {
      kind: kindP,
      color: kindP === 'lines' ? safeTint(pal.bg, pal.primary, text, 0.6, 1) : text,
      // Kept faint enough that small text on top still clears 4.5:1 (verified by the real-pixel audit test).
      opacity: kindP === 'perspective-grid' ? 0.08 : FILLED.has(kindP) ? 0.05 : Math.min(0.2, Number(sb.patternOpacity ?? 0.1)) * (kindP === 'lines' ? 2.5 : 1),
      size: Math.round((kindP === 'lines' ? 64 : kindP === 'halftone' ? 22 : FILLED.has(kindP) ? 60 : 40) * ctx.k),
    };
  }
  const noise = typeof sb.noise === 'number' ? sb.noise : sb.texture ? 0.05 : 0;
  if (!plain && noise > 0 && ctx.decoration !== 'none') bg.noise = Math.min(0.12, noise);
  const styleTexture = typeof sb.texture === 'string' ? STYLE_TEXTURES[sb.texture] : undefined;
  const texture = plain || mod.texture === 'none' ? undefined : mod.texture ?? styleTexture;
  if (texture) bg.texture = { kind: texture, amount: mod.textureAmount ?? DEFAULT_TEXTURE_AMOUNT[texture] ?? 0.5 };
  if (span) bg.span = span;
  return bg;
}
