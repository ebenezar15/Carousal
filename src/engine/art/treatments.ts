// Art treatments: restyle a finished illustration without redrawing it. Every treatment is a pure
// function of (piece, palette) that keeps the piece's structure — the same viewBox, static parts in the
// same order and movers with the same names, loops and pivots — so animations and layout keep working.
//
//  - color       the illustration as drawn (a copy).
//  - engraving   ink on paper: every fill becomes a tone between pal.bg and pal.ink by how far it sits
//                from the paper, solid shapes get a thin ink outline, darker shapes get diagonal
//                hatching (clipped to the shape), and the spot colour survives (a red cloth on a grey
//                engraving). Spot parts are those marked `spot`; when a piece marks none, parts filled
//                with pal.primary are the spot, except landscape bands (as wide as the picture, or
//                toned toward the paper by an overlay) which are toned like everything else.
//  - duotone     tones mapped on a ramp pal.ink → pal.primary → pal.bg (spot parts keep their colours);
//                no outlines.
//  - line        a clean line drawing: solid shapes filled with pal.bg (so front shapes hide back ones)
//                and outlined in pal.ink at one width; translucent glows and shades are dropped.
//  - silhouette  solid pal.ink shapes (solid spot parts keep their colour); translucent parts and
//                paper-toned backdrops are dropped.
//
// Part counts: color, duotone keep every part 1:1. Engraving keeps every part and may insert one
// hatching part right after a shaded part. Line and silhouette drop parts as described, and drop any
// mover left with no parts.

import { luminance, mix } from '@/styles/color';
import { f, parsePath, pathBounds, type Pt } from './geom';
import type { ArtMover, ArtPalette, ArtPart, ArtPiece } from './types';

export type ArtTreatment = 'color' | 'engraving' | 'duotone' | 'line' | 'silhouette';
export const TREATMENT_LIST: ArtTreatment[] = ['color', 'engraving', 'duotone', 'line', 'silhouette'];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isColor = (c: string | undefined): c is string => !!c && HEX.test(c);
const same = (a: string | undefined, b: string) => !!a && a.toUpperCase() === b.toUpperCase();
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Perceptual lightness (CIE L*, 0..1) from relative luminance. */
function lightness(hex: string): number {
  const y = luminance(hex);
  return y > 0.008856 ? 1.16 * Math.cbrt(y) - 0.16 : 9.033 * y;
}

/** How far a colour sits from the paper (pal.bg, 0) toward the ink (pal.ink, 1). Works on dark palettes too. */
function inkWeight(col: string, pal: ArtPalette): number {
  const lb = lightness(pal.bg);
  const span = lightness(pal.ink) - lb;
  if (Math.abs(span) < 0.05) return 0.5;
  return clamp01((lightness(col) - lb) / span);
}

type Geo = { W: number; H: number; S: number };
type PartMap = (p: ArtPart, spot: boolean) => ArtPart[];

/** A translucent overlay (glow, shade, tint) rather than a solid shape. */
const translucent = (p: ArtPart) => p.opacity != null && p.opacity < 0.5;
const solidFill = (p: ArtPart) => isColor(p.fill);

/** Spot flags for a list of parts (see the header). `marked`: the piece marks its spot parts explicitly. */
function spotFlags(parts: ArtPart[], marked: boolean, pal: ArtPalette, g: Geo): boolean[] {
  return parts.map((p, i) => {
    if (marked) return !!p.spot;
    if (!same(isColor(p.fill) ? p.fill : p.stroke, pal.primary)) return false;
    const next = parts[i + 1];
    if (next && next.d === p.d && same(next.fill, pal.bg)) return false;
    try {
      const b = pathBounds(p.d);
      return b.x1 - b.x0 < g.W * 0.8;
    } catch {
      return false;
    }
  });
}

function without<K extends keyof ArtPart>(p: ArtPart, ...keys: K[]): ArtPart {
  const out: ArtPart = { ...p };
  for (const k of keys) delete out[k];
  return out;
}

// ---------------------------------------------------------------------------------------------
// Hatching: parallel diagonal lines clipped to a part's outline (nonzero winding, like the fill)
// ---------------------------------------------------------------------------------------------

