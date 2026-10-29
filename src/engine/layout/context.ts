// Everything a layout needs to know about the canvas, style, palette and modifiers, resolved once per carousel.
import { getPalette, getPreset, getStyle, nearestWeight, patterns, findFont, type PaletteColors, type PlatformPreset, type StyleSystem } from '@/styles';
import { contrast, mix, pickReadable } from '@/styles/color';
import type { CarouselTheme, DesignModifiers, TextElement, TextEmphasis } from '@/model/types';
import type { CarouselPlan } from '../schema';

export type Density = 'none' | 'minimal' | 'normal' | 'rich';

export interface Box { x: number; y: number; w: number; h: number }

export interface Ctx {
  W: number;
  H: number;
  /** Type scale vs. the 1080px reference, based on the shorter side (so 16:9 text isn't oversized). */
  k: number;
  preset: PlatformPreset;
  style: StyleSystem;
  pal: PaletteColors;
  dark: boolean;
  fonts: { heading: string; body: string; accent: string };
  mod: DesignModifiers;
  /** Safe content box (inside margins, platform safe zones and chrome strips). */
  box: Box;
  /** Vertical centers of the top/bottom chrome strips (slide numbers, swipe cues). */
  chromeTopY: number;
  chromeBottomY: number;
  margin: { left: number; right: number; top: number; bottom: number };
  align: TextElement['align'];
  headline: { weight: number; textCase: TextElement['textCase']; lineHeight: number; tracking: number; scale: number; rotateDeg: number };
  body: { weight: number; lineHeight: number };
  sizes: { hook: number; head: number; body: number; small: number; minBody: number; minHead: number; stat: number };
  emphasis: Omit<TextEmphasis, 'words'>;
  /** Readable text colors on top of primary / surface fills. */
  onPrimary: string;
  accentText: string;
  decoration: Density;
  handle: string;
  plan: CarouselPlan;
  /** Varies generated art between designs (theme.seed, or derived from the style and palette). */
  seed: number;
  total: number;
  isLandscape: boolean;
}

export function makeCtx(plan: CarouselPlan, presetId: string, theme: CarouselTheme): Ctx {
  const preset = getPreset(presetId);
  const style = getStyle(theme.styleId);
  const pal = theme.customPalette ?? getPalette(theme.paletteId).colors;
  const mod = theme.modifiers ?? {};
  const W = preset.width;
  const H = preset.height;
  const short = Math.min(W, H);
  const k = short / 1080;

  const marginPx = Math.round((short * Math.max(4, style.layout.marginPct + (mod.marginDelta ?? 0))) / 100);
  const sz = preset.safeZone;
  const chrome = Math.round(84 * k);
  const margin = {
    left: Math.max(marginPx, sz.left),
    right: Math.max(marginPx, sz.right),
    top: Math.max(marginPx, sz.top),
    bottom: Math.max(marginPx, sz.bottom),
  };
  const box = { x: margin.left, y: margin.top + chrome, w: W - margin.left - margin.right, h: H - margin.top - margin.bottom - 2 * chrome };

  const hl = style.layout.headline;
  const heading = theme.headingFont;
  const body = theme.bodyFont;
  const accent = style.fonts.accent && findFont(style.fonts.accent) ? style.fonts.accent : body;
  const T = patterns.typography;
  const typeScale = (mod.typeScale ?? 1) * hl.scale;

  const accentText = pickReadable(pal.bg, [pal.primary, pal.accent].filter((c) => c.toLowerCase() !== pal.text.toLowerCase()).concat(pal.text), 3);
  const onPrimary = pickReadable(pal.primary, [pal.bg, pal.text, '#FFFFFF', '#111111'], 4.5);

  const emphasisKind = mod.emphasis ?? style.layout.emphasis;
  const emphasis = resolveEmphasis(emphasisKind, pal, accentText, onPrimary);

  const defaultDensity: Density = style.layout.decorations.length === 0 ? 'none' : 'normal';
  return {
    W, H, k, preset, style, pal,
    dark: contrast('#000000', pal.bg) < contrast('#FFFFFF', pal.bg),
    fonts: { heading, body, accent },
    mod,
    box,
    chromeTopY: margin.top + chrome / 2,
    chromeBottomY: H - margin.bottom - chrome / 2,
    margin,
    align: style.layout.alignment,
    headline: {
      weight: nearestWeight(heading, mod.headlineWeight ?? hl.weight),
      textCase: (mod.headlineCase ?? (hl.case === 'upper' ? 'upper' : hl.case === 'title' ? 'title' : 'none')) as TextElement['textCase'],
      lineHeight: hl.lineHeight,
      tracking: hl.tracking,
      scale: typeScale,
      rotateDeg: mod.decoration === 'none' || mod.decoration === 'minimal' ? 0 : Number(hl.rotateDeg ?? 0),
    },
    body: { weight: nearestWeight(body, style.layout.body.weight), lineHeight: style.layout.body.lineHeight },
    sizes: {
      hook: Math.round(140 * typeScale * k),
      head: Math.round(92 * typeScale * k),
      body: Math.round(46 * k),
      small: Math.round(30 * k),
      minBody: Math.round(T['minBodyPx@1080'] * k),
      minHead: Math.round(T['minHeadlinePx@1080'] * k),
      stat: Math.round(240 * Math.max(1, typeScale) * k),
    },
    emphasis,
    onPrimary,
    accentText,
    decoration: mod.decoration ?? defaultDensity,
    handle: theme.handle?.trim() ?? '',
    plan,
    seed: theme.seed ?? [...`${theme.styleId}|${theme.paletteId}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 100000,
    total: plan.slides.length,
    isLandscape: W > H * 1.15,
  };
}

function resolveEmphasis(kind: string, pal: PaletteColors, accentText: string, onPrimary: string): Omit<TextEmphasis, 'words'> {
  switch (kind) {
    case 'highlight':
    case 'marker':
    case 'sticker':
      return { style: 'highlight', color: contrast(pal.text, pal.highlight) >= 3 ? pal.highlight : mix(pal.primary, pal.bg, 0.65) };
    case 'box':
      return { style: 'box', color: pal.primary, textColor: onPrimary };
    case 'underline':
    case 'underline-thick':
      return { style: 'underline', color: pal.primary };
    case 'italic':
      return { style: 'italic', color: accentText };
    case 'bold':
      return { style: 'bold', color: pal.text };
    default:
      // color, accent-color, gradient-text, glow, outline → accent color (renderer adds nothing extra)
      return { style: 'color', color: accentText };
  }
}
