// Building blocks shared by scenes and props: a drawing context with palette tones, plus reusable
// flat-vector elements (sun, clouds, hills, trees, sheep, birds, waves, boats, stars…).

import { luminance } from '@/styles/color';
import { character, NEUTRALS as N } from './characters';
import {
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
    c.add(rrect(0, 300, 1000, 300), pal.primary, 0.12);
    return;
  }
  c.add(rrect(0, 0, 1000, 600), pal.softer);
  // Gentle horizon glow bands.
  c.add(rrect(0, 260, 1000, 340), pal.highlight, 0.12);
  c.add(rrect(0, 340, 1000, 260), pal.highlight, 0.12);
}

export function sun(c: Ctx, x: number, y: number, r: number, color = c.pal.highlight, move = true) {
  const draw = () => {
    c.add(circle(x, y, r * 1.9), color, 0.14);
    c.add(circle(x, y, r * 1.45), color, 0.22);
    c.add(circle(x, y, r), color);
    c.glow(arcShape(x, y, r * 0.78, r * 0.78, 200, 260), 0.35);
  };
  if (move) c.mover('sun', 'drift', [x, y], draw, 0);
  else draw();
}

export function rays(c: Ctx, x: number, y: number, r0: number, r1: number, n: number, color: string, op = 0.18, rot = 0, spread = 360, from = 0) {
  for (let i = 0; i < n; i++) {
    const a = ((from + rot + (spread / n) * (i + 0.5)) * Math.PI) / 180;
    const w = ((spread / n) * 0.32 * Math.PI) / 180;
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

export function clouds(c: Ctx, n: number, y0: number, y1: number, color = c.pal.surface, op = 0.95, avoid?: [number, number]) {
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
    c.mover(`cloud-${i}`, 'drift', [x, y], () => {
      c.add(cloud(x, y, w, seed), color, op);
      c.shade(rrect(x - w / 2, y + w * 0.15 - 6, w, w * 0.08 + 6, 4), 0.05);
    }, i * 1.3);
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
export function waveDashes(c: Ctx, n: number, y0: number, y1: number, color = c.light, op = 0.45) {
  for (let i = 0; i < n; i++) {
    const x = c.r.range(30, 970);
    const y = c.r.range(y0, y1);
    const w = c.r.range(30, 70) * (0.6 + (y - y0) / Math.max(1, y1 - y0));
    c.mover(`wave-${i}`, 'bob', [x, y], () => c.add(capsule([x - w / 2, y], [x + w / 2, y], 3), color, op), (i * 0.45) % 2);
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

export { N as NEUTRAL };
