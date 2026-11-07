// Building blocks shared by scenes and props: a drawing context with palette tones, plus reusable
// flat-vector elements (sun, clouds, hills, trees, sheep, birds, waves, boats, stars…).

import { luminance } from '@/styles/color';
import { character, NEUTRALS as N } from './characters';
import {
  arcBand,
  arcLine,
  arcShape,
  capsule,
  circle,
  cloud,
  curve,
  ellipse,
  mul,
  apply,
  poly,
  type Pt,
  type Rand,
  roundPoly,
  rrect,
  scaleAt,
  sparkle,
  star,
  transformPath,
  translate,
  blob,
  type Mat,
} from './geom';
import type { ArtLoop, ArtMover, ArtPalette, ArtPart, CharacterSpec } from './types';

export class Ctx {
  parts: ArtPart[] = [];
  movers: ArtMover[] = [];
  /** Darker / lighter of ink and bg (for shading that works on light and dark palettes). */
  readonly dark: string;
  readonly light: string;
  readonly isDark: boolean;
  private m: Mat | null = null;
  private sink: ArtPart[] | null = null;

  constructor(
    readonly pal: ArtPalette,
    readonly r: Rand,
  ) {
    this.isDark = luminance(pal.bg) < luminance(pal.ink);
    this.dark = this.isDark ? pal.bg : pal.ink;
    this.light = this.isDark ? pal.ink : pal.surface;
  }

  private tx(d: string) {
    return this.m ? transformPath(d, this.m) : d;
  }

  add(d: string, fill: string, opacity?: number, extra: Partial<ArtPart> = {}) {
    const p: ArtPart = { d: this.tx(d), fill, ...extra };
    if (opacity != null && opacity < 1) p.opacity = opacity;
    (this.sink ?? this.parts).push(p);
  }

  stroke(d: string, color: string, width: number, opacity?: number) {
    this.add(d, 'none', opacity, { stroke: color, strokeWidth: width });
  }

  /** Fill with `color` pushed `t` of the way toward the background (aerial perspective / tints). */
  tone(d: string, color: string, t: number, toward = this.pal.bg) {
    this.add(d, color);
    if (t > 0) this.add(d, toward, t);
  }

  shade(d: string, op = 0.14) {
    this.add(d, this.dark, op);
  }

  glow(d: string, op = 0.25) {
    this.add(d, this.light, op);
  }

  /** Collect everything drawn inside `fn` into a mover. */
  mover(name: string, loop: ArtLoop, pivot: Pt, fn: () => void, phase = 0) {
    const prev = this.sink;
    const sink: ArtPart[] = [];
    this.sink = sink;
    fn();
    this.sink = prev;
    if (sink.length) this.movers.push({ name, parts: sink, pivot: this.m ? apply(this.m, pivot) : pivot, loop, phase: Math.round(phase * 100) / 100 });
  }

  /** Draw with a temporary transform (e.g. a reusable element at a position and scale). */
  at(m: Mat, fn: () => void) {
    const prev = this.m;
    this.m = prev ? mul(prev, m) : m;
    fn();
    this.m = prev;
  }

  /** Place a character with its feet at (x, y), `h` art units tall (adult). */
  person(spec: CharacterSpec, x: number, y: number, h: number) {
    const s = h / 320;
    const m: Mat = mul(translate(x - 100 * s, y - 314 * s), scaleAt(s, s));
    const piece = character(spec);
    // Soft ground shadow.
    this.add(ellipse(x, y, 52 * s * (spec.child ? 0.7 : 1), 9 * s), this.dark, 0.12);
    for (const p of piece.parts) (this.sink ?? this.parts).push({ ...p, d: transformPath(p.d, m), ...(p.strokeWidth ? { strokeWidth: p.strokeWidth * s } : {}) });
    for (const mv of piece.movers ?? [])
      this.movers.push({
        ...mv,
        name: `person-${mv.name}`,
        pivot: apply(m, mv.pivot),
        parts: mv.parts.map((p) => ({ ...p, d: transformPath(p.d, m) })),
      });
  }
}

