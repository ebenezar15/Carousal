// Diagram layouts (cycle, flow, venn, pyramid, tree, journey, versus, stairs) built from a slide's bullets.
// Each one puts the headline on top (or beside it on landscape canvases) and draws the diagram in the
// rest of the safe box. Every label is fitted inside its own shape, so labels never collide.
import type { PathElement, SlideElement, TextElement } from '@/model/types';
import { contrast, mix, pickReadable } from '@/styles/color';
import type { SlidePlan } from '../schema';
import type { Box, Ctx } from './context';
import { bodySpec, headSpec, LAYOUTS, type LayoutFn, type LayoutResult } from './layouts';
import { ellipse, fitStack, line, path, rect, type TextSpec } from './primitives';

// ---------- items ----------

export interface Item { label: string; detail: string }

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'with', 'your', 'our', 'my', 'as', 'at', 'by', 'from', 'is', 'be', 'that', 'his', 'her', 'their']);
const SEQ_RE = /^(?:(?:step\s*)?\d+\s*[.):-]\s*|(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|then|next|finally|lastly|after that|afterwards|begin by|start by|start with)\b[,:]?\s+)/i;
const capFirst = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t);
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean);

/** Splits a bullet into a short label and the rest (shown smaller): "Pray: talk to God first" → Pray / talk to God first. */
export function splitItem(raw: string, maxWords: number): Item {
  let t = raw.trim().replace(/^[•\-–—*]\s*/, '');
  const stripped = t.replace(SEQ_RE, '').trim();
  if (stripped) t = capFirst(stripped);
  const m = /^(.+?)(?:\s*[:—–]\s+|\s+-\s+|\s*\()(.+)$/.exec(t);
  if (m && words(m[1]!).length <= maxWords + 1) return { label: m[1]!.trim(), detail: m[2]!.replace(/\)\s*$/, '').trim() };
  const w = words(t);
  if (w.length <= maxWords + 1) return { label: t, detail: '' };
  let cut = maxWords;
  while (cut > 1 && STOP.has(w[cut - 1]!.toLowerCase())) cut--;
  return { label: w.slice(0, cut).join(' ').replace(/[,;.]$/, ''), detail: w.slice(cut).join(' ') };
}

