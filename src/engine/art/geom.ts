// Geometry helpers for the illustration library: shape builders that emit compact absolute SVG path
// data (M L C Q Z only), an affine path transformer that accepts any SVG path syntax, and a seeded RNG.

export type Pt = [number, number];
/** Affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (SVG order). */
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** m ∘ n: apply n first, then m. */
export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];

/** Scale about (cx, cy). */
export function scaleAt(sx: number, sy: number, cx = 0, cy = 0): Mat {
  return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
}

/** Rotate by `deg` degrees (clockwise in SVG's y-down space) about (cx, cy). */
export function rotateAt(deg: number, cx = 0, cy = 0): Mat {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}

/** Mirror horizontally inside a box of the given width. */
export const flipX = (width: number): Mat => [-1, 0, 0, 1, width, 0];

export function apply(m: Mat, p: Pt): Pt {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

/** Compact number formatting (1 decimal, no "-0"). */
export function f(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

const fp = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

// ---------------------------------------------------------------------------------------------
// Shape builders (all return absolute path data)
// ---------------------------------------------------------------------------------------------

const K = 0.5522847498;

/** Cubic segments approximating a circular arc from angle a0 to a1 (radians), without the leading move. */
function arcSegs(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): string {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(step / 4);
  let out = '';
  for (let i = 0; i < n; i++) {
    const s = a0 + i * step;
    const e = s + step;
    const p1: Pt = [cx + rx * (Math.cos(s) - k * Math.sin(s)), cy + ry * (Math.sin(s) + k * Math.cos(s))];
    const p2: Pt = [cx + rx * (Math.cos(e) + k * Math.sin(e)), cy + ry * (Math.sin(e) - k * Math.cos(e))];
    const p3: Pt = [cx + rx * Math.cos(e), cy + ry * Math.sin(e)];
    out += `C${fp(p1)} ${fp(p2)} ${fp(p3)}`;
  }
  return out;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M${f(cx + rx)} ${f(cy)}` +
    `C${f(cx + rx)} ${f(cy + ry * K)} ${f(cx + rx * K)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}` +
    `C${f(cx - rx * K)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ry * K)} ${f(cx - rx)} ${f(cy)}` +
    `C${f(cx - rx)} ${f(cy - ry * K)} ${f(cx - rx * K)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}` +
    `C${f(cx + rx * K)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ry * K)} ${f(cx + rx)} ${f(cy)}Z`
  );
}

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

/** Pie/arc-bounded shape: an elliptical arc between angles (degrees, 0 = +x, clockwise), closed to the centre or chord. */
export function arcShape(cx: number, cy: number, rx: number, ry: number, d0: number, d1: number, toCenter = false): string {
  const a0 = (d0 * Math.PI) / 180;
  const a1 = (d1 * Math.PI) / 180;
  const start: Pt = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)];
  return `M${fp(start)}${arcSegs(cx, cy, rx, ry, a0, a1)}${toCenter ? `L${f(cx)} ${f(cy)}` : ''}Z`;
}

/** Open elliptical arc (for strokes like smiles and rainbows). */
export function arcLine(cx: number, cy: number, rx: number, ry: number, d0: number, d1: number): string {
  const a0 = (d0 * Math.PI) / 180;
  const a1 = (d1 * Math.PI) / 180;
  return `M${fp([cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)])}${arcSegs(cx, cy, rx, ry, a0, a1)}`;
}

/** Band between two concentric arcs (rainbow stripe, halo ring). */
export function arcBand(cx: number, cy: number, r0: number, r1: number, d0: number, d1: number, sy = 1): string {
  const a0 = (d0 * Math.PI) / 180;
  const a1 = (d1 * Math.PI) / 180;
  return (
    `M${fp([cx + r1 * Math.cos(a0), cy + r1 * sy * Math.sin(a0)])}${arcSegs(cx, cy, r1, r1 * sy, a0, a1)}` +
    `L${fp([cx + r0 * Math.cos(a1), cy + r0 * sy * Math.sin(a1)])}${arcSegs(cx, cy, r0, r0 * sy, a1, a0)}Z`
  );
}

export function rrect(x: number, y: number, w: number, h: number, r = 0): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  const k = rr * (1 - K);
  return (
    `M${f(x + rr)} ${f(y)}L${f(x + w - rr)} ${f(y)}C${f(x + w - k)} ${f(y)} ${f(x + w)} ${f(y + k)} ${f(x + w)} ${f(y + rr)}` +
    `L${f(x + w)} ${f(y + h - rr)}C${f(x + w)} ${f(y + h - k)} ${f(x + w - k)} ${f(y + h)} ${f(x + w - rr)} ${f(y + h)}` +
    `L${f(x + rr)} ${f(y + h)}C${f(x + k)} ${f(y + h)} ${f(x)} ${f(y + h - k)} ${f(x)} ${f(y + h - rr)}` +
    `L${f(x)} ${f(y + rr)}C${f(x)} ${f(y + k)} ${f(x + k)} ${f(y)} ${f(x + rr)} ${f(y)}Z`
  );
}

export function poly(pts: Pt[], close = true): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${fp(p)}`).join('') + (close ? 'Z' : '');
}

