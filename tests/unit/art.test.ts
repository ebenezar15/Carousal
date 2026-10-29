import { describe, expect, it } from 'vitest';
import {
  artPalette,
  character,
  EXPRESSIONS,
  HAIR_COLORS,
  HAIR_LIST,
  NEUTRAL_COLORS,
  parsePath,
  pathBounds,
  POSE_LIST,
  prop,
  PROP_LIST,
  randomCharacter,
  scene,
  SCENE_LIST,
  SKIN_TONES,
  transformPath,
  type ArtPalette,
  type ArtPiece,
} from '@/engine/art';

const LIGHT = artPalette({ bg: '#FBF6E9', surface: '#FFFDF6', text: '#2A2723', mutedText: '#5F5A50', primary: '#2F5BB7', accent: '#D9473B', highlight: '#FFE58A' });
const DARK = artPalette({ bg: '#12162E', surface: '#1E2346', text: '#F3EEFF', mutedText: '#B8B3D9', primary: '#FF9E7A', accent: '#8C7BFF', highlight: '#FFD1E8' });

const allParts = (a: ArtPiece) => [...a.parts, ...(a.movers ?? []).flatMap((m) => m.parts)];

function allowedColors(pal: ArtPalette, extra: string[] = []) {
  return new Set([...Object.values(pal), ...SKIN_TONES, ...HAIR_COLORS, ...NEUTRAL_COLORS, ...extra, 'none'].map((c) => c.toUpperCase()));
}

/** Every path parses, colors are allowed, and (nearly) all geometry sits inside the viewBox. */
function checkPiece(a: ArtPiece, allowed: Set<string>, slack = 0.08, minInside = 0.9) {
  const [w, h] = a.viewBox;
  const parts = allParts(a);
  expect(parts.length).toBeGreaterThanOrEqual(3);
  let inside = 0;
  for (const p of parts) {
    expect(() => parsePath(p.d)).not.toThrow();
    expect(p.d).toMatch(/^M/);
    for (const c of [p.fill, p.stroke]) if (c) expect(allowed.has(c.toUpperCase()), `color ${c}`).toBe(true);
    if (p.opacity != null) expect(p.opacity).toBeGreaterThanOrEqual(0);
    const b = pathBounds(p.d);
    for (const v of [b.x0, b.x1, b.y0, b.y1]) expect(Number.isFinite(v)).toBe(true);
    // Allow generous overhang (bezier control points, off-canvas trims) but nothing far away.
    expect(b.x0).toBeGreaterThan(-w * 0.35);
    expect(b.x1).toBeLessThan(w * 1.35);
    expect(b.y0).toBeGreaterThan(-h * 0.35);
    expect(b.y1).toBeLessThan(h * 1.35);
    if (b.x0 >= -w * slack && b.x1 <= w * (1 + slack) && b.y0 >= -h * slack && b.y1 <= h * (1 + slack)) inside++;
  }
  expect(inside / parts.length).toBeGreaterThan(minInside);
  for (const m of a.movers ?? []) {
    expect(m.parts.length).toBeGreaterThan(0);
    expect(m.pivot.every(Number.isFinite)).toBe(true);
  }
}

describe('path utilities', () => {
  it('parses the full SVG path grammar', () => {
    const d = 'M10 10 h20 v20 H5 V5 l5 5 c1 2 3 4 5 6 s2 2 4 4 q5 5 10 0 t10 0 a5 5 0 0 1 10 0 A10 10 0 1 0 50 50 C1,2,3,4,5,6 S1 2 3 4 Q1 2 3 4 T5 5 m1 1 l-1e1-2.5.5.5z';
    const segs = parsePath(d);
    expect(segs.every((s) => ['M', 'L', 'C', 'Q', 'Z'].includes(s.c))).toBe(true);
    expect(segs.filter((s) => s.c === 'M').length).toBe(2);
    expect(() => parsePath('M0 0 L 5')).toThrow();
    expect(() => parsePath('L0 0')).toThrow();
    expect(() => parsePath('M0 0 X5 5')).toThrow();
  });
  it('transforms relative commands and arcs into absolute coordinates', () => {
    expect(transformPath('m10 10 l10 0 h5 v5z', [2, 0, 0, 2, 1, 1])).toBe('M21 21L41 21L51 21L51 31Z');
    const arc = pathBounds(transformPath('M0 0 A10 10 0 0 1 20 0', [1, 0, 0, 1, 100, 100]));
    expect(arc.x0).toBeCloseTo(100, 0);
    expect(arc.x1).toBeCloseTo(120, 0);
    expect(arc.y0).toBeLessThan(95); // the arc bulges upward (sweep=1 in y-down space)
  });
});