/** The slide's diagram items: bullets, else a body like "Pray · Read · Reflect". */
function rawItems(s: SlidePlan): string[] {
  const b = s.bullets.map((x) => x.trim()).filter(Boolean);
  if (b.length >= 2) return b;
  const parts = s.body.split(/\s*(?:[·•|\n;]|→|->)\s*/).map((x) => x.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 6 ? parts : b;
}

const itemsFor = (s: SlidePlan, maxWords: number) => rawItems(s).map((t) => splitItem(t, maxWords));

/** "Law vs Grace" / "Old self → New self" → the two sides, plus whether it reads as a transformation. */
export function parseVs(text: string): { a: string; b: string; arrow: boolean } | null {
  const m = /^(.+?)\s+(vs\.?|versus|→|->|to)\s+(.+)$/i.exec(text.trim());
  if (!m || words(m[1]!).length > 4 || words(m[3]!).length > 4) return null;
  if (m[2]!.toLowerCase() === 'to' && !/^from\s/i.test(m[1]!)) return null;
  return { a: capFirst(m[1]!.replace(/^from\s+/i, '')), b: capFirst(m[3]!.replace(/[.!?]$/, '')), arrow: !/^v/i.test(m[2]!) };
}

/** A diagram that can't be drawn from this content falls back to a regular layout (never an empty slide). */
const fallback: LayoutFn = (ctx, s, i) => LAYOUTS[s.bullets.length ? 'list-bullets' : 'body-top-left']!(ctx, s, i);

// ---------- drawing helpers ----------

/** Path builder in absolute canvas coordinates; `el` converts to a tight path element at scale 1. */
class Pen {
  private cmds: [string, number[]][] = [];
  private xs: number[] = [];
  private ys: number[] = [];
  bound(x: number, y: number) {
    this.xs.push(x);
    this.ys.push(y);
    return this;
  }
  private add(c: string, a: number[]) {
    this.cmds.push([c, a]);
    for (let n = a.length - 2; n >= 0; n -= 2) if (c !== 'A' || n === a.length - 2) this.bound(a[n]!, a[n + 1]!);
    return this;
  }
  M(x: number, y: number) { return this.add('M', [x, y]); }
  L(x: number, y: number) { return this.add('L', [x, y]); }
  C(x1: number, y1: number, x2: number, y2: number, x: number, y: number) { return this.add('C', [x1, y1, x2, y2, x, y]); }
  A(rx: number, ry: number, large: number, sweep: number, x: number, y: number) { return this.add('A', [rx, ry, 0, large, sweep, x, y]); }
  Z() {
    this.cmds.push(['Z', []]);
    return this;
  }
  el(slot: string, extra: Partial<PathElement>): PathElement {
    const x0 = Math.floor(Math.min(...this.xs));
    const y0 = Math.floor(Math.min(...this.ys));
    const w = Math.max(1, Math.ceil(Math.max(...this.xs)) - x0);
    const h = Math.max(1, Math.ceil(Math.max(...this.ys)) - y0);
    const r = (v: number) => Math.round(v * 10) / 10;
    const d = this.cmds
      .map(([c, a]) => c + (c === 'A' ? [...a.slice(0, 5), r(a[5]! - x0), r(a[6]! - y0)] : a.map((v, n) => r(v - (n % 2 === 0 ? x0 : y0)))).join(' '))
      .join(' ');
    return path(slot, [d], [w, h], x0, y0, w, h, extra);
  }
}

function arrowHead(x: number, y: number, angle: number, size: number, color: string): PathElement {
  const p = new Pen().M(x, y);
  p.L(x - size * Math.cos(angle - 0.5), y - size * Math.sin(angle - 0.5));
  p.L(x - size * Math.cos(angle + 0.5), y - size * Math.sin(angle + 0.5));
  return p.Z().el('diagram-arrow', { fill: color });
}

/** Text color with ≥ 4.5:1 contrast on a fill. */
function ink(ctx: Ctx, fill: string): string {
  const { pal } = ctx;
  return pickReadable(fill, [pal.text, ctx.onPrimary, pal.bg, '#111111', '#FFFFFF'], 4.5);
}

/** A palette color that stands out from the background (for strokes and arrows). */
const lineColor = (ctx: Ctx) => ctx.accentText;

/** Card / node styling that follows the style's decorations (brutalist outlines, clay softness…). */
function flavor(ctx: Ctx) {
  const { pal, k } = ctx;
  const d = ctx.style.layout.decorations;
  const brutal = d.includes('hard-shadow') || d.includes('outline-offset-shadow');
  const clay = d.includes('clay-card');
  const paper = d.includes('paper-layers');
  const sketch = d.some((x) => /doodle|hand|scribble|sketch/.test(x));
  const plain = ctx.decoration === 'none' || ctx.decoration === 'minimal';
  return {
    brutal,
    radius: (h: number) => (brutal ? 0 : clay ? h * 0.4 : paper ? 10 * k : Math.min(h * 0.24, 30 * k)),
    stroke: brutal ? { stroke: pal.text, strokeWidth: Math.round(4 * k) } : sketch ? { stroke: pal.text, strokeWidth: Math.max(2, Math.round(3 * k)) } : {},
    shadow: plain
      ? undefined
      : brutal
        ? { color: pal.text, blur: 0, offsetX: Math.round(8 * k), offsetY: Math.round(8 * k), opacity: 1 }
        : clay
          ? { color: mix(pal.primary, '#000000', 0.4), blur: Math.round(36 * k), offsetX: 0, offsetY: Math.round(16 * k), opacity: ctx.dark ? 0.45 : 0.22 }
          : paper
            ? { color: '#000000', blur: Math.round(10 * k), offsetX: Math.round(4 * k), offsetY: Math.round(6 * k), opacity: 0.18 }
            : undefined,
  };
}

/** Card fill: the palette surface, outlined when it's too close to the background to read as a shape. */
function card(ctx: Ctx, x: number, y: number, w: number, h: number, fill = ctx.pal.surface): SlideElement {
  const { pal, k } = ctx;
  const fl = flavor(ctx);
  const faint = contrast(fill, pal.bg) < 1.15;
  const stroke = fl.stroke.stroke ? fl.stroke : faint ? { stroke: mix(pal.text, pal.bg, 0.8), strokeWidth: Math.max(1, Math.round(2 * k)) } : {};
  return rect('diagram-node', x, y, w, h, fill, { cornerRadius: fl.radius(h), ...stroke, shadow: fl.shadow });
}

// ---------- text ----------

const labelSpec = (ctx: Ctx, text: string, size: number, color: string, extra: Partial<TextSpec> = {}): TextSpec => ({
  slot: 'diagram-label', text, font: ctx.fonts.heading, weight: Math.min(ctx.headline.weight, 800), max: size, min: Math.min(size, Math.round(26 * ctx.k)),
  lineHeight: 1.12, color, gapAfter: 0.3, ...extra,
});

const detailSpec = (ctx: Ctx, text: string, size: number, color: string): TextSpec => ({
  slot: 'diagram-label', text, font: ctx.fonts.body, weight: ctx.body.weight, max: size, min: Math.min(size, Math.round(22 * ctx.k)), lineHeight: 1.25, color,
});

interface Slot { it: Item; box: Box; color: string; align?: TextElement['align']; valign?: 'top' | 'middle' | 'bottom'; detailColor?: string }

/**
 * Fits every node's label (+ small detail) inside its box at one shared size, so a diagram reads as a
 * set. A detail that can't fit even at the floor size is dropped rather than spilling out of its shape.
 */
function fitNodes(ctx: Ctx, slots: Slot[], size: number): { elements: TextElement[]; overflow: boolean } {
  const run = (sz: number) =>
    slots.map((sl) => {
      const specs = [labelSpec(ctx, sl.it.label, sz, sl.color)];
      if (sl.it.detail) specs.push(detailSpec(ctx, sl.it.detail, Math.round(sz * 0.7), sl.detailColor ?? sl.color));
      let r = fitStack(specs, sl.box, sl.valign ?? 'middle', sl.align ?? 'center');
      if (r.overflow && specs.length > 1) {
        const solo = fitStack([specs[0]!], sl.box, sl.valign ?? 'middle', sl.align ?? 'center');
        if (!solo.overflow) r = solo;
      }
      return r;
    });
  const first = run(size);
  const f = Math.min(...first.map((r) => r.scale));
  const out = f < 0.999 ? run(Math.max(Math.round(26 * ctx.k), Math.round(size * f))) : first;
  return { elements: out.flatMap((r) => r.elements), overflow: out.some((r) => r.overflow) };
}

/** A centered single-line number/marker label inside a circle. */
function badgeText(ctx: Ctx, text: string, cx: number, cy: number, r: number, color: string): TextElement[] {
  const w = r * 1.3;
  const size = Math.max(Math.round(18 * ctx.k), Math.round(r * 0.8));
  const spec: TextSpec = { slot: 'diagram-label', text, font: ctx.fonts.heading, weight: Math.min(ctx.headline.weight, 800), max: size, min: Math.round(size * 0.6), lineHeight: 1, color };
  return fitStack([spec], { x: Math.round(cx - w / 2), y: Math.round(cy - r * 0.62), w: Math.round(w), h: Math.round(r * 1.24) }, 'middle', 'center').elements;
}

// ---------- frame: headline + region for the diagram ----------

interface Frame { els: SlideElement[]; region: Box; overflow: boolean }

const bottomOf = (els: SlideElement[]) => els.reduce((m, e) => Math.max(m, e.y + e.height), 0);

function frame(ctx: Ctx, s: SlidePlan, opts: { side?: boolean; body?: boolean; headline?: boolean } = {}): Frame {
  const { box, k, pal } = ctx;
  const specs: TextSpec[] = [];
  if (opts.headline !== false && s.headline.trim()) specs.push(headSpec(ctx, s, s.headline, Math.round(ctx.sizes.head * 0.88), { gapAfter: 0.35 }));
  if (opts.body !== false && s.body.trim()) {
    const muted = contrast(pal.mutedText, pal.bg) >= 4.5 ? pal.mutedText : pal.text;
    specs.push(bodySpec(ctx, s.body, 'subline', { max: Math.round(40 * k), color: muted }));
  }
  if (!specs.length) return { els: [], region: box, overflow: false };
  if (opts.side && ctx.isLandscape) {
    const lw = Math.round(box.w * 0.36);
    const gap = Math.round(72 * k);
    const r = fitStack(specs, { ...box, w: lw }, 'middle', 'left');
    return { els: r.elements, region: { x: box.x + lw + gap, y: box.y, w: box.w - lw - gap, h: box.h }, overflow: r.overflow };
  }
  const align = ctx.align === 'center' ? 'center' : 'left';
  const r = fitStack(specs, { ...box, h: Math.round(box.h * (ctx.isLandscape ? 0.34 : 0.3)) }, 'top', align);
  const top = bottomOf(r.elements) + Math.round(52 * k);
  return { els: r.elements, region: { x: box.x, y: top, w: box.w, h: box.y + box.h - top }, overflow: r.overflow };
}

const done = (f: Frame, els: SlideElement[], overflow: boolean): LayoutResult => ({ elements: [...f.els, ...els], overflow: f.overflow || overflow });

/** A one-to-three word center/root label from the slide (short body, emphasized word or short headline). */
function shortText(s: SlidePlan, from: ('body' | 'emphasis' | 'headline')[]): string {
  for (const src of from) {
    const t = src === 'body' ? s.body.trim() : src === 'emphasis' ? (s.emphasis[0] ?? '').trim() : s.headline.trim();
    if (t && words(t).length <= 3 && t.length <= 24) return t.replace(/[.!]$/, '');
  }
  return '';
}

// ---------- 1. cycle ----------

const cycle: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 3);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  const center = shortText(s, ['body', 'emphasis']);
  const f = frame(ctx, s, { side: true, body: center !== s.body.trim().replace(/[.!]$/, '') });
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const half = Math.min(region.w, region.h) / 2;
  const sin = Math.sin(Math.PI / n);
  const start = n === 2 ? Math.PI : -Math.PI / 2;
  const ang = (j: number) => start + (j * 2 * Math.PI) / n;
  let rn = Math.min(half * 0.36, (half * sin) / (1.25 + sin), 210 * k);
  let rx = 0;
  let ry = 0;
  const pos = (t: number): [number, number] => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  for (let it = 0; it < 6; it++) {
    ry = region.h / 2 - rn - 6 * k;
    rx = Math.min(region.w / 2 - rn - 6 * k, ry * 1.25);
    ry = Math.min(ry, rx * 1.25);
    let minD = Infinity;
    for (let j = 0; j < n; j++) {
      const [ax, ay] = pos(ang(j));
      const [bx, by] = pos(ang(j + 1));
      minD = Math.min(minD, Math.hypot(bx - ax, by - ay));
    }
    rn = Math.min(rn, minD / 2.45);
  }
  const els: SlideElement[] = [];
  const stroke = lineColor(ctx);
  const sw = Math.max(3, Math.round(6 * k));
  const head = Math.round(Math.max(16, 26 * k));
  const gap = 14 * k;
  // Arrows: elliptical arcs from each node to the next, clockwise, ending in a filled head.
  for (let j = 0; j < n; j++) {
    const [ax, ay] = pos(ang(j));
    const [bx, by] = pos(ang(j + 1));
    const away = (t: number, x: number, y: number) => Math.hypot(pos(t)[0] - x, pos(t)[1] - y);
    let ts = ang(j);
    while (away(ts, ax, ay) < rn + gap && ts < ang(j + 1)) ts += 0.004;
    let tip = ang(j + 1);
    while (away(tip, bx, by) < rn + gap && tip > ts) tip -= 0.004;
    let te = tip;
    while (away(te, bx, by) < rn + gap + head * 0.7 && te > ts) te -= 0.004;
    if (te - ts < 0.05) continue;
    const pen = new Pen().M(...pos(ts)).A(rx, ry, te - ts > Math.PI ? 1 : 0, 1, ...pos(te));
    for (let q = 1; q < 4; q++) pen.bound(...pos(ts + ((te - ts) * q) / 4));
    els.push(pen.el('diagram-arrow', { stroke, strokeWidth: sw }));
    const [tx, ty] = pos(tip);
    els.push(arrowHead(tx, ty, Math.atan2(ry * Math.cos(tip), -rx * Math.sin(tip)), head, stroke));
  }
  const fl = flavor(ctx);
  const slots: Slot[] = [];
  items.forEach((it, j) => {
    const [x, y] = pos(ang(j));
    els.push(ellipse('diagram-node', x, y, rn, rn, pal.primary, { ...fl.stroke, shadow: fl.shadow }));
    slots.push({ it, box: { x: Math.round(x - rn * 0.78), y: Math.round(y - rn * 0.58), w: Math.round(rn * 1.56), h: Math.round(rn * 1.16) }, color: ink(ctx, pal.primary) });
  });
  const txt = fitNodes(ctx, slots, Math.round(Math.min(48 * k, rn * 0.34)));
  els.push(...txt.elements);
  const free = Math.min(rx, ry) - rn - 18 * k;
  if (center && free >= 70 * k) {
    const tint = mix(pal.primary, pal.bg, ctx.dark ? 0.8 : 0.88);
    els.push(ellipse('diagram-node', cx, cy, free, free, tint));
    els.push(...fitNodes(ctx, [{ it: { label: center, detail: '' }, box: { x: Math.round(cx - free * 0.8), y: Math.round(cy - free * 0.55), w: Math.round(free * 1.6), h: Math.round(free * 1.1) }, color: ink(ctx, tint) }], Math.round(Math.min(56 * k, free * 0.4))).elements);
  }
  return done(f, els, txt.overflow);
};