// ---------------------------------------------------------------------------------------------
// Sky & light
// ---------------------------------------------------------------------------------------------

export function sky(c: Ctx, night = false) {
  const { pal } = c;
  if (night) {
    if (c.isDark) c.add(rrect(0, 0, 1000, 600), pal.bg);
    else {
      c.add(rrect(0, 0, 1000, 600), pal.primary);
      c.add(rrect(0, 0, 1000, 600), pal.ink, 0.55);
    }
    return;
  }
  c.add(rrect(0, 0, 1000, 600), pal.softer);
  // Gentle horizon glow: stacked translucent bands read as a soft gradient.
  for (let i = 0; i < 6; i++) c.add(rrect(0, 150 + i * 45, 1000, 450 - i * 45), pal.highlight, c.isDark ? 0.025 : 0.05);
}

export function sun(c: Ctx, x: number, y: number, r: number, color = c.pal.highlight, move = true, spot = false) {
  const draw = () => {
    const sp = spot ? { spot: true } : {};
    c.add(circle(x, y, r * 1.9), color, 0.14, sp);
    c.add(circle(x, y, r * 1.45), color, 0.22, sp);
    c.add(circle(x, y, r), color, undefined, sp);
    c.glow(arcShape(x, y, r * 0.78, r * 0.78, 200, 260), 0.35);
  };
  if (move) c.mover('sun', 'drift', [x, y], draw, 0);
  else draw();
}

export function rays(c: Ctx, x: number, y: number, r0: number, r1max: number, n: number, color: string, op = 0.18, rot = 0, spread = 360, from = 0, box: [number, number] = [1000, 600]) {
  for (let i = 0; i < n; i++) {
    const a = ((from + rot + (spread / n) * (i + 0.5)) * Math.PI) / 180;
    const w = ((spread / n) * 0.32 * Math.PI) / 180;
    // Trim each ray where it leaves the (slightly padded) canvas so geometry stays near the viewBox.
    const pad = box[0] * 0.06;
    const lim = (p: number, d: number, hi: number) => (d > 1e-6 ? (hi + pad - p) / d : d < -1e-6 ? (-pad - p) / d : Infinity);
    const r1 = Math.max(r0 + 1, Math.min(r1max, ...[a - w, a + w].flatMap((e) => [lim(x, Math.cos(e), box[0]), lim(y, Math.sin(e), box[1])])));
    c.add(
      poly([
        [x + Math.cos(a - w * 0.3) * r0, y + Math.sin(a - w * 0.3) * r0],
        [x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1],
        [x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1],
        [x + Math.cos(a + w * 0.3) * r0, y + Math.sin(a + w * 0.3) * r0],
      ]),
      color,
      op,
    );
  }
}

export function moon(c: Ctx, x: number, y: number, r: number) {
  c.mover(
    'moon',
    'drift',
    [x, y],
    () => {
      c.add(circle(x, y, r * 1.8), c.pal.highlight, 0.1);
      // Crescent: full disc with an offset disc in the sky color on top.
      c.add(circle(x, y, r), c.pal.highlight);
      c.add(circle(x + r * 0.45, y - r * 0.25, r * 0.85), c.isDark ? c.pal.bg : c.pal.primary);
      if (!c.isDark) c.add(circle(x + r * 0.45, y - r * 0.25, r * 0.85), c.pal.ink, 0.55);
    },
    0,
  );
}

