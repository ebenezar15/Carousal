import { describe, expect, it } from 'vitest';
import { artPalette, parsePath, prop, PROP_LIST, randomCharacter, scene, SCENE_LIST, treatArt, TREATMENT_LIST, type ArtPalette, type ArtPart, type ArtPiece } from '@/engine/art';

const CREAM = artPalette({ bg: '#EFE8DA', surface: '#F7F2E8', text: '#1B1A18', mutedText: '#5A554D', primary: '#9E2B25', accent: '#C08A3E', highlight: '#E8C77A' });
const NIGHT = artPalette({ bg: '#151413', surface: '#22201E', text: '#EFE8DA', mutedText: '#A8A196', primary: '#C9473D', accent: '#D6A35A', highlight: '#F0D58C' });

const allParts = (a: ArtPiece) => [...a.parts, ...(a.movers ?? []).flatMap((m) => m.parts)];
const up = (c?: string) => (c ?? '').toUpperCase();
const pieces = (pal: ArtPalette): [string, ArtPiece][] => [
  ...PROP_LIST.map((k): [string, ArtPiece] => [k, prop(k, pal, 1)]),
  ...SCENE_LIST.map((k): [string, ArtPiece] => [k, scene(k, pal, 2)]),
  ['council+people', scene('council', pal, 3, { people: [randomCharacter(1, pal, 'pray'), randomCharacter(2, pal, 'wave')] })],
];

function checkValid(a: ArtPiece) {
  for (const p of allParts(a)) {
    expect(p.d).not.toMatch(/NaN|Infinity|undefined/);
    expect(() => parsePath(p.d)).not.toThrow();
    if (p.strokeWidth != null) expect(Number.isFinite(p.strokeWidth)).toBe(true);
    if (p.opacity != null) expect(p.opacity).toBeGreaterThanOrEqual(0);
  }
  for (const m of a.movers ?? []) expect(m.parts.length).toBeGreaterThan(0);
}

