// New elements with sensible defaults taken from the carousel's theme (fonts, palette) and canvas size.
import { newId } from '@/model/id';
import type { Carousel, ChartElement, GroupElement, LineElement, PathElement, QRElement, ShapeElement, SlideElement, TableElement, TextElement } from '@/model/types';
import { getPalette, getPreset, nearestWeight, type PaletteColors } from '@/styles';
import { refitText } from '@/engine/layout/textLayout';
import { SHAPES, starburst } from '@/engine/layout/shapes';
import { tableMetrics } from './render/TableQR';

export interface Env { W: number; H: number; k: number; pal: PaletteColors; heading: string; body: string }

export function envFor(c: Carousel): Env {
  const p = getPreset(c.presetId);
  return { W: p.width, H: p.height, k: Math.min(p.width, p.height) / 1080, pal: c.theme.customPalette ?? getPalette(c.theme.paletteId).colors, heading: c.theme.headingFont, body: c.theme.bodyFont };
}

const base = (e: Env, w: number, h: number) => ({ id: newId('el_'), x: Math.round((e.W - w) / 2), y: Math.round((e.H - h) / 2), width: Math.round(w), height: Math.round(h), rotation: 0, opacity: 1 });

export type TextPreset = 'heading' | 'subheading' | 'body' | 'quote' | 'list' | 'label';

export function text(e: Env, preset: TextPreset): TextElement {
  const sizes = { heading: 96, subheading: 60, body: 44, quote: 64, list: 44, label: 30 };
  const size = Math.round(sizes[preset] * e.k);
  const heading = preset === 'heading' || preset === 'subheading' || preset === 'quote';
  const content = {
    heading: 'Add a heading',
    subheading: 'Add a subheading',
    body: 'Add body text. Double-click to edit.',
    quote: '“Add a memorable quote.”',
    list: 'First point\nSecond point\nThird point',
    label: 'LABEL',
  }[preset];
  const el: TextElement = {
    ...base(e, e.W * 0.76, size * 1.3), kind: 'text', name: preset,
    text: content, fontId: heading ? e.heading : e.body, fontSize: size, fontWeight: nearestWeight(heading ? e.heading : e.body, heading ? 700 : preset === 'label' ? 600 : 400),
    italic: preset === 'quote', fill: preset === 'label' ? e.pal.primary : e.pal.text, align: preset === 'quote' ? 'center' : 'left', verticalAlign: 'top',
    lineHeight: heading ? 1.1 : 1.4, letterSpacing: preset === 'label' ? 3 * e.k : 0, textCase: 'none', autoFit: false,
    listStyle: preset === 'list' ? 'bullet' : undefined,
  };
  return refitText(el);
}

export type ShapeKind = 'rect' | 'rounded' | 'circle' | 'triangle' | 'star' | 'hexagon' | 'frame' | 'pill' | 'blob';

export function shape(e: Env, kind: ShapeKind): SlideElement {
  const s = Math.round(320 * e.k);
  if (kind === 'circle') return { ...base(e, s, s), kind: 'ellipse', name: 'Circle', fill: e.pal.primary } as ShapeElement;
  if (kind === 'rect' || kind === 'rounded' || kind === 'frame' || kind === 'pill') {
    const h = kind === 'pill' ? Math.round(s * 0.36) : s;
    return {
      ...base(e, kind === 'pill' ? s * 1.4 : s, h), kind: 'rect', name: kind,
      fill: kind === 'frame' ? 'transparent' : e.pal.primary,
      stroke: kind === 'frame' ? e.pal.text : undefined, strokeWidth: kind === 'frame' ? Math.round(8 * e.k) : undefined,
      cornerRadius: kind === 'rounded' ? Math.round(40 * e.k) : kind === 'pill' ? h / 2 : 0,
    } as ShapeElement;
  }
  const d: Record<string, string[]> = {
    triangle: ['M50 4 L96 92 L4 92 Z'],
    star: starburst(5, 0.45).d,
    hexagon: ['M25 4 L75 4 L98 50 L75 96 L25 96 L2 50 Z'],
    blob: SHAPES.blob.d,
  };
  return { ...base(e, s, s), kind: 'path', name: kind, data: d[kind]!, viewBox: [100, 100], fill: e.pal.primary } as PathElement;
}

export function line(e: Env, arrow: boolean, dashed = false): LineElement {
  const w = Math.round(420 * e.k);
  const sw = Math.max(2, Math.round(6 * e.k));
  return { ...base(e, w, sw), kind: 'line', name: arrow ? 'Arrow' : dashed ? 'Divider' : 'Line', points: [0, sw / 2, w, sw / 2], stroke: e.pal.text, strokeWidth: sw, arrowEnd: arrow, dash: dashed ? [sw * 3, sw * 2] : undefined };
}

export function icon(e: Env, name: string, d: string[]): PathElement {
  const s = Math.round(180 * e.k);
  return { ...base(e, s, s), kind: 'path', name, data: d, viewBox: [24, 24], stroke: e.pal.primary, strokeWidth: Math.max(2, Math.round(8 * e.k)) };
}

export function emoji(e: Env, char: string, name: string): TextElement {
  const size = Math.round(180 * e.k);
  return { ...base(e, size * 1.4, size * 1.25), kind: 'text', name, text: char, fontId: e.body, fontSize: size, fontWeight: 400, italic: false, fill: e.pal.text, align: 'center', verticalAlign: 'middle', lineHeight: 1.2, letterSpacing: 0, textCase: 'none', autoFit: false };
}