// ---------- 2. flow ----------

const flow: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 5);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  const f = frame(ctx, s);
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const els: SlideElement[] = [];
  const stroke = lineColor(ctx);
  const sw = Math.max(3, Math.round(5 * k));
  const onP = ink(ctx, pal.primary);
  const textColor = ink(ctx, pal.surface);
  const fl = flavor(ctx);
  const slots: Slot[] = [];
  if (n <= 4 && ctx.W / ctx.H >= 0.95) {
    // Horizontal: cards in a row with arrows between them.
    const ag = Math.round(70 * k);
    const cw = (region.w - (n - 1) * ag) / n;
    const ch = Math.min(region.h, Math.max(cw * 1.05, 300 * k), 560 * k);
    const y = region.y + (region.h - ch) / 2;
    const d = Math.min(cw * 0.3, 92 * k);
    items.forEach((it, j) => {
      const x = region.x + j * (cw + ag);
      els.push(card(ctx, x, y, cw, ch));
      const by = y + 26 * k + d / 2;
      els.push(ellipse('diagram-node', x + cw / 2, by, d / 2, d / 2, pal.primary, fl.stroke));
      els.push(...badgeText(ctx, String(j + 1), x + cw / 2, by, d / 2, onP));
      const pad = Math.round(22 * k);
      const ty = by + d / 2 + 18 * k;
      slots.push({ it, box: { x: Math.round(x + pad), y: Math.round(ty), w: Math.round(cw - 2 * pad), h: Math.round(y + ch - pad - ty) }, color: textColor });
      if (j < n - 1) els.push(line('diagram-arrow', [x + cw + 12 * k, y + ch / 2, x + cw + ag - 12 * k, y + ch / 2], stroke, sw, { arrowEnd: true }));
    });
    const txt = fitNodes(ctx, slots, Math.round(Math.min(46 * k, cw * 0.17)));
    return done(f, [...els, ...txt.elements], txt.overflow);
  }
  // Vertical: numbered badges joined by arrows, each with a card holding the step.
  const gap = Math.round(Math.max(30 * k, Math.min(56 * k, region.h * 0.05)));
  const rowH = Math.min((region.h - (n - 1) * gap) / n, 200 * k);
  const total = n * rowH + (n - 1) * gap;
  const y0 = region.y + (region.h - total) / 2;
  const d = Math.min(rowH * 0.78, 96 * k);
  const bx = region.x + d / 2;
  const cardX = region.x + d + Math.round(26 * k);
  const cardW = region.x + region.w - cardX;
  items.forEach((it, j) => {
    const y = y0 + j * (rowH + gap);
    els.push(card(ctx, cardX, y, cardW, rowH));
    els.push(ellipse('diagram-node', bx, y + rowH / 2, d / 2, d / 2, pal.primary, fl.stroke));
    els.push(...badgeText(ctx, String(j + 1), bx, y + rowH / 2, d / 2, onP));
    if (j < n - 1) {
      const a = y + rowH / 2 + d / 2 + 8 * k;
      const b = y + rowH + gap + rowH / 2 - d / 2 - 8 * k;
      if (b - a >= 18 * k) els.push(line('diagram-arrow', [bx, a, bx, b], stroke, sw, { arrowEnd: true }));
    }
    const padX = Math.round(30 * k);
    const padY = Math.round(Math.min(18 * k, rowH * 0.1));
    slots.push({ it, box: { x: Math.round(cardX + padX), y: Math.round(y + padY), w: Math.round(cardW - 2 * padX), h: Math.round(rowH - 2 * padY) }, color: textColor, align: 'left' });
  });
  const txt = fitNodes(ctx, slots, Math.round(Math.min(46 * k, rowH * 0.36)));
  return done(f, [...els, ...txt.elements], txt.overflow);
};