describe('treatArt', () => {
  it('lists the five treatments', () => {
    expect(TREATMENT_LIST).toEqual(['color', 'engraving', 'duotone', 'line', 'silhouette']);
  });

  it("'color' is an identity copy", () => {
    for (const [, a] of pieces(CREAM)) {
      const t = treatArt(a, 'color', CREAM);
      expect(t).toEqual(a);
      expect(t).not.toBe(a);
      expect(t.parts).not.toBe(a.parts);
    }
  });

  it('is pure and keeps the viewBox, mover names, loops and pivots', () => {
    for (const pal of [CREAM, NIGHT])
      for (const [name, a] of pieces(pal)) {
        const before = JSON.stringify(a);
        for (const tr of TREATMENT_LIST) {
          const t = treatArt(a, tr, pal);
          expect(JSON.stringify(a), `${name} ${tr} mutated`).toBe(before);
          expect(t.viewBox).toEqual(a.viewBox);
          checkValid(t);
          const movers = new Map((a.movers ?? []).map((m) => [m.name, m]));
          for (const m of t.movers ?? []) {
            const src = movers.get(m.name)!;
            expect(src, `${name} ${tr} ${m.name}`).toBeTruthy();
            expect(m.pivot).toEqual(src.pivot);
            expect(m.loop).toBe(src.loop);
          }
        }
      }
  });

  it('keeps part counts: 1:1 for duotone, plus hatching only for engraving, never more for line/silhouette', () => {
    for (const [name, a] of pieces(CREAM)) {
      const duo = treatArt(a, 'duotone', CREAM);
      expect(duo.parts.length).toBe(a.parts.length);
      expect((duo.movers ?? []).map((m) => m.parts.length)).toEqual((a.movers ?? []).map((m) => m.parts.length));
      const eng = treatArt(a, 'engraving', CREAM);
      expect(eng.movers?.length ?? 0, name).toBe(a.movers?.length ?? 0);
      // Every original part survives in order; extra parts are stroke-only hatching.
      expect(eng.parts.length).toBeGreaterThanOrEqual(a.parts.length);
      const extra = allParts(eng).filter((p) => p.fill === 'none' && p.stroke === CREAM.ink && p.opacity === 0.35);
      expect(allParts(eng).length - allParts(a).length).toBeLessThanOrEqual(extra.length);
      for (const tr of ['line', 'silhouette'] as const) expect(allParts(treatArt(a, tr, CREAM)).length).toBeLessThanOrEqual(allParts(a).length);
    }
  });

  it('engraving: tones between paper and ink, ink outlines, and the primary spot colour survives', () => {
    const drape = treatArt(prop('drape', CREAM, 1), 'engraving', CREAM);
    const cloth = drape.movers!.find((m) => m.name === 'cloth')!;
    expect(cloth.parts[0]!.fill).toBe(CREAM.primary);
    for (const pal of [CREAM, NIGHT]) {
      // A prop that marks no spot parts: its primary parts keep the primary.
      const masks = treatArt(prop('masks', pal, 1), 'engraving', pal);
      expect(allParts(masks).some((p) => up(p.fill) === up(pal.primary))).toBe(true);
      const col = treatArt(prop('column', pal, 1), 'engraving', pal);
      const solid = allParts(col).filter((p) => p.fill && p.fill !== 'none' && (p.opacity ?? 1) >= 0.5);
      expect(solid.length).toBeGreaterThan(3);
      for (const p of solid) {
        expect(p.stroke).toBe(pal.ink);
        expect(p.strokeWidth).toBeCloseTo(0.5, 1);
      }
      // No colour other than tones of bg↔ink survives in a piece without spot parts (the column).
      expect(allParts(col).every((p) => up(p.fill) !== up(pal.primary) && up(p.fill) !== up(pal.accent))).toBe(true);
    }
  });

  it('engraving: landscape bands are toned, only marked spot parts stay coloured in scenes', () => {
    const src = scene('council', CREAM, 2);
    const t = treatArt(src, 'engraving', CREAM);
    const coloured = allParts(t).filter((p) => up(p.fill) === up(CREAM.primary));
    expect(coloured.length).toBeGreaterThan(0);
    const spots = new Set(allParts(src).filter((p) => p.spot).map((p) => p.d));
    for (const p of coloured) expect(spots.has(p.d)).toBe(true);
  });

  it('engraving hatches darker shapes with thin ink lines inside their bounds', () => {
    const t = treatArt(prop('hourglass', CREAM, 1), 'engraving', CREAM);
    const hatch = allParts(t).filter((p) => p.fill === 'none' && p.opacity === 0.35);
    expect(hatch.length).toBeGreaterThan(0);
    for (const h of hatch) {
      expect(h.stroke).toBe(CREAM.ink);
      expect(h.d).toMatch(/^M[\d.\- ]+L[\d.\- ]+/);
    }
  });

  it('duotone maps colours onto the ink → primary → paper ramp without outlines', () => {
    const src = prop('globe', CREAM, 1);
    const t = treatArt(src, 'duotone', CREAM);
    src.parts.forEach((p, i) => expect(t.parts[i]!.stroke ?? null).toBe(p.stroke ?? null));
    expect(allParts(t).some((p) => up(p.fill) === up(CREAM.accent))).toBe(false);
  });

  it('line: no solid fills other than the paper colour, uniform ink strokes, glows dropped', () => {
    for (const pal of [CREAM, NIGHT])
      for (const [name, a] of pieces(pal)) {
        const t = treatArt(a, 'line', pal);
        for (const p of allParts(t)) {
          expect([up(pal.bg), 'NONE'], name).toContain(up(p.fill ?? 'none'));
          expect(p.stroke).toBe(pal.ink);
          expect(p.opacity == null || p.opacity >= 0.5).toBe(true);
        }
      }
  });

  it('silhouette: only ink (and spot colours), no strokes on filled shapes, no translucent parts', () => {
    for (const pal of [CREAM, NIGHT])
      for (const [name, a] of pieces(pal)) {
        const spotColours = new Set(allParts(a).filter((p) => p.spot).flatMap((p) => [up(p.fill), up(p.stroke)]));
        const ok = new Set([up(pal.ink), up(pal.primary), 'NONE', ...spotColours]);
        const t = treatArt(a, 'silhouette', pal);
        for (const p of allParts(t)) {
          expect(ok.has(up(p.fill ?? 'none')), `${name} fill ${p.fill}`).toBe(true);
          if (p.fill && p.fill !== 'none') expect(p.stroke).toBeUndefined();
          expect(p.opacity).toBeUndefined();
        }
      }
    const drape = treatArt(prop('drape', CREAM, 1), 'silhouette', CREAM);
    expect(allParts(drape).some((p) => p.fill === CREAM.primary)).toBe(true);
    expect(allParts(drape).some((p) => p.fill === CREAM.ink)).toBe(true);
  });

  it('handles parts without fill and odd colours', () => {
    const odd: ArtPiece = {
      viewBox: [100, 100],
      parts: [{ d: 'M0 0L10 0L10 10Z' } as ArtPart, { d: 'M0 0L50 50', stroke: '#123456', strokeWidth: 2 }, { d: 'M0 0L10 0L10 10Z', fill: 'none' }],
      movers: [{ name: 'm', loop: 'bob', pivot: [5, 5], parts: [{ d: 'M0 0L10 0L10 10Z', fill: '#abc' }] }],
    };
    for (const tr of TREATMENT_LIST) {
      const t = treatArt(odd, tr, CREAM);
      checkValid(t);
    }
    expect(treatArt(odd, 'engraving', CREAM).movers![0]!.parts[0]!.fill).toMatch(/^#[0-9A-F]{6}$/);
  });
});
