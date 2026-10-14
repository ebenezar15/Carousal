// Element builders and the text-fitting primitives every layout uses.
import { newId } from '@/model/id';
import type { LineElement, PathElement, ShapeElement, SlideElement, TextElement, TextEmphasis } from '@/model/types';
import type { Box, Ctx } from './context';
import { applyCase, emphasisFont, layoutText } from './textLayout';
import { isRtlText } from '@/styles/scriptFonts';

export interface TextSpec {
  slot: string;
  text: string;
  font: string;
  weight: number;
  max: number;
  min: number;
  lineHeight: number;
  color: string;
  italic?: boolean;
  textCase?: TextElement['textCase'];
  letterSpacing?: number;
  emphasis?: TextEmphasis;
  /** Space after this block, as a multiple of its own font size. */
  gapAfter?: number;
  align?: TextElement['align'];
  rotation?: number;
  stroke?: TextElement['stroke'];
  shadow?: TextElement['shadow'];
}

export interface Fitted { elements: TextElement[]; height: number; overflow: boolean; scale: number }

export function measureSpec(spec: TextSpec, size: number, width: number) {
  const text = applyCase(spec.text, spec.textCase ?? 'none');
  const ls = (spec.letterSpacing ?? 0) * (size / spec.max || 1);
  return layoutText(text, { fontId: spec.font, size, weight: spec.weight, italic: spec.italic ?? false, letterSpacing: ls }, width, spec.lineHeight, spec.emphasis?.words, emphasisFont(spec.font, spec.emphasis));
}

/**
 * Stacks text blocks vertically inside `region`, shrinking all of them by a shared factor until they fit.
 * Text never goes below each block's `min` size (the mobile legibility floor); `overflow` reports if it
 * still doesn't fit so the UI can warn.
 */
export function fitStack(specs: TextSpec[], region: Box, valign: 'top' | 'middle' | 'bottom' = 'top', align: TextElement['align'] = 'left'): Fitted {
  const live = specs.filter((s) => s.text.trim());
  let f = 1;
  for (let i = 0; i < 40; i++) {
    const sized = live.map((s) => {
      const size = Math.max(s.min, Math.round(s.max * f));
      const lay = measureSpec(s, size, region.w);
      return { s, size, h: Math.ceil(lay.height), ls: (s.letterSpacing ?? 0) * (size / s.max), broke: lay.broke && size > s.min };
    });
    const total = sized.reduce((t, x, idx) => t + x.h + (idx < sized.length - 1 ? Math.round(x.size * (x.s.gapAfter ?? 0.5)) : 0), 0);
    const atFloor = sized.every((x) => x.size <= x.s.min);
    // Long words (common in Tamil, German, Finnish…) shrink the text rather than split mid-word.
    if ((total <= region.h && !sized.some((x) => x.broke)) || atFloor) {
      let y = region.y + (valign === 'middle' ? Math.max(0, (region.h - total) / 2) : valign === 'bottom' ? Math.max(0, region.h - total) : 0);
      const elements = sized.map((x, idx) => {
        const el = textEl(x.s, region.x, Math.round(y), region.w, x.h, x.size, x.ls, x.s.align ?? align);
        y += x.h + (idx < sized.length - 1 ? Math.round(x.size * (x.s.gapAfter ?? 0.5)) : 0);
        return el;
      });
      return { elements, height: total, overflow: total > region.h + 1, scale: f };
    }
    f *= 0.95;
  }
  throw new Error('fitStack did not converge');
}

export function textEl(s: TextSpec, x: number, y: number, w: number, h: number, size: number, letterSpacing: number, align: TextElement['align']): TextElement {
  // Right-to-left text (Arabic, Hebrew, Urdu…) mirrors the layout's alignment.
  if (align !== 'center' && isRtlText(s.text)) align = align === 'left' ? 'right' : 'left';
  return {
    id: newId('el_'), kind: 'text', slot: s.slot, name: s.slot,
    x, y, width: w, height: h, rotation: s.rotation ?? 0, opacity: 1,
    text: s.text, fontId: s.font, fontSize: size, fontWeight: s.weight, italic: s.italic ?? false, fill: s.color,
    align, verticalAlign: 'top', lineHeight: s.lineHeight, letterSpacing, textCase: s.textCase ?? 'none',
    autoFit: true, emphasis: s.emphasis, stroke: s.stroke, shadow: s.shadow,
  };
}

/** Single-line label at a fixed size (chrome, kickers, badges); height derives from line height. */
export function label(ctx: Ctx, slot: string, text: string, x: number, y: number, w: number, opts: Partial<TextSpec> & { size?: number } = {}): TextElement {
  const size = opts.size ?? ctx.sizes.small;
  const spec: TextSpec = {
    slot, text, font: opts.font ?? ctx.fonts.body, weight: opts.weight ?? ctx.body.weight, max: size, min: size,
    lineHeight: opts.lineHeight ?? 1.25, color: opts.color ?? ctx.pal.mutedText, textCase: opts.textCase, letterSpacing: opts.letterSpacing ?? 0,
    italic: opts.italic,
  };
  const lay = measureSpec(spec, size, w);
  return textEl(spec, Math.round(x), Math.round(y), Math.round(w), Math.ceil(lay.height), size, spec.letterSpacing ?? 0, opts.align ?? 'left');
}

export const rect = (slot: string, x: number, y: number, w: number, h: number, fill: string, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: newId('el_'), kind: 'rect', slot, name: slot, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), rotation: 0, opacity: 1, fill, ...extra,
});

export const ellipse = (slot: string, cx: number, cy: number, rx: number, ry: number, fill: string, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: newId('el_'), kind: 'ellipse', slot, name: slot, x: Math.round(cx - rx), y: Math.round(cy - ry), width: Math.round(rx * 2), height: Math.round(ry * 2), rotation: 0, opacity: 1, fill, ...extra,
});

/** Line from absolute points; stored with x/y at the bounding-box origin and points relative to it. */
export const line = (slot: string, points: number[], stroke: string, strokeWidth: number, extra: Partial<LineElement> = {}): LineElement => {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const rel = points.map((v, i) => Math.round((v - (i % 2 === 0 ? x : y)) * 100) / 100);
  return { id: newId('el_'), kind: 'line', slot, name: slot, x: Math.round(x), y: Math.round(y), width: Math.max(...xs) - x, height: Math.max(...ys) - y, rotation: 0, opacity: 1, points: rel, stroke, strokeWidth, ...extra };
};

export const path = (slot: string, data: string[], viewBox: [number, number], x: number, y: number, w: number, h: number, extra: Partial<PathElement> = {}): PathElement => ({
  id: newId('el_'), kind: 'path', slot, name: slot, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), rotation: 0, opacity: 1, data, viewBox, ...extra,
});

/** Shrinks a box on all sides. */
export const inset = (b: Box, d: number | { x: number; y: number }): Box => {
  const dx = typeof d === 'number' ? d : d.x;
  const dy = typeof d === 'number' ? d : d.y;
  return { x: b.x + dx, y: b.y + dy, w: b.w - 2 * dx, h: b.h - 2 * dy };
};

export const isText = (e: SlideElement): e is TextElement => e.kind === 'text';
