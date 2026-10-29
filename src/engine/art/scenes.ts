import type { ArtPalette, ArtPiece, CharacterSpec, SceneKind } from './types';
export const SCENE_LIST: SceneKind[] = [];
export function scene(_k: SceneKind, _p: ArtPalette, _s: number, _o?: { people?: CharacterSpec[] }): ArtPiece { return { viewBox: [1000, 600], parts: [] }; }