/** Polygon with rounded corners (radius r, clamped per corner). */
export function roundPoly(pts: Pt[], r: number): string {
  const n = pts.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const a = pts[(i + n - 1) % n]!;
    const b = pts[(i + 1) % n]!;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2, lb / 2);
    const s: Pt = [p[0] + ((a[0] - p[0]) / la) * ra, p[1] + ((a[1] - p[1]) / la) * ra];
    const e: Pt = [p[0] + ((b[0] - p[0]) / lb) * ra, p[1] + ((b[1] - p[1]) / lb) * ra];
    out += `${i ? 'L' : 'M'}${fp(s)}Q${fp(p)} ${fp(e)}`;
  }
  return out + 'Z';
}

/** Smooth closed blob through points (Catmull-Rom → cubic). */
export function blob(pts: Pt[], tension = 1): string {
  const n = pts.length;
  let out = `M${fp(pts[0]!)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const t = tension / 6;
    out += `C${fp([p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t])} ${fp([p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t])} ${fp(p2)}`;
  }
  return out + 'Z';
}

/** Smooth open curve through points (Catmull-Rom → cubic). Optionally closed with straight lines via `tail`. */
export function curve(pts: Pt[], tail: Pt[] = [], tension = 1): string {
  const n = pts.length;
  let out = `M${fp(pts[0]!)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(n - 1, i + 2)]!;
    const t = tension / 6;
    out += `C${fp([p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t])} ${fp([p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t])} ${fp(p2)}`;
  }
  for (const p of tail) out += `L${fp(p)}`;
  return out + (tail.length ? 'Z' : '');
}

/** Tapered capsule from a (radius r1) to b (radius r2): a limb, a stem, a ray. */
export function capsule(a: Pt, b: Pt, r1: number, r2 = r1): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.max(Math.hypot(dx, dy), Math.abs(r1 - r2) + 0.01);
  const th = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  const at = (c: Pt, r: number, ang: number): Pt => [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)];
  // Clockwise (in y-down space) like every other builder, so unions of shapes fill solidly.
  return (
    `M${fp(at(a, r1, th - al))}L${fp(at(b, r2, th - al))}${arcSegs(b[0], b[1], r2, r2, th - al, th + al)}` +
    `L${fp(at(a, r1, th + al))}${arcSegs(a[0], a[1], r1, r1, th + al, th - al + 2 * Math.PI)}Z`
  );
}

/** Thick bent limb a→b→c with round caps, drawn as two capsules plus a joint (returns several paths joined). */
export function limb(a: Pt, b: Pt, c: Pt, r1: number, r2 = r1): string {
  const rm = (r1 + r2) / 2;
  return capsule(a, b, r1, rm) + capsule(b, c, rm, r2);
}

/** Five-pointed (or n-pointed) star. */
export function star(cx: number, cy: number, r: number, inner = 0.45, points = 5, rot = -90): string {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    const rr = i % 2 ? r * inner : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return roundPoly(pts, r * 0.08);
}