export function clouds(c: Ctx, n: number, y0: number, y1: number, color = c.light, op = 0.95, avoid?: [number, number]) {
  if (c.isDark) op = Math.min(op, 0.22);
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let k = 0; k < 8; k++) {
      x = c.r.range(70, 930);
      if (xs.every((o) => Math.abs(o - x) > 190) && (!avoid || Math.abs(x - avoid[0]) > avoid[1])) break;
    }
    xs.push(x);
    const y = c.r.range(y0, y1);
    const w = c.r.range(110, 180);
    const seed = c.r.int(0, 9);
    c.mover(`cloud-${i}`, 'drift', [x, y], () => c.add(cloud(x, y, w, seed), color, op), i * 1.3);
  }
}

export function birds(c: Ctx, n: number, x0: number, x1: number, y0: number, y1: number, color = c.dark) {
  for (let i = 0; i < n; i++) {
    const x = c.r.range(x0, x1);
    const y = c.r.range(y0, y1);
    const s = c.r.range(0.8, 1.3);
    c.mover(`bird-${i}`, 'float', [x, y], () => c.stroke(`M${x - 13 * s} ${y - 4 * s}Q${x - 6 * s} ${y - 9 * s} ${x} ${y}Q${x + 6 * s} ${y - 9 * s} ${x + 13 * s} ${y - 4 * s}`, color, 3.2 * s, 0.7), i * 0.7);
  }
}

export function stars(c: Ctx, n: number, y1: number, avoid: [number, number, number][] = []) {
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < 10; k++) {
      x = c.r.range(20, 980);
      y = c.r.range(20, y1);
      if (avoid.every(([ax, ay, ar]) => Math.hypot(ax - x, ay - y) > ar)) break;
    }
    const big = c.r.chance(0.3);
    const draw = () => (big ? c.add(sparkle(x, y, c.r.range(9, 14)), c.pal.highlight) : c.add(circle(x, y, c.r.range(2, 3.6)), c.pal.highlight, 0.85));
    if (big || i % 3 === 0) c.mover(`star-${i}`, 'twinkle', [x, y], draw, (i * 0.37) % 2);
    else draw();
  }
}

// ---------------------------------------------------------------------------------------------
// Land & water
// ---------------------------------------------------------------------------------------------

/** Rolling ridge from x=0..1000 around baseline y (amp = max offset), closed down to the bottom. */
export function ridgePath(c: Ctx, y: number, amp: number, n = 5, bottom = 600): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push([(1000 * i) / n, y + c.r.range(-amp, amp)]);
  return curve(pts, [[1000, bottom], [0, bottom]]);
}

/** Single mound peaking at (x, top) and meeting baseline y at x±w. */
export function moundPath(x: number, top: number, w: number, y: number, bottom = 600): string {
  return curve(
    [
      [0, y + 10],
      [x - w, y - 4],
      [x - w * 0.45, top + (y - top) * 0.25],
      [x, top],
      [x + w * 0.45, top + (y - top) * 0.22],
      [x + w, y - 6],
      [1000, y + 14],
    ],
    [[1000, bottom], [0, bottom]],
    0.9,
  );
}

export function waterBands(c: Ctx, y: number, color = c.pal.primary) {
  c.tone(rrect(0, y, 1000, 600 - y), color, 0.55);
  c.tone(rrect(0, y + 70, 1000, 600 - y - 70), color, 0.4);
  c.tone(rrect(0, y + 160, 1000, 600 - y - 160), color, 0.25);
}

/** Short horizontal wave dashes on water (movers that bob). */
export function waveDashes(c: Ctx, n: number, y0: number, y1: number, color = c.light, op = 0.45, move = true) {
  for (let i = 0; i < n; i++) {
    const x = c.r.range(30, 970);
    const y = c.r.range(y0, y1);
    const w = c.r.range(30, 70) * (0.6 + (y - y0) / Math.max(1, y1 - y0));
    const draw = () => c.add(capsule([x - w / 2, y], [x + w / 2, y], 3), color, op);
    // Movers render above everything, so keep dashes static when people may stand in front of them.
    if (move) c.mover(`wave-${i}`, 'bob', [x, y], draw, (i * 0.45) % 2);
    else draw();
  }
}