describe('characters', () => {
  it('builds every pose × hair × expression for adults and children, both palettes', () => {
    for (const pal of [LIGHT, DARK]) {
      const allowed = allowedColors(pal);
      POSE_LIST.forEach((pose, i) => {
        for (const hair of HAIR_LIST)
          for (const child of [false, true]) {
            const base = randomCharacter(i * 11 + hair.length, pal, pose);
            const a = character({ ...base, hair, child, expression: EXPRESSIONS[i % 4], flip: i % 2 === 0 });
            expect(a.viewBox).toEqual([200, 320]);
            checkPiece(a, allowed, 0.02);
          }
      });
    }
  });
  it('covers every pose in the contract and animates waving/worship arms at the shoulder', () => {
    expect(POSE_LIST).toHaveLength(12);
    const spec = randomCharacter(1, LIGHT);
    const wave = character({ ...spec, pose: 'wave', flip: false, child: false });
    expect(wave.movers?.map((m) => m.loop)).toContain('wave');
    expect(wave.movers![0]!.pivot[1]).toBeGreaterThan(90);
    expect(wave.movers![0]!.pivot[1]).toBeLessThan(130);
    const worship = character({ ...spec, pose: 'worship' });
    expect(worship.movers?.filter((m) => m.loop === 'sway')).toHaveLength(2);
    expect(character({ ...spec, pose: 'pray' }).movers ?? []).toHaveLength(0);
  });
  it('keeps feet on the bottom for adults and children', () => {
    for (const child of [false, true]) {
      const a = character({ ...randomCharacter(3, LIGHT, 'stand'), child });
      const ys = allParts(a).map((p) => pathBounds(p.d).y1);
      expect(Math.max(...ys)).toBeGreaterThan(305);
      expect(Math.max(...ys)).toBeLessThanOrEqual(320);
      const tops = Math.min(...allParts(a).map((p) => pathBounds(p.d).y0));
      if (child) expect(tops).toBeGreaterThan(80);
      else expect(tops).toBeLessThan(40);
    }
  });
  it('flips horizontally', () => {
    const spec = randomCharacter(4, LIGHT, 'point');
    const a = character({ ...spec, flip: false });
    const b = character({ ...spec, flip: true });
    const ax = pathBounds(a.movers![0]!.parts[0]!.d);
    const bx = pathBounds(b.movers![0]!.parts[0]!.d);
    expect(ax.x1).toBeCloseTo(200 - bx.x0, 0);
  });
  it('random characters are deterministic, diverse, and never dressed in the background color', () => {
    expect(randomCharacter(9, LIGHT)).toEqual(randomCharacter(9, LIGHT));
    const many = Array.from({ length: 60 }, (_, i) => randomCharacter(i, LIGHT));
    expect(new Set(many.map((c) => c.skin)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(many.map((c) => c.hair)).size).toBeGreaterThanOrEqual(5);
    expect(SKIN_TONES.length).toBeGreaterThanOrEqual(6);
    for (const c of many) {
      expect(c.top.toUpperCase()).not.toBe(LIGHT.bg.toUpperCase());
      expect(c.bottom.toUpperCase()).not.toBe(LIGHT.bg.toUpperCase());
    }
    expect(randomCharacter(2, DARK, 'read').pose).toBe('read');
  });
});

describe('scenes', () => {
  it('builds every scene kind on both palettes with valid paths and palette colors', () => {
    expect(SCENE_LIST).toHaveLength(21);
    for (const pal of [LIGHT, DARK]) {
      const allowed = allowedColors(pal);
      for (const kind of SCENE_LIST)
        for (const seed of [1, 2, 3]) {
          const a = scene(kind, pal, seed);
          expect(a.viewBox).toEqual([1000, 600]);
          // Light rays deliberately bleed off the canvas edges.
          checkPiece(a, allowed, 0.08, 0.75);
        }
    }
  });
  it('is deterministic per seed and recomposes with other seeds', () => {
    for (const kind of SCENE_LIST) {
      expect(scene(kind, LIGHT, 5)).toEqual(scene(kind, LIGHT, 5));
      const a = JSON.stringify(scene(kind, LIGHT, 5));
      const b = JSON.stringify(scene(kind, LIGHT, 6));
      expect(a, kind).not.toBe(b);
    }
  });
  it('gives scenes life with movers', () => {
    const loops = (k: (typeof SCENE_LIST)[number]) => new Set((scene(k, LIGHT, 1).movers ?? []).map((m) => m.loop));
    expect(loops('night-sky').has('twinkle')).toBe(true);
    expect(loops('sea-boat').has('bob')).toBe(true);
    expect(loops('shepherd').has('drift')).toBe(true);
    expect(loops('table').has('blink')).toBe(true);
    for (const k of SCENE_LIST) expect((scene(k, LIGHT, 1).movers ?? []).length, k).toBeGreaterThan(0);
  });
  it('places people standing on the ground line, scaled into the scene', () => {
    const people = [randomCharacter(1, LIGHT, 'wave'), { ...randomCharacter(2, LIGHT, 'stand'), child: true }];
    for (const kind of SCENE_LIST) {
      const without = scene(kind, LIGHT, 4);
      const withPeople = scene(kind, LIGHT, 4, { people });
      expect(allParts(withPeople).length, kind).toBeGreaterThan(allParts(without).length + 20);
      checkPiece(withPeople, allowedColors(LIGHT), 0.08, 0.75);
    }
    const wave = scene('hill-cross', LIGHT, 4, { people }).movers!.find((m) => m.name.startsWith('person-'));
    expect(wave?.loop).toBe('wave');
  });
});

describe('props', () => {
  it('builds every prop kind on both palettes', () => {
    expect(PROP_LIST).toHaveLength(32);
    for (const pal of [LIGHT, DARK]) {
      const allowed = allowedColors(pal);
      for (const kind of PROP_LIST) {
        const a = prop(kind, pal, 3);
        expect(a.viewBox).toEqual([100, 100]);
        checkPiece(a, allowed, 0.1);
        expect(prop(kind, pal, 3)).toEqual(a);
      }
    }
  });
  it('animates the candle flame', () => {
    expect(prop('candle', LIGHT).movers?.some((m) => m.loop === 'blink')).toBe(true);
  });
});

describe('artPalette', () => {
  it('maps the carousel palette and derives soft tints between bg and primary', () => {
    expect(LIGHT.ink).toBe('#2A2723');
    expect(LIGHT.muted).toBe('#5F5A50');
    expect(LIGHT.soft).not.toBe(LIGHT.bg);
    expect(LIGHT.softer).not.toBe(LIGHT.soft);
  });
});