/** Badge = starburst/pill + label grouped; callout = speech bubble + text grouped. */
export function badge(e: Env, kind: 'burst' | 'pill' | 'callout'): GroupElement {
  const k = e.k;
  if (kind === 'callout') {
    const w = Math.round(520 * k);
    const h = Math.round(260 * k);
    const bubble: PathElement = { id: newId('el_'), kind: 'path', name: 'Bubble', x: 0, y: 0, width: w, height: h, rotation: 0, opacity: 1, viewBox: [100, 50], data: ['M8 2 H92 Q98 2 98 8 V32 Q98 38 92 38 H34 L20 48 L22 38 H8 Q2 38 2 32 V8 Q2 2 8 2 Z'], fill: e.pal.surface, stroke: e.pal.text, strokeWidth: Math.round(4 * k) };
    const t: TextElement = { ...text(e, 'body'), x: Math.round(w * 0.08), y: Math.round(h * 0.12), width: Math.round(w * 0.84), height: Math.round(h * 0.56), text: 'Callout text', align: 'center', verticalAlign: 'middle', autoFit: true };
    return { ...base(e, w, h), kind: 'group', name: 'Callout', children: [bubble, t] };
  }
  const s = Math.round((kind === 'burst' ? 260 : 300) * k);
  const h = kind === 'burst' ? s : Math.round(96 * k);
  const shapeEl: SlideElement =
    kind === 'burst'
      ? ({ id: newId('el_'), kind: 'path', name: 'Burst', x: 0, y: 0, width: s, height: s, rotation: 0, opacity: 1, viewBox: [100, 100], data: starburst(16, 0.82).d, fill: e.pal.accent } as PathElement)
      : ({ id: newId('el_'), kind: 'rect', name: 'Pill', x: 0, y: 0, width: s, height: h, rotation: 0, opacity: 1, fill: e.pal.primary, cornerRadius: h / 2 } as ShapeElement);
  const t: TextElement = {
    ...text(e, 'label'), x: Math.round(s * 0.1), y: 0, width: Math.round(s * 0.8), height: h, text: kind === 'burst' ? 'NEW!' : 'LIMITED', align: 'center', verticalAlign: 'middle',
    fill: kind === 'burst' ? e.pal.text : e.pal.bg, fontId: e.heading, fontWeight: nearestWeight(e.heading, 800), fontSize: Math.round((kind === 'burst' ? 52 : 34) * k),
  };
  return { ...base(e, s, h), kind: 'group', name: kind === 'burst' ? 'Badge' : 'Tag', children: [shapeEl, t] };
}

export function chart(e: Env, type: ChartElement['chartType']): ChartElement {
  const w = Math.round(800 * e.k);
  return {
    ...base(e, w, Math.round(w * 0.65)), kind: 'chart', name: `${type} chart`, chartType: type,
    labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Revenue', values: [12, 19, 24, 31] }],
    colors: [e.pal.primary, e.pal.accent, e.pal.highlight, e.pal.mutedText, e.pal.text], textColor: e.pal.text, gridColor: e.pal.surface === e.pal.bg ? '#00000014' : e.pal.surface,
    fontId: e.body, fontSize: Math.round(30 * e.k), showValues: true, showLegend: type === 'pie' || type === 'donut',
  };
}

export function table(e: Env): TableElement {
  const t: TableElement = {
    ...base(e, Math.round(860 * e.k), Math.round(420 * e.k)), kind: 'table', name: 'Table',
    rows: [['Plan', 'Price', 'Best for'], ['Starter', '$9', 'Solo creators'], ['Pro', '$29', 'Small teams'], ['Business', '$79', 'Agencies']],
    header: true, fontId: e.body, fontSize: Math.round(30 * e.k), textColor: e.pal.text, headerFill: e.pal.primary, headerTextColor: e.pal.bg, stripeFill: e.pal.surface, borderColor: '#00000022', align: 'left',
  };
  return { ...t, height: Math.ceil(tableMetrics(t).total) };
}

export function qr(e: Env, data = 'https://example.com'): QRElement {
  const s = Math.round(300 * e.k);
  return { ...base(e, s, s), kind: 'qr', name: 'QR code', data, fg: '#111111', bg: '#FFFFFF' };
}

export function imagePlaceholder(e: Env, prompt: string) {
  const w = Math.round(e.W * 0.7);
  return { ...base(e, w, Math.round(w * 0.75)), kind: 'image' as const, name: 'Image placeholder', src: '', fit: 'cover' as const, prompt, cornerRadius: Math.round(24 * e.k) };
}

/** Progress dots for this slide's position in the carousel (a group of circles). */
export function progressDots(e: Env, index: number, total: number): GroupElement {
  const r = Math.round(9 * e.k);
  const gap = Math.round(30 * e.k);
  const children: SlideElement[] = Array.from({ length: total }, (_, i) => ({
    id: newId('el_'), kind: 'ellipse', name: `Dot ${i + 1}`, x: i * gap, y: 0, width: r * 2, height: r * 2, rotation: 0, opacity: i === index ? 1 : 0.35, fill: i === index ? e.pal.primary : e.pal.mutedText,
  }) as ShapeElement);
  const w = (total - 1) * gap + r * 2;
  return { ...base(e, w, r * 2), y: e.H - Math.round(90 * e.k), kind: 'group', name: 'Progress dots', children };
}
