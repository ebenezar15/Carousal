// Typed access to the Phase 0 research data. /research is the single source of truth.
import presetsJson from '@research/platform-presets.json';
import fontsJson from '@research/fonts.json';
import palettesJson from '@research/palettes.json';
import stylesJson from '@research/styles.json';
import patternsJson from '@research/design-patterns.json';
import type { DesignPatterns, FontDef, FontGroup, FontPairing, Palette, PlatformPreset, StyleSystem } from './types';

export * from './types';

export const presets = presetsJson.presets as PlatformPreset[];
export const fonts = fontsJson.fonts as FontDef[];
export const fontGroups = fontsJson.groups as FontGroup[];
export const pairings = fontsJson.pairings as FontPairing[];
export const palettes = palettesJson.palettes as Palette[];
export const styles = stylesJson.styles as unknown as StyleSystem[];
export const layoutCatalog = stylesJson.layoutCatalog as Record<string, string>;
export const patterns = patternsJson as unknown as DesignPatterns;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const presetMap = byId(presets);
const fontMap = byId(fonts);
const paletteMap = byId(palettes);
const styleMap = byId(styles);

function must<T>(map: Map<string, T>, id: string, kind: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`Unknown ${kind}: ${id}`);
  return v;
}

export const getPreset = (id: string) => must(presetMap, id, 'preset');
export const getFont = (id: string) => must(fontMap, id, 'font');
export const getPalette = (id: string) => must(paletteMap, id, 'palette');
export const getStyle = (id: string) => must(styleMap, id, 'style');
export const findFont = (id: string) => fontMap.get(id);

export const DEFAULT_PRESET_ID = 'instagram-portrait-4x5';
export const DEFAULT_STYLE_ID = 'minimal-swiss';

/** Picks the bundled weight closest to the requested one (fonts ship 1-4 weights). */
export function nearestWeight(fontId: string, wanted: number): number {
  const f = fontMap.get(fontId);
  if (!f || f.weights.length === 0) return wanted;
  return f.weights.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best), f.weights[0]!);
}
