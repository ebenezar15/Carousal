// Document model. Everything is plain JSON (no class instances, no Konva nodes) so it can be
// stored in IndexedDB, diffed for undo/redo, saved as a .carousel file and rendered identically
// by the editor, thumbnails and export.
import type { SlideRole } from '@/styles/types';

export type ElementKind = 'text' | 'rect' | 'ellipse' | 'line' | 'path' | 'image' | 'group';

export interface ElementBase {
  id: string;
  kind: ElementKind;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  /** Semantic slot the layout engine filled, e.g. 'headline' or 'slide-number'. Lets "swap theme" re-flow content. */
  slot?: string;
}

export interface TextEmphasis {
  words: string[];
  /** box = filled block behind the word with `textColor` text. */
  style: 'color' | 'highlight' | 'underline' | 'bold' | 'italic' | 'box';
  color: string;
  textColor?: string;
}

export interface Shadow { color: string; blur: number; offsetX: number; offsetY: number; opacity: number }

export interface TextElement extends ElementBase {
  kind: 'text';
  text: string;
  fontId: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  fill: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  textCase: 'none' | 'upper' | 'lower' | 'title';
  /** If true the layout engine shrinks fontSize until the text fits the box. */
  autoFit: boolean;
  emphasis?: TextEmphasis;
  stroke?: { color: string; width: number };
  shadow?: Shadow;
}

export interface ShapeElement extends ElementBase {
  kind: 'rect' | 'ellipse';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  shadow?: Shadow;
  dash?: number[];
}

export interface LineElement extends ElementBase {
  kind: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  arrowEnd?: boolean;
}

/** Vector shape (icons, blobs, arrows, doodles). `data` is SVG path syntax in a viewBox scaled to width × height. */
export interface PathElement extends ElementBase {
  kind: 'path';
  data: string[];
  viewBox: [number, number];
  fill?: string;
  stroke?: string;
  /** Output pixels (not scaled with the viewBox). */
  strokeWidth?: number;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  /** Key into the Dexie assets table, or a data/http URL. */
  src: string;
  fit: 'cover' | 'contain' | 'fill';
}

export interface GroupElement extends ElementBase {
  kind: 'group';
  children: SlideElement[];
}

export type SlideElement = TextElement | ShapeElement | LineElement | PathElement | ImageElement | GroupElement;

export interface GradientStop { offset: number; color: string }

export interface BackgroundPattern {
  kind: 'dots' | 'grid' | 'lines' | 'halftone' | 'perspective-grid' | 'diagonal';
  color: string;
  opacity: number;
  /** Cell size in output pixels. */
  size: number;
}

/** Blob of color for mesh gradients; x/y/r are fractions of the (possibly panoramic) background size. */
export interface MeshPoint { x: number; y: number; r: number; color: string }

interface BackgroundExtras {
  pattern?: BackgroundPattern;
  /** Film grain amount 0..1. */
  noise?: number;
  /**
   * Panoramic backgrounds: this slide shows window `index` of a background `count` slides wide,
   * so gradients and patterns flow seamlessly when swiping.
   */
  span?: { index: number; count: number };
}

export type Background = BackgroundExtras &
  (
    | { type: 'solid'; color: string }
    | { type: 'linear'; angle: number; stops: GradientStop[] }
    | { type: 'radial'; cx: number; cy: number; radius: number; stops: GradientStop[] }
    | { type: 'mesh'; base: string; points: MeshPoint[] }
  );

export interface Slide {
  id: string;
  role?: SlideRole;
  /** layoutCatalog id the engine used (for "new layout" cycling). */
  layoutId?: string;
  background: Background;
  elements: SlideElement[];
  notes?: string;
}

/** Design-level tweaks applied on top of a style system ("make it more bold/minimal/…"). */
export interface DesignModifiers {
  /** Multiplier on headline sizes. */
  typeScale?: number;
  /** Override decoration density. */
  decoration?: 'none' | 'minimal' | 'normal' | 'rich';
  /** Extra margin in % of width (may be negative). */
  marginDelta?: number;
  headlineCase?: 'none' | 'upper';
  headlineWeight?: number;
  emphasis?: 'color' | 'highlight' | 'underline' | 'box' | 'italic';
  background?: 'solid' | 'gradient' | 'mesh';
  panoramic?: boolean;
}

export interface CarouselTheme {
  styleId: string;
  paletteId: string;
  headingFont: string;
  bodyFont: string;
  modifiers?: DesignModifiers;
  /** Per-slide layout choice (slide index → layoutCatalog id), set by "new layout". */
  layoutOverrides?: Record<number, string>;
  /** Shown on CTA slides and footers, e.g. "@studio". */
  handle?: string;
  /** Human label for the variation, e.g. "Bold Gradient · Sunset". */
  label?: string;
}

export interface Carousel {
  id: string;
  presetId: string;
  theme: CarouselTheme;
  slides: Slide[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceText?: string;
  /** The checked AI/rules plan this carousel was generated from (kept for per-slide regeneration later). */
  plan?: unknown;
  generatedBy?: string;
  /** Design variations offered for this content; `carousel.theme` is the chosen one (possibly tweaked). */
  variations?: CarouselTheme[];
  variationSeed?: number;
  /** Generation settings, so "regenerate" reuses them. */
  settings?: { presetId: string; tone: string; audience: string; language: string; slideCount: number | 'auto'; variationCount: number };
  carousel: Carousel;
  /** Small PNG data URL used in the project list. */
  thumbnail?: string;
}