// ---------- 3. venn ----------

const venn: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 2);
  if (items.length < 2 || items.length > 3) return fallback(ctx, s, i);
  const center = shortText(s, ['body', 'emphasis']);
  const f = frame(ctx, s, { side: true, body: center !== s.body.trim().replace(/[.!]$/, '') });
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const colors = [pal.primary, pal.accent, pal.highlight];
  if (contrast(colors[1]!, colors[0]!) < 1.3) colors[1] = mix(pal.primary, pal.text, 0.45);
  if (contrast(colors[2]!, pal.bg) < 1.3 || contrast(colors[2]!, colors[0]!) < 1.3) colors[2] = mix(pal.accent, pal.text, 0.35);
  let r: number;
  let centers: [number, number][];
  let labelBoxes: Box[];
  if (n === 2) {
    r = Math.min(region.w / 3.15, region.h / 2.05, 330 * k);
    const d = r * 1.1;
    centers = [[cx - d / 2, cy], [cx + d / 2, cy]];
    labelBoxes = centers.map(([x], j) => {
      const lx = j === 0 ? x - r * 0.5 : x + r * 0.5;
      return { x: Math.round(lx - r * 0.42), y: Math.round(cy - r * 0.36), w: Math.round(r * 0.84), h: Math.round(r * 0.72) };
    });
  } else {
    r = Math.min(region.w / 3.15, region.h / 2.98, 300 * k);
    const D = r * 0.62;
    const oy = cy + r * 0.15;
    centers = [-90, 30, 150].map((a) => [cx + D * Math.cos((a * Math.PI) / 180), oy + D * Math.sin((a * Math.PI) / 180)]);
    labelBoxes = [-90, 30, 150].map((a, j) => {
      const [x, y] = centers[j]!;
      const lx = x + r * 0.5 * Math.cos((a * Math.PI) / 180);
      const ly = y + r * 0.5 * Math.sin((a * Math.PI) / 180);
      return { x: Math.round(lx - r * 0.44), y: Math.round(ly - r * 0.24), w: Math.round(r * 0.88), h: Math.round(r * 0.48) };
    });
  }
  // Translucent fills: as strong as the labels' contrast allows (text sits on 1 layer, the center on all).
  let op = 0.42;
  const over = (cols: string[], o: number) => cols.reduce((c, col) => mix(c, col, o), pal.bg);
  const textOk = (o: number) => colors.slice(0, n).every((c) => contrast(pal.text, over([c], o)) >= 4.5) && contrast(pal.text, over(colors.slice(0, n), o)) >= 4.5;
  while (op > 0.12 && !textOk(op)) op -= 0.04;
  const els: SlideElement[] = [];
  const sw = Math.max(2, Math.round(4 * k));
  centers.forEach(([x, y], j) => els.push(ellipse('diagram-node', x, y, r, r, colors[j]!, { opacity: op })));
  centers.forEach(([x, y], j) => els.push(ellipse('diagram-ring', x, y, r, r, 'transparent', { stroke: colors[j]!, strokeWidth: sw })));
  const slots: Slot[] = items.map((it, j) => ({ it, box: labelBoxes[j]!, color: textOk(op) ? pal.text : ink(ctx, over([colors[j]!], op)) }));
  const txt = fitNodes(ctx, slots, Math.round(Math.min(50 * k, r * 0.2)));
  els.push(...txt.elements);
  if (center) {
    const cw = n === 2 ? r * 0.62 : r * 0.62;
    const ch = n === 2 ? r * 0.7 : r * 0.36;
    const ccy = n === 2 ? cy : cy + r * 0.15;
    const col = textOk(op) ? pal.text : ink(ctx, over(colors.slice(0, n), op));
    els.push(...fitNodes(ctx, [{ it: { label: center, detail: '' }, box: { x: Math.round(cx - cw / 2), y: Math.round(ccy - ch / 2), w: Math.round(cw), h: Math.round(ch) }, color: col }], Math.round(Math.min(44 * k, r * 0.17))).elements);
  }
  return done(f, els, txt.overflow);
};