/** Flatten path data into closed polygons (beziers sampled). */
function polygons(d: string): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let p: Pt = [0, 0];
  const flush = () => {
    if (cur.length > 2) out.push(cur);
    cur = [];
  };
  for (const s of parsePath(d)) {
    if (s.c === 'M') {
      flush();
      p = s.p[0]!;
      cur = [p];
    } else if (s.c === 'L') {
      p = s.p[0]!;
      cur.push(p);
    } else if (s.c === 'C') {
      const [a, b, e] = s.p as [Pt, Pt, Pt];
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        cur.push([u * u * u * p[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0], u * u * u * p[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1]]);
      }
      p = e;
    } else if (s.c === 'Q') {
      const [a, e] = s.p as [Pt, Pt];
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const u = 1 - t;
        cur.push([u * u * p[0] + 2 * u * t * a[0] + t * t * e[0], u * u * p[1] + 2 * u * t * a[1] + t * t * e[1]]);
      }
      p = e;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/** Hatch lines inside the shape along direction `dir` (unit), spaced `gap`; returns "M…L…" sub-paths. */
function hatchLines(polys: Pt[][], dir: Pt, gap: number, inset: number): string {
  const n: Pt = [-dir[1], dir[0]];
  const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
  let kMin = Infinity;
  let kMax = -Infinity;
  for (const poly of polys)
    for (const q of poly) {
      const k = dot(q, n);
      kMin = Math.min(kMin, k);
      kMax = Math.max(kMax, k);
    }
  if (!Number.isFinite(kMin) || kMax - kMin < gap) return '';
  let out = '';
  // Offset the first line by half a gap so thin shapes still get one centred line.
  for (let k = kMin + gap / 2; k < kMax; k += gap) {
    const hits: [number, number][] = [];
    for (const poly of polys)
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        const ka = dot(a, n);
        const kb = dot(b, n);
        if (ka <= k === kb <= k) continue;
        const t = (k - ka) / (kb - ka);
        hits.push([dot([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir), kb > ka ? 1 : -1]);
      }
    hits.sort((x, y) => x[0] - y[0]);
    let wind = 0;
    let start = 0;
    for (const [s, w] of hits) {
      const was = wind;
      wind += w;
      if (was === 0 && wind !== 0) start = s;
      else if (was !== 0 && wind === 0) {
        const s0 = start + inset;
        const s1 = s - inset;
        if (s1 - s0 > gap * 0.6) {
          const P = (v: number) => `${f(n[0] * k + dir[0] * v)} ${f(n[1] * k + dir[1] * v)}`;
          out += `M${P(s0)}L${P(s1)}`;
        }
      }
    }
  }
  return out;
}

function hatch(d: string, t: number, pal: ArtPalette, g: Geo): ArtPart | null {
  let polys: Pt[][];
  try {
    polys = polygons(d);
  } catch {
    return null;
  }
  const gap = g.S * 0.011;
  const r = Math.SQRT1_2;
  let lines = hatchLines(polys, [r, -r], gap, gap * 0.35);
  // The darkest tones get a second, crossing set of lines.
  if (t > 0.72) lines += hatchLines(polys, [r, r], gap * 1.25, gap * 0.35);
  if (!lines) return null;
  return { d: lines, fill: 'none', stroke: pal.ink, strokeWidth: Math.round(g.S * 0.0022 * 100) / 100, opacity: 0.35 };
}

// ---------------------------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------------------------