/** Big curling wave crest along y (storm sea). */
export function crest(c: Ctx, x: number, y: number, w: number, h: number, color: string, t: number) {
  const d = `M${x - w / 2} ${y + h}C${x - w * 0.3} ${y + h * 0.2} ${x - w * 0.05} ${y - h} ${x + w * 0.18} ${y - h * 0.8}C${x + w * 0.32} ${y - h * 0.7} ${x + w * 0.3} ${y - h * 0.25} ${x + w * 0.16} ${y - h * 0.3}C${x + w * 0.3} ${y + h * 0.1} ${x + w * 0.38} ${y + h * 0.6} ${x + w / 2} ${y + h}Z`;
  c.tone(d, color, t);
  c.glow(`M${x - w * 0.02} ${y - h * 0.82}C${x + w * 0.12} ${y - h * 1.02} ${x + w * 0.32} ${y - h * 0.75} ${x + w * 0.16} ${y - h * 0.3}C${x + w * 0.2} ${y - h * 0.62} ${x + w * 0.1} ${y - h * 0.8} ${x - w * 0.02} ${y - h * 0.82}Z`, 0.7);
}

// ---------------------------------------------------------------------------------------------
// Plants & creatures
// ---------------------------------------------------------------------------------------------

/** Round "lollipop" tree; base at (x, y), total height h. */
export function roundTree(c: Ctx, x: number, y: number, h: number, leaf: string, t = 0, fruit?: string) {
  const r = h * 0.3;
  c.add(capsule([x, y], [x, y - h * 0.62], h * 0.045, h * 0.03), N.woodDark);
  const cy = y - h + r;
  c.tone(blob([[x - r, cy + r * 0.2], [x - r * 0.7, cy - r * 0.75], [x + r * 0.15, cy - r * 1.02], [x + r * 0.95, cy - r * 0.35], [x + r * 0.9, cy + r * 0.55], [x, cy + r * 0.95]]), leaf, t);
  c.shade(arcShape(x, cy, r * 0.92, r * 0.92, 20, 160), 0.1);
  c.glow(ellipse(x - r * 0.35, cy - r * 0.4, r * 0.32, r * 0.2), 0.25);
  if (fruit) for (let i = 0; i < 5; i++) c.add(circle(x + Math.cos(i * 2.4) * r * 0.55, cy + Math.sin(i * 2.4) * r * 0.5, r * 0.09), fruit);
}

export function pineTree(c: Ctx, x: number, y: number, h: number, leaf: string, t = 0) {
  c.add(rrect(x - h * 0.04, y - h * 0.18, h * 0.08, h * 0.2, 2), N.woodDark);
  for (let i = 0; i < 3; i++) {
    const top = y - h + i * h * 0.22;
    const w = h * (0.22 + i * 0.08);
    const bot = top + h * 0.42;
    c.tone(roundPoly([[x, top], [x + w, bot], [x - w, bot]], 6), leaf, t);
    c.shade(roundPoly([[x, top], [x + w, bot], [x + w * 0.1, bot]], 4), 0.1);
  }
}

export function palmTree(c: Ctx, x: number, y: number, h: number, leaf: string, lean = 1) {
  const top: Pt = [x + lean * h * 0.18, y - h];
  c.stroke(`M${x} ${y}Q${x + lean * h * 0.02} ${y - h * 0.6} ${top[0]} ${top[1]}`, N.wood, h * 0.06);
  for (let i = 0; i < 5; i++) {
    const a = (-160 + i * 35) * (Math.PI / 180);
    const len = h * 0.42;
    const tip: Pt = [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len * 0.6 + len * 0.25];
    const mid: Pt = [top[0] + Math.cos(a) * len * 0.5, top[1] + Math.sin(a) * len * 0.5 - 8];
    c.add(`M${top[0]} ${top[1]}Q${mid[0]} ${mid[1] - 10} ${tip[0]} ${tip[1]}Q${mid[0]} ${mid[1] + 8} ${top[0]} ${top[1] + 4}Z`, leaf);
  }
  c.add(circle(top[0] - 4, top[1] + 6, h * 0.035) + circle(top[0] + 5, top[1] + 8, h * 0.035), N.woodDark);
}