// ---------- 4. pyramid ----------

const pyramid: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 4);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  const f = frame(ctx, s, { side: true });
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  // "Foundation"/"build" content reads bottom-up: the first item is the base.
  const bottomUp = /\b(foundation|base|bottom|build|built|roots?)\b/i.test(`${s.headline} ${s.layoutHint}`);
  const order = bottomUp ? [...items].reverse() : items;
  const g = Math.round(10 * k);
  const pw = Math.min(region.w, region.h * 1.35);
  const th = Math.min((region.h - (n - 1) * g) / n, 190 * k);
  const ph = n * th + (n - 1) * g;
  const top = region.y + (region.h - ph) / 2;
  const cx = region.x + region.w / 2;
  const topW = pw * 0.26;
  const wAt = (y: number) => topW + ((pw - topW) * (y - top)) / ph;
  const els: SlideElement[] = [];
  const slots: Slot[] = [];
  const fl = flavor(ctx);
  order.forEach((it, j) => {
    const y0 = top + j * (th + g);
    const y1 = y0 + th;
    const fill = n > 1 ? mix(pal.primary, pal.bg, (j / (n - 1)) * (ctx.dark ? 0.45 : 0.6)) : pal.primary;
    const w0 = wAt(y0);
    const w1 = wAt(y1);
    const pen = new Pen().M(cx - w0 / 2, y0).L(cx + w0 / 2, y0).L(cx + w1 / 2, y1).L(cx - w1 / 2, y1).Z();
    els.push(pen.el('diagram-node', { fill, stroke: fl.stroke.stroke, strokeWidth: fl.stroke.strokeWidth, shadow: fl.brutal ? undefined : fl.shadow }));
    const vpad = Math.round(Math.min(12 * k, th * 0.08));
    const tw = wAt(y0 + vpad) - 2 * Math.round(24 * k) - (wAt(y1) - wAt(y0)) * 0.1;
    slots.push({ it, box: { x: Math.round(cx - tw / 2), y: Math.round(y0 + vpad), w: Math.round(tw), h: Math.round(th - 2 * vpad) }, color: ink(ctx, fill) });
  });
  const txt = fitNodes(ctx, slots, Math.round(Math.min(46 * k, th * 0.34)));
  return done(f, [...els, ...txt.elements], txt.overflow);
};

// ---------- 5. tree ----------

const tree: LayoutFn = (ctx, s, i) => {
  let items = itemsFor(s, 3);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  let root = shortText(s, ['emphasis', 'headline']);
  let rootDetail = '';
  if (!root && items.length >= 3) {
    root = items[0]!.label;
    rootDetail = items[0]!.detail;
    items = items.slice(1);
  }
  if (!root) root = words(s.headline).slice(0, 3).join(' ') || 'Root';
  const f = frame(ctx, s, { side: true });
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const els: SlideElement[] = [];
  const slots: Slot[] = [];
  const stroke = mix(lineColor(ctx), pal.bg, 0.15);
  const sw = Math.max(3, Math.round(6 * k));
  const textColor = ink(ctx, pal.surface);
  const rootH = Math.round(Math.min(130 * k, region.h * 0.2));
  const rootW = Math.round(Math.min(region.w * 0.62, 520 * k));
  const rcx = region.x + region.w / 2;
  const rootY = region.y;
  const rootFill = pal.primary;
  const fl = flavor(ctx);
  const rowMode = n <= 3 || (region.w / region.h > 1.5 && n <= 5);
  const links: SlideElement[] = [];
  if (rowMode) {
    const gap = Math.round(28 * k);
    const cw = (region.w - (n - 1) * gap) / n;
    const ch = Math.min(region.h * 0.42, Math.max(cw * 0.7, 180 * k), 300 * k);
    const cy = region.y + region.h - ch;
    items.forEach((it, j) => {
      const x = region.x + j * (cw + gap);
      const ccx = x + cw / 2;
      const a = rootY + rootH;
      const mid = (a + cy) / 2;
      links.push(new Pen().M(rcx, a).C(rcx, mid, ccx, mid, ccx, cy).el('diagram-link', { stroke, strokeWidth: sw }));
      links.push(ellipse('diagram-link', ccx, cy, 9 * k, 9 * k, stroke));
      els.push(card(ctx, x, cy, cw, ch));
      const pad = Math.round(20 * k);
      slots.push({ it, box: { x: Math.round(x + pad), y: Math.round(cy + pad), w: Math.round(cw - 2 * pad), h: Math.round(ch - 2 * pad) }, color: textColor });
    });
  } else {
    // Vine: a trunk down the middle, branches alternating left and right.
    const top = rootY + rootH + Math.round(30 * k);
    const rowH = (region.y + region.h - top) / n;
    const trunkGap = Math.round(36 * k);
    const pw = (region.w - 2 * trunkGap) / 2;
    const ph = Math.min(rowH * 1.7, 180 * k);
    const lastY = top + rowH * (n - 0.5);
    links.push(line('diagram-link', [rcx, rootY + rootH, rcx, lastY], stroke, sw));
    items.forEach((it, j) => {
      const yc = top + rowH * (j + 0.5);
      const left = j % 2 === 0;
      const x = left ? region.x : rcx + trunkGap;
      const edge = left ? x + pw : x;
      const py = Math.max(top, Math.min(region.y + region.h - ph, yc - ph / 2));
      const ey = py + ph / 2;
      const ty = Math.min(lastY, yc - Math.min(rowH * 0.25, 30 * k));
      links.push(new Pen().M(rcx, ty).C(rcx + (edge - rcx) * 0.5, ty, edge - (edge - rcx) * 0.3, ey, edge, ey).el('diagram-link', { stroke, strokeWidth: sw }));
      links.push(ellipse('diagram-link', rcx, ty, 11 * k, 11 * k, pal.primary));
      els.push(card(ctx, x, py, pw, ph));
      const pad = Math.round(22 * k);
      slots.push({ it, box: { x: Math.round(x + pad), y: Math.round(py + Math.min(pad, ph * 0.1)), w: Math.round(pw - 2 * pad), h: Math.round(ph - 2 * Math.min(pad, ph * 0.1)) }, color: textColor, align: left ? 'right' : 'left' });
    });
  }
  els.unshift(...links);
  els.push(rect('diagram-node', rcx - rootW / 2, rootY, rootW, rootH, rootFill, { cornerRadius: fl.brutal ? 0 : rootH / 2, ...fl.stroke, shadow: fl.shadow }));
  const rootTxt = fitNodes(ctx, [{ it: { label: root, detail: rootDetail }, box: { x: Math.round(rcx - rootW / 2 + rootH * 0.4), y: Math.round(rootY + rootH * 0.12), w: Math.round(rootW - rootH * 0.8), h: Math.round(rootH * 0.76) }, color: ink(ctx, rootFill) }], Math.round(Math.min(50 * k, rootH * 0.42)));
  const txt = fitNodes(ctx, slots, Math.round(44 * k));
  return done(f, [...els, ...rootTxt.elements, ...txt.elements], txt.overflow || rootTxt.overflow);
};