/** Four-point sparkle. */
export function sparkle(cx: number, cy: number, r: number): string {
  const q = r * 0.18;
  return (
    `M${f(cx)} ${f(cy - r)}Q${f(cx + q)} ${f(cy - q)} ${f(cx + r)} ${f(cy)}` +
    `Q${f(cx + q)} ${f(cy + q)} ${f(cx)} ${f(cy + r)}Q${f(cx - q)} ${f(cy + q)} ${f(cx - r)} ${f(cy)}Q${f(cx - q)} ${f(cy - q)} ${f(cx)} ${f(cy - r)}Z`
  );
}

/** Heart centred at (cx, cy) with total width w. */
export function heart(cx: number, cy: number, w: number): string {
  const s = w / 100;
  const P = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return `M${P(0, 38)}C${P(-14, 26)} ${P(-50, 4)} ${P(-50, -18)}C${P(-50, -36)} ${P(-36, -46)} ${P(-24, -46)}C${P(-12, -46)} ${P(-4, -38)} ${P(0, -28)}C${P(4, -38)} ${P(12, -46)} ${P(24, -46)}C${P(36, -46)} ${P(50, -36)} ${P(50, -18)}C${P(50, 4)} ${P(14, 26)} ${P(0, 38)}Z`;
}

/** Fluffy cloud: a flat-bottomed pill with round bumps on top (one solid union of clockwise shapes). */
export function cloud(cx: number, cy: number, w: number, seed = 0): string {
  const h = w * 0.3;
  const x0 = cx - w / 2;
  const base = cy + h * 0.6;
  let out = rrect(x0, base - h, w, h, h / 2);
  const bumps = 2 + (seed % 2);
  for (let i = 0; i < bumps; i++) {
    const t = (i + 0.5) / bumps;
    const big = bumps === 2 ? (i === 0 ? 0.95 : 0.75) : i === 1 ? 1 : 0.7;
    const r = h * big * (bumps === 2 ? 1 : 0.9);
    const bx = x0 + h * 0.35 + (w - h * 0.7) * t;
    out += circle(bx, base - h * 0.75, r);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Path parsing + transformation (accepts the full SVG path grammar)
// ---------------------------------------------------------------------------------------------

export type Seg = { c: 'M' | 'L' | 'C' | 'Q'; p: Pt[] } | { c: 'Z'; p: [] };

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Tokenise path data; throws on invalid syntax. */
export function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /\s*(?:([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?))\s*,?/y;
  let i = 0;
  const s = d.trim();
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m || m[0].length === 0) throw new Error(`Invalid path data near "${s.slice(i, i + 12)}"`);
    out.push(m[1] ?? Number(m[2]));
    i = re.lastIndex;
  }
  return out;
}

/** Arc endpoint parameterisation → cubic segments (SVG spec F.6). */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, phi: number, fa: number, fs: number, x2: number, y2: number): Pt[][] {
  if (rx === 0 || ry === 0) return [[[x1, y1], [x2, y2], [x2, y2]]];
  const sinp = Math.sin((phi * Math.PI) / 180);
  const cosp = Math.cos((phi * Math.PI) / 180);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosp * dx + sinp * dy;
  const y1p = -sinp * dx + cosp * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cosp * cxp - sinp * cyp + (x1 + x2) / 2;
  const cy = sinp * cxp + cosp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t: number, ox = 0, oy = 0): Pt => {
    const ex = rx * Math.cos(t) + ox;
    const ey = ry * Math.sin(t) + oy;
    return [cx + cosp * ex - sinp * ey, cy + sinp * ex + cosp * ey];
  };
  const out: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const s = t1 + i * step;
    const e = s + step;
    const p1 = pt(s, -k * rx * Math.sin(s), k * ry * Math.cos(s));
    const p2 = pt(e, k * rx * Math.sin(e), -k * ry * Math.cos(e));
    out.push([p1, p2, pt(e)]);
  }
  return out;
}

