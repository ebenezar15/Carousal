// Procedural background textures (no image files, works offline): each kind is generated once into a
// seamless tile and repeated across the slide. Generators return a gray level around 0.5; it is stored
// as signed alpha (darker → black with alpha, lighter → white with alpha), so the texture shows as
// detail on any background color, light or dark, without shifting the color itself.
import type { TextureKind } from '@/model/types';

export type { TextureKind };

export const TEXTURES: { id: TextureKind; label: string }[] = [
  { id: 'paper', label: 'Paper' },
  { id: 'kraft', label: 'Kraft card' },
  { id: 'crumpled', label: 'Crumpled paper' },
  { id: 'linen', label: 'Linen' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'concrete', label: 'Concrete' },
  { id: 'stucco', label: 'Stucco' },
  { id: 'grunge', label: 'Grunge' },
  { id: 'terrazzo', label: 'Terrazzo' },
  { id: 'brushed', label: 'Brushed metal' },
  { id: 'riso', label: 'Riso grain' },
];


const SIZE = 512;

/** Small deterministic PRNG so tiles (and therefore exports) are identical every time. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Tileable value noise: a grid of random values (wrapping at `cells`) with smooth interpolation. */
function valueNoise(cells: number, rand: () => number) {
  const g = Array.from({ length: cells * cells }, rand);
  const at = (x: number, y: number) => g[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)]!;
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

/** Fractal noise (sum of octaves), tileable, 0..1. */
function fbm(octaves: number, base: number, seed: number) {
  const rand = rng(seed);
  const layers = Array.from({ length: octaves }, (_, i) => valueNoise(base * 2 ** i, rand));
  return (u: number, v: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (const n of layers) {
      sum += n(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

type Px = (x: number, y: number, u: number, v: number) => number | [number, number, number, number];

function paint(kind: TextureKind): (ctx: CanvasRenderingContext2D) => void {
  const pixels = (fn: Px) => (ctx: CanvasRenderingContext2D) => {
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const r = fn(x, y, x / SIZE, y / SIZE);
        const i = (y * SIZE + x) * 4;
        if (typeof r === 'number') {
          const d = Math.max(-1, Math.min(1, (r - 0.5) * 2));
          img.data[i] = img.data[i + 1] = img.data[i + 2] = d < 0 ? 0 : 255;
          img.data[i + 3] = Math.round(Math.abs(d) * 255);
        } else [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]] = r;
      }
    ctx.putImageData(img, 0, 0);
  };
  const grain = rng(7);
  switch (kind) {
    case 'paper': {
      const fibers = fbm(5, 8, 11);
      return pixels((_x, _y, u, v) => 0.5 + (fibers(u, v) - 0.5) * 0.35 + (grain() - 0.5) * 0.12);
    }
    case 'kraft': {
      const f = fbm(4, 6, 21);
      const streak = fbm(3, 32, 22);
      return pixels((_x, _y, u, v) => 0.5 + (f(u, v) - 0.5) * 0.3 + (streak(u * 0.3, v * 3) - 0.5) * 0.3 + (grain() - 0.5) * 0.18);
    }
    case 'crumpled': {
      const h = fbm(5, 4, 31);
      // Shade the noise surface like folds lit from the top-left.
      return pixels((_x, _y, u, v) => {
        const e = 1 / SIZE;
        const dx = h(u + e, v) - h(u - e, v);
        const dy = h(u, v + e) - h(u, v - e);
        return 0.5 - (dx + dy) * 40;
      });
    }
    case 'linen':
    case 'canvas': {
      const period = kind === 'linen' ? 4 : 8;
      const wob = fbm(3, 16, 41);
      return pixels((x, y, u, v) => {
        const a = Math.sin((x / period) * Math.PI + wob(u, v) * 4) * 0.5 + 0.5;
        const b = Math.sin((y / period) * Math.PI + wob(v, u) * 4) * 0.5 + 0.5;
        return 0.5 + ((x + y) % 2 ? a - 0.5 : b - 0.5) * 0.35 + (grain() - 0.5) * 0.08;
      });
    }
    case 'concrete':
    case 'stucco': {
      const f = fbm(6, kind === 'concrete' ? 6 : 12, 51);
      return pixels((_x, _y, u, v) => {
        const pit = grain() < (kind === 'concrete' ? 0.012 : 0.004) ? -0.35 : 0;
        return 0.5 + (f(u, v) - 0.5) * (kind === 'concrete' ? 0.6 : 0.9) + pit + (grain() - 0.5) * 0.1;
      });
    }
    case 'watercolor': {
      const f = fbm(5, 3, 61);
      const edges = fbm(4, 10, 62);
      return pixels((_x, _y, u, v) => {
        const n = f(u, v);
        // Pigment pools darker at the edges of each blotch.
        const ring = 1 - Math.min(1, Math.abs(n - 0.5) * 6);
        return 0.5 - ring * 0.3 - (edges(u, v) - 0.5) * 0.25;
      });
    }
    case 'grunge': {
      const f = fbm(5, 5, 71);
      return (ctx: CanvasRenderingContext2D) => {
        pixels((_x, _y, u, v) => {
          const n = f(u, v);
          return n > 0.62 ? 0.25 : 0.5 - (grain() < 0.02 ? 0.3 : 0);
        })(ctx);
        const r = rng(72);
        ctx.strokeStyle = 'rgba(60,60,60,0.35)';
        for (let i = 0; i < 40; i++) {
          ctx.lineWidth = 0.5 + r() * 1.5;
          const x = r() * SIZE;
          const y = r() * SIZE;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 40);
          ctx.stroke();
        }
      };
    }
    case 'brushed': {
      const f = fbm(4, 4, 81);
      return pixels((_x, _y, u, v) => 0.5 + (f(u * 0.02, v * 2) - 0.5) * 0.7 + (grain() - 0.5) * 0.12);
    }
    case 'riso': {
      return pixels(() => (grain() < 0.18 ? 0.15 + grain() * 0.3 : 0.5));
    }
    case 'terrazzo': {
      return (ctx: CanvasRenderingContext2D) => {
        const r = rng(91);
        ctx.clearRect(0, 0, SIZE, SIZE);
        const shades = ['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.3)'];
        for (let i = 0; i < 220; i++) {
          const x = r() * SIZE;
          const y = r() * SIZE;
          const s = 2 + r() ** 3 * 18;
          ctx.fillStyle = shades[i % shades.length]!;
          ctx.beginPath();
          const sides = 4 + Math.floor(r() * 4);
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2 + r() * 0.6;
            const rr = s * (0.6 + r() * 0.5);
            // Draw wrapped copies so chips crossing an edge continue on the other side (seamless tile).
            const px = x + Math.cos(a) * rr;
            const py = y + Math.sin(a) * rr;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      };
    }
  }
}

const cache = new Map<TextureKind, HTMLCanvasElement | null>();

/** The tile for a texture kind (generated on first use; null outside a browser). */
export function textureTile(kind: TextureKind): HTMLCanvasElement | null {
  if (cache.has(kind)) return cache.get(kind)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) {
    cache.set(kind, null);
    return null;
  }
  paint(kind)(ctx);
  cache.set(kind, c);
  return c;
}