export function bush(c: Ctx, x: number, y: number, w: number, leaf: string, t = 0) {
  const h = w * 0.55;
  c.tone(circle(x - w * 0.25, y - h * 0.45, h * 0.5) + circle(x + w * 0.22, y - h * 0.5, h * 0.55) + circle(x, y - h * 0.75, h * 0.55) + rrect(x - w / 2, y - h * 0.5, w, h * 0.5, h * 0.2), leaf, t);
  c.shade(rrect(x - w / 2, y - h * 0.28, w, h * 0.28, h * 0.14), 0.08);
}

export function flower(c: Ctx, x: number, y: number, h: number, petal: string, stem: string) {
  c.add(capsule([x, y], [x, y - h], 2.4), stem);
  c.add(ellipse(x + 7, y - h * 0.45, 7, 3.2), stem);
  const cy = y - h;
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    d += circle(x + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6.5);
  }
  c.add(d, petal);
  c.add(circle(x, cy, 4.6), N.gold);
}

export function grassTufts(c: Ctx, n: number, y0: number, y1: number, color: string, op = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = c.r.range(20, 980);
    const y = c.r.range(y0, y1);
    const s = 0.6 + (y - y0) / Math.max(1, y1 - y0);
    c.add(`M${x - 9 * s} ${y}Q${x - 8 * s} ${y - 10 * s} ${x - 12 * s} ${y - 18 * s}Q${x - 2 * s} ${y - 10 * s} ${x} ${y - 2 * s}Q${x + 2 * s} ${y - 14 * s} ${x + 6 * s} ${y - 20 * s}Q${x + 7 * s} ${y - 8 * s} ${x + 9 * s} ${y}Z`, color, op);
  }
}

export function sheep(c: Ctx, x: number, y: number, s: number, flip = false) {
  const k = flip ? -1 : 1;
  const X = (v: number) => x + v * s * k;
  const Y = (v: number) => y + v * s;
  c.add(ellipse(x, y, 34 * s, 5 * s), c.dark, 0.1);
  c.add(capsule([X(-14), Y(-14)], [X(-15), Y(0)], 3.6 * s) + capsule([X(16), Y(-14)], [X(15), Y(0)], 3.6 * s), N.eye);
  let wool = '';
  for (const [dx, dy, r] of [[-16, -26, 12], [-4, -32, 13], [10, -30, 12], [20, -23, 11], [-20, -18, 10], [4, -20, 14], [16, -15, 10]] as const) wool += circle(X(dx), Y(dy), r * s);
  c.add(wool, N.wool);
  c.add(ellipse(X(4), Y(-14), 20 * s, 5 * s), c.dark, 0.06);
  c.add(ellipse(X(29), Y(-31), 8.5 * s, 10 * s), N.eye);
  c.add(ellipse(X(23), Y(-36), 5 * s, 3 * s), N.eye);
  c.add(circle(X(32), Y(-33), 1.6 * s), N.light);
  c.add(circle(X(24), Y(-41), 6 * s) + circle(X(30), Y(-43), 5 * s), N.wool);
}

export function cross(c: Ctx, x: number, base: number, h: number, color: string) {
  const w = h * 0.12;
  c.add(rrect(x - w / 2, base - h, w, h, w * 0.25) + rrect(x - h * 0.33, base - h * 0.76, h * 0.66, w, w * 0.25), color);
}