// ---------- 6. journey ----------

const journey: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 4);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  const f = frame(ctx, s);
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const els: SlideElement[] = [];
  const slots: Slot[] = [];
  const road = mix(pal.primary, pal.bg, ctx.dark ? 0.6 : 0.72);
  const roadW = Math.round(22 * k);
  const onP = ink(ctx, pal.primary);
  const horizontal = ctx.W / ctx.H > 1.15;
  const pts: [number, number][] = [];
  let dr: number;
  if (horizontal) {
    const colW = region.w / n;
    const A = Math.min(region.h * 0.12, 70 * k);
    const cy = region.y + region.h / 2;
    dr = Math.min(colW * 0.16, 40 * k);
    for (let j = 0; j < n; j++) pts.push([region.x + colW * (j + 0.5), cy + (j % 2 === 0 ? -A : A)]);
    const pen = new Pen().M(region.x, pts[0]![1]).L(...pts[0]!);
    for (let j = 1; j < n; j++) {
      const [ax, ay] = pts[j - 1]!;
      const [bx, by] = pts[j]!;
      pen.C(ax + colW * 0.55, ay, bx - colW * 0.55, by, bx, by);
    }
    pen.L(region.x + region.w, pts[n - 1]![1]);
    els.push(pen.el('diagram-link', { stroke: road, strokeWidth: roadW }));
    pts.forEach(([x, y], j) => {
      const up = y < cy;
      const lw = Math.min(colW * 1.8, region.w) - 16 * k;
      const lx = Math.max(region.x, Math.min(region.x + region.w - lw, x - lw / 2));
      const box = up
        ? { x: Math.round(lx), y: region.y, w: Math.round(lw), h: Math.round(y - dr - 22 * k - region.y) }
        : { x: Math.round(lx), y: Math.round(y + dr + 22 * k), w: Math.round(lw), h: Math.round(region.y + region.h - (y + dr + 22 * k)) };
      slots.push({ it: items[j]!, box, color: pal.text, valign: up ? 'bottom' : 'top', detailColor: contrast(pal.mutedText, pal.bg) >= 4.5 ? pal.mutedText : pal.text });
    });
  } else {
    const rowH = region.h / n;
    const A = Math.min(region.w * 0.11, 100 * k);
    const cx = region.x + region.w / 2;
    dr = Math.min(rowH * 0.3, 42 * k);
    for (let j = 0; j < n; j++) pts.push([cx + (j % 2 === 0 ? -A : A), region.y + rowH * (j + 0.5)]);
    const pen = new Pen().M(pts[0]![0], region.y).L(...pts[0]!);
    for (let j = 1; j < n; j++) {
      const [ax, ay] = pts[j - 1]!;
      const [bx, by] = pts[j]!;
      pen.C(ax, ay + rowH * 0.6, bx, by - rowH * 0.6, bx, by);
    }
    pen.L(pts[n - 1]![0], region.y + region.h);
    els.push(pen.el('diagram-link', { stroke: road, strokeWidth: roadW }));
    pts.forEach(([x, y], j) => {
      const left = x < cx;
      const g = dr + 26 * k;
      const lh = Math.min(rowH * 1.9, region.h);
      const ly = Math.max(region.y, Math.min(region.y + region.h - lh, y - lh / 2));
      const box = left
        ? { x: region.x, y: Math.round(ly), w: Math.round(x - g - region.x), h: Math.round(lh) }
        : { x: Math.round(x + g), y: Math.round(ly), w: Math.round(region.x + region.w - x - g), h: Math.round(lh) };
      slots.push({ it: items[j]!, box, color: pal.text, align: left ? 'right' : 'left', detailColor: contrast(pal.mutedText, pal.bg) >= 4.5 ? pal.mutedText : pal.text });
    });
  }
  // A thin center line makes the path read as a road.
  const dash = els[0] as PathElement;
  els.push({ ...dash, id: `${dash.id}d`, slot: 'diagram-link', stroke: pal.bg, strokeWidth: Math.max(2, Math.round(3 * k)), opacity: 0.8 } as PathElement);
  pts.forEach(([x, y], j) => {
    els.push(ellipse('diagram-node', x, y, dr, dr, pal.primary, { stroke: pal.bg, strokeWidth: Math.round(6 * k) }));
    if (dr >= 22 * k) els.push(...badgeText(ctx, String(j + 1), x, y, dr, onP));
  });
  const txt = fitNodes(ctx, slots, Math.round(44 * k));
  return done(f, [...els, ...txt.elements], txt.overflow);
};

// ---------- 7. versus ----------

