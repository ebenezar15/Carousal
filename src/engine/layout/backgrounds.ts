// Background systems: solid, linear/radial/mesh gradients, patterns, grain and panoramic spans.
// Every tint is checked so body text keeps ≥ 4.5:1 contrast on the lightest/darkest point.
import type { Background, BackgroundPattern } from '@/model/types';
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
};

export function isPanoramic(ctx: Ctx): boolean {
  return ctx.mod.panoramic ?? (ctx.style.layout.panoramic || ctx.style.background.type === 'panoramic');
}

export function buildBackground(ctx: Ctx, index: number): Background {
  const { pal, style, mod } = ctx;
  const sb = style.background;
  const text = pal.text;
  const kind = mod.background ?? (sb.type === 'linear-gradient' || sb.type === 'panoramic' ? 'gradient' : sb.type === 'mesh-gradient' ? 'mesh' : sb.type === 'radial-gradient' ? 'radial' : 'solid');
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
  if (patternName && PATTERNS[patternName] && ctx.decoration !== 'none') {
    const kindP = PATTERNS[patternName]!;
    bg.pattern = {
      kind: kindP,
      color: kindP === 'lines' ? safeTint(pal.bg, pal.primary, text, 0.6, 1) : text,
      opacity: Math.min(0.2, Number(sb.patternOpacity ?? 0.1)) * (kindP === 'lines' ? 2.5 : 1),
      size: Math.round((kindP === 'lines' ? 64 : kindP === 'halftone' ? 22 : 40) * ctx.k),
    };
  }
  const noise = typeof sb.noise === 'number' ? sb.noise : sb.texture ? 0.05 : 0;
  if (noise > 0 && ctx.decoration !== 'none') bg.noise = Math.min(0.12, noise);
  if (span) bg.span = span;
  return bg;
}
