// Contract for the illustration library (characters, scenes, props). Art is plain data: SVG path
// strings in an art-unit viewBox, with colors already resolved, so the layout engine can turn it into
// slide elements (one PathElement per part) and the editor/export render it like any vector shape.

/** Colors an illustration may use (resolved from the carousel palette, contrast-safe). */
export interface ArtPalette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  accent: string;
  highlight: string;
  /** Background tint helpers: `soft` ≈ bg mixed 80% toward primary, `softer` lighter still. */
  soft: string;
  softer: string;
}

/** One filled and/or stroked SVG path, in the piece's art units. */
export interface ArtPart {
  d: string;
  fill?: string;
  stroke?: string;
  /** In art units (scaled with the piece). */
  strokeWidth?: number;
  opacity?: number;
}

/** Looping motions a moving part can have in animations (rotation pivots on `pivot`). */
export type ArtLoop = 'wave' | 'sway' | 'float' | 'bob' | 'spin' | 'twinkle' | 'blink' | 'drift';

/** A sub-group that moves on its own in animations (an arm that waves, a dove that floats…). */
export interface ArtMover {
  name: string;
  parts: ArtPart[];
  /** Rotation pivot in art units (e.g. the shoulder for an arm). */
  pivot: [number, number];
  loop: ArtLoop;
  /** Seconds offset so several movers don't move in lockstep. */
  phase?: number;
}

/** A finished illustration: static parts (back to front) plus optional movers drawn on top. */
export interface ArtPiece {
  viewBox: [number, number];
  parts: ArtPart[];
  movers?: ArtMover[];
}

export type Pose = 'stand' | 'wave' | 'pray' | 'read' | 'point' | 'kneel' | 'worship' | 'walk' | 'sit' | 'think' | 'hug' | 'carry';
export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'scarf' | 'braids';
export type Expression = 'smile' | 'calm' | 'closed' | 'wonder';

export interface CharacterSpec {
  pose: Pose;
  /** Skin tone hex (see SKIN_TONES). */
  skin: string;
  hair: HairStyle;
  hairColor: string;
  top: string;
  bottom: string;
  expression?: Expression;
  /** Faces left instead of right. */
  flip?: boolean;
  /** Child-sized proportions. */
  child?: boolean;
}

export type SceneKind =
  | 'hill-cross' | 'sunrise' | 'road' | 'mountains' | 'sea-boat' | 'storm-sea' | 'shepherd' | 'tree-river' | 'garden'
  | 'desert' | 'night-sky' | 'empty-tomb' | 'city' | 'rainbow' | 'church' | 'table' | 'open-door' | 'lighthouse'
  | 'field-seeds' | 'well' | 'manger';

export type PropKind =
  | 'bible' | 'cross' | 'dove' | 'candle' | 'lamp' | 'heart' | 'bread' | 'cup' | 'crown' | 'sheep' | 'star' | 'sun'
  | 'cloud' | 'tree' | 'boat' | 'church' | 'door' | 'shield' | 'hands-praying' | 'anchor' | 'key' | 'seed' | 'fish'
  | 'mountain' | 'water-drop' | 'flame' | 'music' | 'lightbulb' | 'compass' | 'scroll' | 'olive-branch' | 'bell';