const versus: LayoutFn = (ctx, s, i) => {
  const vs = parseVs(s.headline) ?? parseVs(s.layoutHint);
  const raw = rawItems(s);
  let titles: [Item, Item];
  let lists: [string[], string[]] = [[], []];
  if (vs && parseVs(s.headline)) {
    titles = [{ label: vs.a, detail: '' }, { label: vs.b, detail: '' }];
    const half = Math.ceil(raw.length / 2);
    lists = [raw.slice(0, half), raw.slice(half)];
  } else if (raw.length === 2) {
    titles = [splitItem(raw[0]!, 3), splitItem(raw[1]!, 3)];
  } else return LAYOUTS['compare-split']!(ctx, s, i);
  const arrow = vs?.arrow ?? /before|after|→|->|becom|transform|old|new/i.test(`${s.layoutHint} ${s.headline}`);
  const headlineIsPair = Boolean(parseVs(s.headline)) && words(s.headline).length <= 7;
  const f = frame(ctx, s, { headline: !headlineIsPair });
  const { region } = f;
  const { k, pal } = ctx;
  const els: SlideElement[] = [];
  const br = Math.round(Math.min(68 * k, region.w * 0.075));
  const gap = Math.round(br * 0.9);
  const cw = (region.w - gap) / 2;
  const hasLists = lists[0].length + lists[1].length > 0;
  const ch = hasLists ? Math.min(region.h, 900 * k) : Math.min(region.h, Math.max(cw * 1.15, 320 * k), 700 * k);
  const y = region.y + (region.h - ch) / 2;
  const fills = [pal.surface, pal.primary];
  const fl = flavor(ctx);
  const out: TextElement[] = [];
  let overflow = false;
  [0, 1].forEach((c) => {
    const x = region.x + c * (cw + gap);
    els.push(c === 0 ? card(ctx, x, y, cw, ch) : rect('diagram-node', x, y, cw, ch, fills[1]!, { cornerRadius: fl.radius(ch), ...fl.stroke, shadow: fl.shadow }));
    const color = ink(ctx, fills[c]!);
    const outer = Math.round(36 * k);
    const inner = Math.round(br * 0.55 + 24 * k);
    const box = { x: Math.round(c === 0 ? x + outer : x + inner), y: Math.round(y + outer), w: Math.round(cw - outer - inner), h: Math.round(ch - 2 * outer) };
    const t = titles[c]!;
    const specs: TextSpec[] = [labelSpec(ctx, t.label, Math.round(Math.min(68 * k, cw * 0.16) * ctx.headline.scale), color, { gapAfter: 0.5, textCase: ctx.headline.textCase })];
    if (t.detail) specs.push(detailSpec(ctx, t.detail, Math.round(38 * k), color));
    lists[c]!.forEach((b) => specs.push({ ...detailSpec(ctx, b, Math.round(38 * k), color), gapAfter: 0.55 }));
    const r = fitStack(specs, box, 'middle', 'center');
    out.push(...r.elements);
    overflow ||= r.overflow;
  });
  // Center badge: "VS" for a contrast, an arrow for a transformation.
  const bx = region.x + cw + gap / 2;
  const by = y + ch / 2;
  els.push(ellipse('diagram-node', bx, by, br, br, pal.bg, { stroke: lineColor(ctx), strokeWidth: Math.max(3, Math.round(5 * k)) }));
  if (arrow) {
    const a = br * 0.5;
    els.push(line('diagram-arrow', [bx - a, by, bx + a * 0.85, by], lineColor(ctx), Math.max(3, Math.round(7 * k)), { arrowEnd: true }));
  } else els.push(...badgeText(ctx, 'VS', bx, by, br * 0.78, ink(ctx, pal.bg)));
  return done(f, [...els, ...out], overflow);
};

// ---------- 8. stairs ----------

const stairs: LayoutFn = (ctx, s, i) => {
  const items = itemsFor(s, 4);
  if (items.length < 2 || items.length > 6) return fallback(ctx, s, i);
  const f = frame(ctx, s);
  const { region } = f;
  const { k, pal } = ctx;
  const n = items.length;
  const els: SlideElement[] = [];
  const slots: Slot[] = [];
  const fl = flavor(ctx);
  const fillAt = (j: number) => (n > 1 ? mix(pal.primary, pal.bg, (1 - j / (n - 1)) * (ctx.dark ? 0.5 : 0.65)) : pal.primary);
  const numSlots: TextElement[] = [];
  if (ctx.W / ctx.H > 1.15) {
    // Rising columns, first step on the left.
    const g = Math.round(16 * k);
    const cw = (region.w - (n - 1) * g) / n;
    const hMin = region.h * 0.36;
    items.forEach((it, j) => {
      const h = n > 1 ? hMin + ((region.h - hMin) * j) / (n - 1) : region.h;
      const x = region.x + j * (cw + g);
      const y = region.y + region.h - h;
      const fill = fillAt(j);
      els.push(rect('diagram-node', x, y, cw, h, fill, { cornerRadius: fl.brutal ? 0 : Math.round(16 * k), ...fl.stroke, shadow: fl.shadow }));
      const pad = Math.round(22 * k);
      const num = Math.round(Math.min(56 * k, cw * 0.22));
      numSlots.push(...fitStack([{ ...labelSpec(ctx, String(j + 1).padStart(2, '0'), num, ink(ctx, fill)), min: Math.round(num * 0.7) }], { x: Math.round(x + pad), y: Math.round(y + pad), w: Math.round(cw - 2 * pad), h: Math.round(num * 1.2) }, 'top', 'left').elements);
      const ty = y + pad + num * 1.2 + 10 * k;
      slots.push({ it, box: { x: Math.round(x + pad), y: Math.round(ty), w: Math.round(cw - 2 * pad), h: Math.round(Math.min(y + h - pad - ty, hMin)) }, color: ink(ctx, fill), align: 'left', valign: 'top' });
    });
  } else {
    // Bars stacked as a staircase climbing to the right; the first step is the bottom one.
    const g = Math.round(12 * k);
    const bh = Math.min((region.h - (n - 1) * g) / n, 170 * k);
    const total = n * bh + (n - 1) * g;
    const bottom = region.y + (region.h + total) / 2;
    const dx = n > 1 ? Math.min((region.w * 0.42) / (n - 1), 110 * k) : 0;
    items.forEach((it, j) => {
      const y = bottom - (j + 1) * bh - j * g;
      const x = region.x + j * dx;
      const w = region.x + region.w - x;
      const fill = fillAt(j);
      els.push(rect('diagram-node', x, y, w, bh, fill, { cornerRadius: fl.brutal ? 0 : Math.round(Math.min(16 * k, bh * 0.2)), ...fl.stroke, shadow: fl.shadow }));
      const pad = Math.round(26 * k);
      const num = Math.round(Math.min(52 * k, bh * 0.42));
      const numW = Math.round(num * 1.5);
      numSlots.push(...fitStack([{ ...labelSpec(ctx, String(j + 1).padStart(2, '0'), num, ink(ctx, fill)), min: Math.round(num * 0.7), lineHeight: 1 }], { x: Math.round(x + pad), y: Math.round(y + bh / 2 - num * 0.55), w: numW, h: Math.round(num * 1.1) }, 'middle', 'left').elements);
      const vpad = Math.round(Math.min(14 * k, bh * 0.1));
      slots.push({ it, box: { x: Math.round(x + pad + numW + 14 * k), y: Math.round(y + vpad), w: Math.round(w - 2 * pad - numW - 14 * k), h: Math.round(bh - 2 * vpad) }, color: ink(ctx, fill), align: 'left' });
    });
    // A rising arrow in the empty space left of the steps.
    if (n >= 3 && dx >= 50 * k) {
      const x1 = region.x + dx * 0.25;
      const y1 = bottom - bh - g - bh * 0.2;
      const x2 = region.x + (n - 1) * dx - dx * 0.35;
      const y2 = bottom - (n - 1) * (bh + g) - bh * 0.1;
      if (x2 - x1 > 40 * k) els.push(line('diagram-arrow', [x1, y1, x2, y2], lineColor(ctx), Math.max(3, Math.round(6 * k)), { arrowEnd: true }));
    }
  }
  const txt = fitNodes(ctx, slots, Math.round(44 * k));
  return done(f, [...els, ...numSlots, ...txt.elements], txt.overflow);
};