export function sailboat(c: Ctx, x: number, y: number, s: number, hull: string, sail: string) {
  c.mover('boat', 'bob', [x, y], () => {
    c.add(rrect(x - 3 * s, y - 120 * s, 6 * s, 122 * s, 2 * s), N.woodDark);
    c.add(`M${x + 6 * s} ${y - 112 * s}Q${x + 60 * s} ${y - 60 * s} ${x + 62 * s} ${y - 14 * s}L${x + 6 * s} ${y - 14 * s}Z`, sail);
    c.add(`M${x - 6 * s} ${y - 98 * s}Q${x - 40 * s} ${y - 50 * s} ${x - 46 * s} ${y - 14 * s}L${x - 6 * s} ${y - 14 * s}Z`, sail);
    c.add(`M${x - 6 * s} ${y - 98 * s}Q${x - 40 * s} ${y - 50 * s} ${x - 46 * s} ${y - 14 * s}L${x - 6 * s} ${y - 14 * s}Z`, c.dark, 0.08);
    c.add(rrect(x - 8 * s, y - 128 * s, 22 * s, 10 * s, 3 * s), c.pal.accent);
    c.add(`M${x - 74 * s} ${y - 8 * s}L${x + 80 * s} ${y - 8 * s}Q${x + 66 * s} ${y + 20 * s} ${x + 46 * s} ${y + 22 * s}L${x - 52 * s} ${y + 22 * s}Q${x - 66 * s} ${y + 16 * s} ${x - 74 * s} ${y - 8 * s}Z`, hull);
    c.shade(`M${x - 66 * s} ${y + 8 * s}L${x + 72 * s} ${y + 8 * s}Q${x + 62 * s} ${y + 20 * s} ${x + 46 * s} ${y + 22 * s}L${x - 52 * s} ${y + 22 * s}Q${x - 60 * s} ${y + 18 * s} ${x - 66 * s} ${y + 8 * s}Z`, 0.15);
  });
}

export function bigStar(c: Ctx, x: number, y: number, r: number, name = 'star') {
  c.mover(name, 'twinkle', [x, y], () => {
    c.add(circle(x, y, r * 2.4), c.pal.highlight, 0.1);
    c.add(circle(x, y, r * 1.5), c.pal.highlight, 0.16);
    c.add(sparkle(x, y, r * 1.6), c.pal.highlight, 0.6);
    c.add(star(x, y, r, 0.48), c.pal.highlight);
  });
}

// ---------------------------------------------------------------------------------------------
// Classical & sacred elements (columns, monograms, doves)
// ---------------------------------------------------------------------------------------------

/** Marble: grey stone lifted toward the light tone (reads as pale stone on light and dark palettes). */
export function marble(c: Ctx, d: string, op = 0.42) {
  c.add(d, N.stone);
  c.add(d, c.light, op);
}

/** Round-topped arch from x0..x1, springing at y `spring`, down to `bottom` (no SVG arc commands). */
export function archPath(x0: number, x1: number, spring: number, bottom: number): string {
  const r = (x1 - x0) / 2;
  const top = arcLine(x0 + r, spring, r, r, 180, 360).replace(/^M[^C]*/, '');
  return `M${x0} ${bottom}L${x0} ${spring}${top}L${x1} ${bottom}Z`;
}

/** Lens (vesica) between two tips, bulging `bulge` units each side (quadratic halves). */
export function lens(a: Pt, b: Pt, bulge: number): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  const k = bulge * 2;
  return `M${a[0]} ${a[1]}Q${mx + nx * k} ${my + ny * k} ${b[0]} ${b[1]}Q${mx - nx * k} ${my - ny * k} ${a[0]} ${a[1]}Z`;
}

/**
 * Classical column standing on (x, base): plinth, base moulding, tapered fluted shaft and an Ionic
 * capital. `broken` (0..1) snaps it off at that fraction of its height with a jagged top; `crack`
 * draws a zigzag fissure down the shaft.
 */
