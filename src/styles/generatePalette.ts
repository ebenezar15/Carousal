// Generated palettes: endless, harmonious color sets from a hue and a seed, always meeting the same
// contrast rules as the hand-made palettes (text and muted text ≥ 4.5:1 on bg and surface, primary ≥ 3:1).
import { contrast, mix, rgbToHex } from './color';
import type { PaletteColors } from './types';

function hsl(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Darkens (on light bgs) or lightens (on dark bgs) a color until it reaches `min` contrast with bg. */
function ensure(color: string, bg: string, min: number, dark: boolean): string {
  let c = color;
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mix(c, dark ? '#FFFFFF' : '#000000', 0.12);
  return c;
}

export type Harmony = 'complementary' | 'analogous' | 'triad' | 'split';

export interface GeneratedPalette { colors: PaletteColors; scheme: 'light' | 'dark'; name: string }

const HUE_NAMES: [number, string][] = [[15, 'Red'], [40, 'Amber'], [65, 'Gold'], [100, 'Lime'], [150, 'Green'], [180, 'Teal'], [205, 'Sky'], [235, 'Blue'], [265, 'Indigo'], [290, 'Violet'], [330, 'Rose'], [360, 'Red']];
const hueName = (h: number) => HUE_NAMES.find(([lim]) => ((h % 360) + 360) % 360 < lim)![1];

/**
 * A palette from a base hue. `rand` (0..1) drives saturation, lightness and harmony choices so every
 * seed gives a different but coherent set.
 */
export function generatePalette(hue: number, scheme: 'light' | 'dark', rand: () => number, mood?: string): GeneratedPalette {
  const harmony: Harmony = (['complementary', 'analogous', 'triad', 'split'] as const)[Math.floor(rand() * 4)]!;
  const offset = harmony === 'complementary' ? 180 : harmony === 'analogous' ? 35 : harmony === 'triad' ? 120 : 150;
  const pastel = mood === 'pastel' || mood === 'calm';
  const bold = mood === 'bold' || mood === 'colorful';
  const sat = pastel ? 0.45 + rand() * 0.2 : bold ? 0.75 + rand() * 0.2 : 0.55 + rand() * 0.3;
  const dark = scheme === 'dark';
  const bg = dark ? hsl(hue, 0.25 + rand() * 0.25, 0.07 + rand() * 0.06) : hsl(hue, pastel ? 0.5 : 0.25 + rand() * 0.35, 0.94 + rand() * 0.04);
  const surface = dark ? mix(bg, '#FFFFFF', 0.07) : mix(bg, '#FFFFFF', 0.7);
  const text = ensure(dark ? hsl(hue, 0.3, 0.94) : hsl(hue, 0.35, 0.12), mix(bg, surface, 0.5), 7, dark);
  const mutedText = ensure(dark ? hsl(hue, 0.15, 0.72) : hsl(hue, 0.15, 0.36), bg, 4.6, dark);
  const primary = ensure(hsl(hue, sat, dark ? 0.62 : 0.45), bg, 3.2, dark);
  const accent = hsl(hue + offset, sat * 0.9, dark ? 0.65 : 0.52);
  const highlight = hsl(hue + (harmony === 'analogous' ? -35 : offset / 2), 0.9, dark ? 0.72 : 0.78);
  const colors: PaletteColors = { bg, surface, text: ensure(text, surface, 4.6, dark), mutedText: ensure(mutedText, surface, 4.6, dark), primary, accent, highlight };
  return { colors, scheme, name: `${hueName(hue)} ${harmony}` };
}