function engraving(pal: ArtPalette, g: Geo): PartMap {
  const tone = (col: string) => 0.1 + 0.82 * inkWeight(col, pal) ** 1.2;
  const outline = Math.round(g.S * 0.005 * 100) / 100;
  return (p, spot) => {
    if (spot) return [translucent(p) || !solidFill(p) ? { ...p } : { ...p, stroke: pal.ink, strokeWidth: outline }];
    if (translucent(p)) {
      const col = isColor(p.fill) ? p.fill : p.stroke;
      if (!isColor(col)) return [{ ...p }];
      // Glows and highlights become paper tints; shading overlays stay ink so forms keep their volume.
      const c = inkWeight(col, pal) < 0.5 ? mix(pal.bg, pal.ink, 0.04) : pal.ink;
      return [{ ...p, ...(isColor(p.fill) ? { fill: c } : {}), ...(isColor(p.stroke) ? { stroke: c } : {}) }];
    }
    if (!solidFill(p)) {
      // Stroke-only lines (ropes, ribbons, the ichthys) read as ink lines.
      if (!isColor(p.stroke)) return [{ ...p }];
      return [{ ...p, stroke: mix(pal.bg, pal.ink, Math.max(0.7, tone(p.stroke))) }];
    }
    const t = tone(p.fill!);
    const out: ArtPart = { ...p, fill: mix(pal.bg, pal.ink, t), stroke: pal.ink, strokeWidth: outline };
    if (t < 0.42) return [out];
    const h = hatch(p.d, t, pal, g);
    return h ? [out, h] : [out];
  };
}

function duotone(pal: ArtPalette): PartMap {
  const ramp = (col: string) => {
    const s = 1 - inkWeight(col, pal);
    return s < 0.5 ? mix(pal.ink, pal.primary, s * 2) : mix(pal.primary, pal.bg, (s - 0.5) * 2);
  };
  return (p, spot) => {
    const out: ArtPart = { ...p };
    if (spot) return [out];
    if (isColor(p.fill)) out.fill = ramp(p.fill);
    if (isColor(p.stroke)) out.stroke = ramp(p.stroke);
    return [out];
  };
}

function line(pal: ArtPalette, g: Geo): PartMap {
  const w = g.S * 0.005;
  return (p) => {
    if (translucent(p)) return [];
    if (solidFill(p)) return [{ ...without(p, 'opacity'), fill: pal.bg, stroke: pal.ink, strokeWidth: w }];
    if (isColor(p.stroke)) return [{ ...without(p, 'opacity'), fill: 'none', stroke: pal.ink, strokeWidth: Math.max(w, Math.min(p.strokeWidth ?? w, w * 2)) }];
    return [];
  };
}

function silhouette(pal: ArtPalette): PartMap {
  const paper = [pal.bg, pal.soft, pal.softer];
  return (p, spot) => {
    if (translucent(p)) return [];
    if (solidFill(p)) {
      if (paper.some((c) => same(p.fill, c))) return [];
      return [{ ...without(p, 'stroke', 'strokeWidth', 'opacity'), fill: spot ? p.fill! : pal.ink }];
    }
    if (isColor(p.stroke)) return [{ ...without(p, 'opacity'), fill: 'none', stroke: spot ? p.stroke : pal.ink }];
    return [];
  };
}

/** Restyle an illustration (see the header for what each treatment does). Pure: returns a new piece. */
export function treatArt(piece: ArtPiece, treatment: ArtTreatment, pal: ArtPalette): ArtPiece {
  const [W, H] = piece.viewBox;
  const g: Geo = { W, H, S: Math.max(W, H) };
  const map: PartMap | null =
    treatment === 'engraving' ? engraving(pal, g) : treatment === 'duotone' ? duotone(pal) : treatment === 'line' ? line(pal, g) : treatment === 'silhouette' ? silhouette(pal) : null;
  const marked = [...piece.parts, ...(piece.movers ?? []).flatMap((m) => m.parts)].some((p) => p.spot);
  const run = (parts: ArtPart[]) => {
    if (!map) return parts.map((p) => ({ ...p }));
    const spots = spotFlags(parts, marked, pal, g);
    return parts.flatMap((p, i) => map(p, spots[i]!));
  };
  const out: ArtPiece = { viewBox: [W, H], parts: run(piece.parts) };
  if (piece.movers) {
    const movers: ArtMover[] = [];
    for (const m of piece.movers) {
      const parts = run(m.parts);
      if (parts.length || !map) movers.push({ ...m, pivot: [m.pivot[0], m.pivot[1]], parts });
    }
    if (movers.length) out.movers = movers;
  }
  return out;
}