export const DIAGRAM_LAYOUTS: Record<string, LayoutFn> = {
  'diagram-cycle': cycle,
  'diagram-flow': flow,
  'diagram-venn': venn,
  'diagram-pyramid': pyramid,
  'diagram-tree': tree,
  'diagram-journey': journey,
  'diagram-versus': versus,
  'diagram-stairs': stairs,
};

// ---------- choosing a diagram ----------

const NEVER = new Set<SlidePlan['role']>(['hook', 'cta', 'quote', 'stat']);
const INFER_ROLES = new Set<SlidePlan['role']>(['list', 'step', 'summary', 'body']);

/** Explicit layout hints → diagram (checked in order; stairs before flow so "steps to grow" climbs). */
const HINTS: [RegExp, string][] = [
  [/\b(cycle|loop|rhythm|repeat(ing)?|circular|recurring)\b/i, 'diagram-cycle'],
  [/\b(venn|overlap(ping)?|intersection|both)\b/i, 'diagram-venn'],
  [/\b(pyramid|hierarchy|foundation|tiers?)\b/i, 'diagram-pyramid'],
  [/\b(tree|branch(es)?|mind ?map|vine)\b/i, 'diagram-tree'],
  [/\b(journey|path|road|timeline|story|roadmap)\b/i, 'diagram-journey'],
  [/\b(vs\.?|versus|balance|contrast|before.{0,6}after|scale)\b/i, 'diagram-versus'],
  [/\b(stairs?|staircase|ladder|grow(th|ing)?|climb)\b/i, 'diagram-stairs'],
  [/\b(flow|process|steps|pipeline|sequence|arrows?)\b/i, 'diagram-flow'],
];

const SEQ_START = /^(first(ly)?|second(ly)?|third|then|next|finally|lastly|after|begin|start|\d+[.)])\b/i;

/** The diagram a slide's content asks for, ignoring how many diagrams the carousel already has. */
function candidate(s: SlidePlan): { id: string; hinted: boolean } | null {
  if (NEVER.has(s.role)) return null;
  const raw = rawItems(s);
  const vsHead = parseVs(s.headline);
  const n = raw.length;
  if (s.layoutHint.trim()) {
    for (const [re, id] of HINTS) {
      if (!re.test(s.layoutHint)) continue;
      const ok = id === 'diagram-versus' ? n === 2 || Boolean(vsHead) : id === 'diagram-venn' ? n >= 2 && n <= 3 : n >= 2 && n <= 6;
      if (ok) return { id, hinted: true };
    }
  }
  const versusOk = n === 2 || (vsHead !== null && n <= 6);
  if (!INFER_ROLES.has(s.role) && !(s.role === 'comparison' && versusOk && n === 2)) return null;
  if (n < 2 || n > 6 || raw.some((b) => words(b).length > 7)) return null;
  const h = s.headline;
  if (/\b(vs\.?|versus)\b/i.test(h) && versusOk) return { id: 'diagram-versus', hinted: false };
  if (/\bor\b/i.test(h) && n === 2) return { id: 'diagram-versus', hinted: false };
  if (s.role === 'comparison') return null;
  if (/\b(cycle|rhythm|daily|habit loop|routine|loop)\b/i.test(h) && n >= 3) return { id: 'diagram-cycle', hinted: false };
  if (/\b(foundations?|priorit(y|ies)|levels|hierarchy)\b/i.test(h) && n >= 3 && n <= 5) return { id: 'diagram-pyramid', hinted: false };
  if (/\b(fruits?|branch(es)?|vine|roots?)\b/i.test(h) && n >= 2) return { id: 'diagram-tree', hinted: false };
  if (/\b(journey|path|road|story)\b/i.test(h) && n >= 3) return { id: 'diagram-journey', hinted: false };
  if (/\b(grow(th|ing)?|steps? to|ladder|climb)\b/i.test(h) && n >= 3) return { id: 'diagram-stairs', hinted: false };
  const text = `${h} ${s.body}`.toLowerCase();
  if (n <= 3 && /\b(and|&)\b|·/.test(text) && raw.every((b) => words(b).length <= 2 && text.includes(b.toLowerCase().replace(/[.!]$/, '')))) return { id: 'diagram-venn', hinted: false };
  if ((s.role === 'step' && n >= 3) || raw.filter((b) => SEQ_START.test(b.trim())).length >= Math.max(2, n - 1)) return { id: 'diagram-flow', hinted: false };
  return null;
}

/**
 * The diagram layout id that suits a slide (from its layout hint and content), or null. Explicit hints
 * always win; inferred diagrams are capped at about half the carousel and never repeat back to back.
 */
export function diagramFor(s: SlidePlan, ctx: Ctx): string | null {
  const slides = ctx.plan.slides;
  const index = slides.indexOf(s);
  if (index < 0) return candidate(s)?.id ?? null;
  const budget = Math.max(1, Math.floor(slides.length / 2));
  let used = 0;
  let prev: string | null = null;
  for (let j = 0; j <= index; j++) {
    const c = candidate(slides[j]!);
    let id: string | null = null;
    if (c && (c.hinted || (used < budget && c.id !== prev))) id = c.id;
    if (j === index) return id;
    if (id) used++;
    prev = id;
  }
  return null;
}
