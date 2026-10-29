// Public entry for the procedural illustration library.

import { mix } from '@/styles/color';
import type { ArtPalette } from './types';

export type * from './types';
export { character, randomCharacter, SKIN_TONES, HAIR_COLORS, NEUTRALS, NEUTRAL_COLORS, POSE_LIST, HAIR_LIST, EXPRESSIONS } from './characters';
export { scene, SCENE_LIST } from './scenes';
export { prop, PROP_LIST } from './props';
export { transformPath, parsePath, pathBounds } from './geom';

/** Resolve the carousel palette into the colors illustrations may use. */
export function artPalette(p: { bg: string; surface: string; text: string; mutedText: string; primary: string; accent: string; highlight: string }): ArtPalette {
  return {
    bg: p.bg,
    surface: p.surface,
    ink: p.text,
    muted: p.mutedText,
    primary: p.primary,
    accent: p.accent,
    highlight: p.highlight,
    soft: mix(p.bg, p.primary, 0.22),
    softer: mix(p.bg, p.primary, 0.1),
  };
}
