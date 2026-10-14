import type { PatternKind, TextureKind } from '@/model/types';
import { TEXTURES } from '../render/textures';

export const PATTERN_OPTIONS: [PatternKind, string][] = [
  ['dots', 'Dots'], ['grid', 'Grid'], ['lines', 'Lines'], ['halftone', 'Halftone'], ['diagonal', 'Diagonal'], ['perspective-grid', 'Perspective grid'],
  ['waves', 'Waves'], ['zigzag', 'Zigzag'], ['stripes', 'Stripes'], ['checker', 'Checker'], ['crosses', 'Crosses'], ['rings', 'Rings'], ['triangles', 'Triangles'],
];

export const TEXTURE_OPTIONS: [TextureKind, string][] = TEXTURES.map((t) => [t.id, t.label]);