export function column(c: Ctx, x: number, base: number, h: number, w: number, o: { broken?: number; crack?: boolean } = {}) {
  const ph = h * 0.07;
  marble(c, rrect(x - w * 0.9, base - ph, w * 1.8, ph, ph * 0.15));
  c.shade(rrect(x - w * 0.9, base - ph * 0.4, w * 1.8, ph * 0.4, ph * 0.1), 0.12);
  const tb = base - ph;
  const mh = h * 0.045;
  marble(c, rrect(x - w * 0.68, tb - mh, w * 1.36, mh, mh * 0.5));
  c.shade(rrect(x - w * 0.68, tb - mh * 0.45, w * 1.36, mh * 0.45, mh * 0.2), 0.1);
  const sb = tb - mh;
  const capH = o.broken ? 0 : h * 0.13;
  const st = o.broken ? base - h * o.broken : base - h + capH;
  const tw = w * 0.44;
  const j = w * 0.22;
  const shaft = o.broken
    ? poly([[x - w / 2, sb], [x - tw - 0.02 * w, st + j * 0.6], [x - w * 0.2, st - j * 0.4], [x - w * 0.02, st + j * 0.9], [x + w * 0.16, st - j * 0.1], [x + w * 0.3, st + j * 0.5], [x + tw + 0.02 * w, st - j * 0.3], [x + w / 2, sb]])
    : poly([[x - w / 2, sb], [x - tw, st], [x + tw, st], [x + w / 2, sb]]);
  marble(c, shaft);
  // Fluting, a shaded right flank and a lit left edge give the shaft its roundness.
  for (let i = 1; i <= 4; i++) {
    const u = -0.5 + i / 5;
    c.add(capsule([x + u * tw * 2, st + (o.broken ? j * 1.2 : 2)], [x + u * w, sb - 1], w * 0.028), c.dark, 0.13);
  }
  c.shade(poly([[x + w * 0.2, sb], [x + tw * 0.4, st + (o.broken ? j : 0)], [x + tw, st + (o.broken ? 0 : 0)], [x + w / 2, sb]]), 0.14);
  c.glow(poly([[x - w * 0.42, sb], [x - tw * 0.86, st + (o.broken ? j : 0)], [x - tw * 0.62, st + (o.broken ? j : 0)], [x - w * 0.28, sb]]), 0.35);
  if (o.crack) {
    const n = 6;
    const y0 = st + (sb - st) * 0.04 + (o.broken ? j : 0);
    const y1 = st + (sb - st) * 0.62;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const y = y0 + ((y1 - y0) * i) / n;
      const cx = x + w * 0.12 + (i % 2 ? -1 : 1) * w * 0.1 - (w * 0.18 * i) / n;
      const half = w * 0.035 * (1 - i / n) + 0.15;
      left.push([cx - half, y]);
      right.push([cx + half, y]);
    }
    c.add(poly([...left, ...right.reverse()]), c.dark, 0.75);
    c.add(capsule([x + w * 0.02, y0 + (y1 - y0) * 0.35], [x - w * 0.2, y0 + (y1 - y0) * 0.5], w * 0.012), c.dark, 0.5);
  }
  if (!o.broken) {
    // Ionic capital: necking, echinus, abacus and two volutes.
    c.add(rrect(x - tw, st - capH * 0.12, tw * 2, capH * 0.12), c.dark, 0.18);
    marble(c, rrect(x - w * 0.62, st - capH * 0.55, w * 1.24, capH * 0.45, capH * 0.2));
    marble(c, rrect(x - w * 0.8, st - capH, w * 1.6, capH * 0.3, capH * 0.06));
    c.shade(rrect(x - w * 0.8, st - capH * 0.78, w * 1.6, capH * 0.08), 0.12);
    for (const s of [-1, 1]) {
      const vx = x + s * w * 0.66;
      const vy = st - capH * 0.42;
      const vr = capH * 0.36;
      marble(c, circle(vx, vy, vr));
      c.add(arcBand(vx, vy, vr * 0.42, vr * 0.62, 0, 359.9), c.dark, 0.2);
      c.add(circle(vx, vy, vr * 0.18), c.dark, 0.3);
    }
  }
  return { top: st - capH, shaftTop: st, shaftBottom: sb };
}

