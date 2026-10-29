import type { ArtPalette, ArtPiece, PropKind } from './types';
export const PROP_LIST: PropKind[] = [];
export function prop(_k: PropKind, _p: ArtPalette, _s?: number): ArtPiece { return { viewBox: [100, 100], parts: [] }; }
