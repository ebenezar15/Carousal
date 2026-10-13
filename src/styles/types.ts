// Types for the research data in /research (Phase 0). Kept loose where the JSON carries free-form hints.

export interface PlatformPreset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  minSlides?: number;
  maxSlides: number;
  fileFormats: string[];
  maxFileSizeMB?: number;
  safeZone: { top: number; right: number; bottom: number; left: number };
  safeZoneConfidence?: string;
  exportKind: 'images' | 'pdf';
  recommended?: boolean;
  notes?: string;
  sources: { url: string; retrieved: string; confidence: 'verified' | 'secondary' | 'estimated' }[];
}

export interface FontDef {
  id: string;
  family: string;
  fontsource: string;
  category: string;
  group: string;
  moods: string[];
  license: string;
  weights: number[];
  italics: number[];
  subsets: string[];
  variable: boolean;
  usage: 'heading' | 'body' | 'both';
  notes?: string;
}

export interface FontGroup { id: string; label: string; description: string }
export interface FontPairing { id: string; heading: string; body: string; mood: string[]; rationale: string }

export interface PaletteColors {
  bg: string; surface: string; text: string; mutedText: string; primary: string; accent: string; highlight: string;
}
export interface Palette { id: string; name: string; moods: string[]; scheme: 'light' | 'dark'; colors: PaletteColors }

export type SlideRole =
  | 'hook' | 'intro' | 'body' | 'list' | 'step' | 'stat' | 'quote' | 'comparison' | 'summary' | 'cta';

export interface StyleFonts { heading: string; body: string; accent?: string }

export interface StyleSystem {
  id: string;
  name: string;
  description: string;
  moods: string[];
  palettes: string[];
  fonts: StyleFonts;
  altFonts: StyleFonts[];
  background: { type: string; [k: string]: unknown };
  layout: {
    alignment: 'left' | 'center' | 'right';
    marginPct: number;
    headline: { scale: number; weight: number; case: 'sentence' | 'upper' | 'title'; tracking: number; lineHeight: number; rotateDeg?: number; [k: string]: unknown };
    body: { weight: number; lineHeight: number; tracking?: number };
    emphasis: string;
    decorations: string[];
    slideNumber: { style: string; position: string };
    swipeCue: { style: string; position: string };
    panoramic: boolean;
    [k: string]: unknown;
  };
  roleLayouts: Record<SlideRole, string>;
}

export interface RoleRule {
  purpose: string;
  maxWords: number;
  headlineMaxWords: number;
  bodyMaxWords: number;
  maxBullets: number;
  maxBodyLines?: number;
  layoutHints: string[];
}

export interface DesignPatterns {
  roles: Record<SlideRole, RoleRule>;
  sequence: { first: SlideRole; second: SlideRole; penultimate: SlideRole; last: SlideRole; middleRoles: SlideRole[] };
  hookTemplates: { id: string; pattern: string; example: string }[];
  hookRules: string[];
  ctaTemplates: { id: string; bestFor: string[]; pattern: string; example: string }[];
  ctaRules: string[];
  slideCount: { min: number; max: number; sweetSpot: [number, number] };
  density: { maxWordsAnySlide: number; maxBulletsAnySlide: number; maxSentenceWords: number };
  typography: {
    'minBodyPx@1080': number;
    'minHeadlinePx@1080': number;
    'hookHeadlinePx@1080': [number, number];
    lineHeight: { headline: number; body: number };
    maxCharsPerLine: number;
    [k: string]: unknown;
  };
  layout: { marginPct: number; safeInsetPx: number; bottomClearancePx: number; [k: string]: unknown };
  antiPatterns: string[];
  [k: string]: unknown;
}