/** Chi-Rho monogram (☧) centred at (x, y), `r` = half height, strokes of radius `t`. */
export function chiRho(c: Ctx, x: number, y: number, r: number, color: string, t = r * 0.1, op?: number, spot = false) {
  const d = r * 0.62;
  const loopR = r * 0.34;
  const ly = y - r + loopR;
  c.add(
    capsule([x, y - r], [x, y + r], t) +
      capsule([x - d, y - d * 0.55], [x + d, y + d * 0.95], t) +
      capsule([x + d, y - d * 0.55], [x - d, y + d * 0.95], t) +
      arcBand(x, ly, loopR - t, loopR + t, -90, 90),
    color,
    op,
    spot ? { spot: true } : {},
  );
}

/**
 * A cloth in the palette primary thrown over the top of a (broken) column whose shaft top is at
 * (x, top) and shaft width w: a long fold down the left, a short tail on the right. It is the spot colour.
 */
export function drapeCloth(c: Ctx, x: number, top: number, w: number, name = 'cloth') {
  const s = w / 26;
  const m = mul(translate(x - 54 * s, top - 42 * s), scaleAt(s, s));
  c.mover(name, 'sway', [x, top], () =>
    c.at(m, () => {
      const cloth = `M38 40C44 33 64 33 70 38C74 46 76 54 76 62C72 66 69 61 66 64C64 58 60 55 56 54C51 60 47 70 45 80C43 86 41 90 39 93C33 91 28 95 22 92C24 80 28 64 32 52C34 46 36 42 38 40Z`;
      c.add(cloth, c.pal.primary, undefined, { spot: true });
      c.add(`M56 54C51 60 47 70 45 80C43 86 41 90 39 93C37 92 36 92 35 92C38 82 42 66 50 56Z`, c.dark, 0.22, { spot: true });
      c.add(`M66 40C70 46 72 54 76 62C72 66 69 61 66 64C66 56 66 48 66 40Z`, c.dark, 0.2, { spot: true });
      c.add(`M40 46C37 60 33 76 30 90M46 47C44 58 40 72 36 86M62 40C60 46 58 50 56 54`, 'none', 0.22, { stroke: c.dark, strokeWidth: 1, spot: true });
      c.glow(`M42 38C48 35 58 35 64 37C56 37 48 38 42 42Z`, 0.35);
      c.glow(`M30 60C29 70 27 80 26 90C28 80 30 70 33 58Z`, 0.25);
    }),
  );
}

/** Dove in flight drawn in a 100×100 box (prop units); wrap in `c.at` to place it. */
export function doveShape(c: Ctx) {
  const { pal } = c;
  c.add(`M58 34C46 18 30 16 18 20C28 26 36 34 42 46Z`, N.wool);
  c.add(`M58 34C46 18 30 16 18 20C28 26 36 34 42 46Z`, c.dark, 0.08);
  c.add(`M20 58C30 50 44 46 58 46C66 46 72 42 74 36C76 32 82 30 86 34L92 38L86 40C86 54 76 64 60 66C46 68 36 72 26 80C26 72 28 66 32 62Z`, N.wool);
  c.add(`M60 48C70 30 80 18 90 14C88 30 80 46 66 56Z`, N.wool);
  c.add(`M60 48C70 30 80 18 90 14C88 30 80 46 66 56Z`, c.dark, 0.05);
  c.add(circle(80, 36, 2), N.eye);
  c.add(`M86 34L94 36L86 40Z`, N.gold);
  c.add(curve([[92, 38], [86, 48], [76, 54]]), 'none', undefined, { stroke: pal.primary, strokeWidth: 2.2 });
  c.add(ellipse(84, 47, 4, 2) + ellipse(80, 52, 4, 2), pal.primary);
}

export { N as NEUTRAL };
