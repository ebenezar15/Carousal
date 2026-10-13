// Document model. Everything is plain JSON (no class instances, no Konva nodes) so it can be
// stored in IndexedDB, diffed for undo/redo, saved as a .carousel file and rendered identically
// by the editor, thumbnails and export.
import type { SlideRole } from '@/styles/types';

export type ElementKind = 'text' | 'rect' | 'ellipse' | 'line' | 'image' | 'group';

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
  style: 'color' | 'highlight' | 'underline' | 'bold' | 'italic';
  color: string;
}

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
}

export interface ShapeElement extends ElementBase {
  kind: 'rect' | 'ellipse';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface LineElement extends ElementBase {
  kind: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  arrowEnd?: boolean;
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

export type SlideElement = TextElement | ShapeElement | LineElement | ImageElement | GroupElement;

export interface GradientStop { offset: number; color: string }
export type Background =
  | { type: 'solid'; color: string }
  | { type: 'linear'; angle: number; stops: GradientStop[] }
  | { type: 'radial'; cx: number; cy: number; radius: number; stops: GradientStop[] };

export interface Slide {
  id: string;
  role?: SlideRole;
  background: Background;
  elements: SlideElement[];
  notes?: string;
}

export interface CarouselTheme {
  styleId: string;
  paletteId: string;
  headingFont: string;
  bodyFont: string;
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
  carousel: Carousel;
  /** Small PNG data URL used in the project list. */
  thumbnail?: string;
}