/** Parse any SVG path data into absolute M/L/C/Q/Z segments. */
export function parsePath(d: string): Seg[] {
  const t = tokenize(d);
  const segs: Seg[] = [];
  let i = 0;
  let cmd = '';
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastC: Pt | null = null;
  let lastQ: Pt | null = null;
  const num = () => {
    const v = t[i++];
    if (typeof v !== 'number') throw new Error('Invalid path data: expected number');
    return v;
  };
  while (i < t.length) {
    const tok = t[i];
    if (typeof tok === 'string') {
      cmd = tok;
      i++;
    } else if (!cmd) throw new Error('Invalid path data: must start with a command');
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') {
      segs.push({ c: 'Z', p: [] });
      cur = [...start];
      lastC = lastQ = null;
      continue;
    }
    if (!segs.length && up !== 'M') throw new Error('Invalid path data: must start with M');
    const need = ARGS[up]!;
    if (i + need > t.length || t.slice(i, i + need).some((v) => typeof v !== 'number')) throw new Error(`Invalid path data: ${cmd} needs ${need} numbers`);
    const ox = rel ? cur[0] : 0;
    const oy = rel ? cur[1] : 0;
    let nextC: Pt | null = null;
    let nextQ: Pt | null = null;
    switch (up) {
      case 'M': {
        cur = [num() + ox, num() + oy];
        start = [...cur];
        segs.push({ c: 'M', p: [cur] });
        break;
      }
      case 'L':
        cur = [num() + ox, num() + oy];
        segs.push({ c: 'L', p: [cur] });
        break;
      case 'H':
        cur = [num() + ox, cur[1]];
        segs.push({ c: 'L', p: [cur] });
        break;
      case 'V':
        cur = [cur[0], num() + oy];
        segs.push({ c: 'L', p: [cur] });
        break;
      case 'C': {
        const p1: Pt = [num() + ox, num() + oy];
        const p2: Pt = [num() + ox, num() + oy];
        cur = [num() + ox, num() + oy];
        segs.push({ c: 'C', p: [p1, p2, cur] });
        nextC = p2;
        break;
      }
      case 'S': {
        const p1: Pt = lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : [...cur];
        const p2: Pt = [num() + ox, num() + oy];
        cur = [num() + ox, num() + oy];
        segs.push({ c: 'C', p: [p1, p2, cur] });
        nextC = p2;
        break;
      }
      case 'Q': {
        const p1: Pt = [num() + ox, num() + oy];
        cur = [num() + ox, num() + oy];
        segs.push({ c: 'Q', p: [p1, cur] });
        nextQ = p1;
        break;
      }
      case 'T': {
        const p1: Pt = lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : [...cur];
        cur = [num() + ox, num() + oy];
        segs.push({ c: 'Q', p: [p1, cur] });
        nextQ = p1;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const fa = num();
        const fs = num();
        const end: Pt = [num() + ox, num() + oy];
        for (const c of arcToCubics(cur[0], cur[1], rx, ry, rot, fa, fs, end[0], end[1])) segs.push({ c: 'C', p: c });
        cur = end;
        break;
      }
      default:
        throw new Error(`Invalid path command ${cmd}`);
    }
    lastC = nextC;
    lastQ = nextQ;
  }
  return segs;
}

export function serialize(segs: Seg[]): string {
  return segs.map((s) => s.c + s.p.map(fp).join(' ')).join('');
}

/** Transform any path data by an affine matrix (output uses absolute M/L/C/Q/Z). */
export function transformPath(d: string, m: Mat): string {
  return serialize(parsePath(d).map((s) => (s.c === 'Z' ? s : { c: s.c, p: s.p.map((p) => apply(m, p)) } as Seg)));
}

/** Control-point bounding box (a safe superset of the drawn area). */
export function pathBounds(d: string): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of parsePath(d))
    for (const [x, y] of s.p) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return { x0, y0, x1, y1 };
}

// ---------------------------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------------------------

/** mulberry32 seeded PRNG in [0, 1). */
export function rng(seed: number): () => number {
  let a = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Random helpers bound to one generator. */
export function rand(seed: number) {
  const r = rng(seed);
  return {
    next: r,
    range: (a: number, b: number) => a + (b - a) * r(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * r()),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!,
    chance: (p: number) => r() < p,
  };
}
export type Rand = ReturnType<typeof rand>;
