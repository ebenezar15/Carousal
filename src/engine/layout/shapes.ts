// Original vector shapes (SVG path syntax) used by decorations, swipe cues and layouts.
// Stroke shapes use a 24-unit viewBox unless noted.

export interface ShapeDef { d: string[]; viewBox: [number, number]; mode: 'stroke' | 'fill' }

export const SHAPES = {
  arrowRight: { d: ['M2 12h19', 'M14 5l7 7-7 7'], viewBox: [24, 24], mode: 'stroke' },
  chevronRight: { d: ['M9 5l7 7-7 7'], viewBox: [24, 24], mode: 'stroke' },
  chevronsTriple: { d: ['M2 6l6 6-6 6', 'M10 6l6 6-6 6', 'M18 6l6 6-6 6'], viewBox: [26, 24], mode: 'stroke' },
  check: { d: ['M5 12.5l4.5 4.5L19 7.5'], viewBox: [24, 24], mode: 'stroke' },
  hairlineArrow: { d: ['M0 6h96', 'M90 1l6 5-6 5'], viewBox: [97, 12], mode: 'stroke' },
  handArrow: { d: ['M3 21C9 8 22 3 40 9', 'M40 9l-9-6', 'M40 9l-10 4'], viewBox: [44, 24], mode: 'stroke' },
  scribbleCircle: { d: ['M54 5C82 3 99 18 97 34C95 52 66 61 40 59C14 57 2 43 4 29C6 14 31 3 60 7'], viewBox: [100, 64], mode: 'stroke' },
  quoteMark: {
    d: ['M0 80V50C0 24 13 7 38 0l7 11C30 17 24 27 23 40h21v40H0Z', 'M56 80V50C56 24 69 7 94 0l7 11C86 17 80 27 79 40h21v40H56Z'],
    viewBox: [101, 80],
    mode: 'fill',
  },
  blob: { d: ['M58 4C81 8 97 28 96 52C95 78 72 97 46 96C20 95 3 74 4 48C5 22 34 0 58 4Z'], viewBox: [100, 100], mode: 'fill' },
  blob2: { d: ['M50 2C70 0 92 14 97 38C102 62 86 88 60 96C34 104 8 88 3 62C-2 36 22 4 50 2Z'], viewBox: [100, 100], mode: 'fill' },
  sparkle: { d: ['M12 0C12.8 7.2 16.8 11.2 24 12C16.8 12.8 12.8 16.8 12 24C11.2 16.8 7.2 12.8 0 12C7.2 11.2 11.2 7.2 12 0Z'], viewBox: [24, 24], mode: 'fill' },
  heart: { d: ['M12 21l-1.4-1.3C5.4 15 2 11.9 2 8.2 2 5.2 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.2 22 8.2c0 3.7-3.4 6.8-8.6 11.5L12 21Z'], viewBox: [24, 24], mode: 'stroke' },
  bookmark: { d: ['M6 3h12v18l-6-4.5L6 21V3Z'], viewBox: [24, 24], mode: 'stroke' },
  share: { d: ['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7', 'M12 3v12', 'M7 8l5-5 5 5'], viewBox: [24, 24], mode: 'stroke' },
  comment: { d: ['M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z'], viewBox: [24, 24], mode: 'stroke' },
  user: { d: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'], viewBox: [24, 24], mode: 'stroke' },
  verified: { d: ['M12 2l2.4 2.1 3.1-.4.8 3 2.7 1.6-1.2 2.9 1.2 2.9-2.7 1.6-.8 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.8-3L3 15.7l1.2-2.9L3 9.9l2.7-1.6.8-3 3.1.4L12 2Z'], viewBox: [24, 24], mode: 'fill' },
} satisfies Record<string, ShapeDef>;

export type ShapeName = keyof typeof SHAPES;

/** Smooth sine-like wave across `width` (in its own viewBox of width × 2·amp). */
export function wave(width: number, amp: number, wavelength: number): ShapeDef {
  const segs: string[] = [`M0 ${amp}`];
  const half = wavelength / 2;
  let up = true;
  for (let x = 0; x < width; x += half) {
    const cx = x + half / 2;
    segs.push(`Q${cx.toFixed(1)} ${up ? 0 : 2 * amp} ${(x + half).toFixed(1)} ${amp}`);
    up = !up;
  }
  return { d: [segs.join(' ')], viewBox: [width, amp * 2], mode: 'stroke' };
}

/** n-point starburst / badge, viewBox 100. */
export function starburst(points = 12, inner = 0.78): ShapeDef {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return { d: [`M${pts.join(' L')} Z`], viewBox: [100, 100], mode: 'fill' };
}

/** Small deterministic PRNG for decorations (same slide → same shapes, so re-layouts don't jump). */
export function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

/** Irregular paint splat (viewBox 100) with a few droplets around it. */
export function splat(rand: () => number, spikes = 18): ShapeDef {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 30 + rand() * 18 : 20 + rand() * 8;
    const a = (Math.PI * i) / spikes;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  const drops = Array.from({ length: 4 }, () => {
    const a = rand() * Math.PI * 2;
    const r = 2 + rand() * 3.5;
    const cx = 50 + Math.cos(a) * (42 + rand() * 6);
    const cy = 50 + Math.sin(a) * (42 + rand() * 6);
    return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;
  });
  return { d: [`M${pts.join(' L')} Z`, ...drops], viewBox: [100, 100], mode: 'fill' };
}

/** A band of wavy "cut paper" (or hills) `w` wide and `h` tall: wavy top edge, flat bottom (viewBox w × h). */
export function hills(w: number, h: number, amp: number, wavelength: number, phase: number): ShapeDef {
  const top = amp;
  const pts: string[] = [`M0 ${h}`, `L0 ${(top + Math.sin(phase) * amp).toFixed(1)}`];
  for (let x = 0; x <= w; x += w / 48) pts.push(`L${x.toFixed(1)} ${(top + Math.sin(phase + (x / wavelength) * Math.PI * 2) * amp).toFixed(1)}`);
  pts.push(`L${w} ${h}`, 'Z');
  return { d: [pts.join(' ')], viewBox: [w, h], mode: 'fill' };
}

export const EXTRA_SHAPES = {
  triangle: { d: ['M50 4L96 92H4Z'], viewBox: [100, 100], mode: 'fill' },
  halfCircle: { d: ['M0 50A50 50 0 0 1 100 50Z'], viewBox: [100, 50], mode: 'fill' },
  plus: { d: ['M38 0h24v38h38v24H62v38H38V62H0V38h38Z'], viewBox: [100, 100], mode: 'fill' },
  arch: { d: ['M4 196V80A76 76 0 0 1 156 80V196Z'], viewBox: [160, 200], mode: 'stroke' },
  paperClip: { d: ['M14 40V118a18 18 0 0 0 36 0V22a12 12 0 0 0-24 0V104'], viewBox: [64, 140], mode: 'stroke' },
  cloud: { d: ['M20 60a18 18 0 0 1 4-35.5A26 26 0 0 1 74 22a20 20 0 0 1 6 38Z'], viewBox: [100, 64], mode: 'fill' },
  zigzagLine: { d: ['M0 10l10-10 10 10 10-10 10 10 10-10 10 10'], viewBox: [70, 10], mode: 'stroke' },
} satisfies Record<string, ShapeDef>;
