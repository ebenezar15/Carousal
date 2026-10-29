// Turns an ArtPiece (illustration data) into slide elements: one group the user can move and resize as a
// whole (or ungroup to recolor parts), with one path per part. Moving parts (a waving arm, a floating
// dove) become sub-groups centred on their pivot, carrying a looping animation.
import { newId } from '@/model/id';
import type { GroupElement, PathElement, SlideElement } from '@/model/types';
import type { ArtPart, ArtPiece } from '../art/types';

const LOOPS = { wave: 'wave', sway: 'sway', float: 'float', bob: 'bob', spin: 'spin', twinkle: 'twinkle', blink: 'blink', drift: 'drift' } as const;

function partEl(p: ArtPart, vb: [number, number], x: number, y: number, w: number, h: number, scale: number): PathElement {
  return {
    id: newId('el_'), kind: 'path', slot: 'art-part', name: 'art part',
    x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, width: w, height: h, rotation: 0, opacity: p.opacity ?? 1,
    data: [p.d], viewBox: vb,
    ...(p.fill ? { fill: p.fill } : {}),
    ...(p.stroke ? { stroke: p.stroke, strokeWidth: Math.max(0.5, (p.strokeWidth ?? 2) * scale) } : {}),
  };
}

/**
 * Places `art` into the box (x, y, w, h), keeping its aspect ratio (`fit` contain, aligned bottom-centre
 * so figures stand on the box's floor, or 'cover' to fill and crop the box).
 */
export function artToElement(art: ArtPiece, x: number, y: number, w: number, h: number, slot: string, name: string, fit: 'contain' | 'cover' = 'contain'): GroupElement {
  const [vw, vh] = art.viewBox;
  const s = fit === 'cover' ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh);
  const aw = vw * s;
  const ah = vh * s;
  const ox = (w - aw) / 2;
  const oy = fit === 'cover' ? (h - ah) / 2 : h - ah;
  const children: SlideElement[] = art.parts.map((p) => partEl(p, art.viewBox, ox, oy, aw, ah, s));
  (art.movers ?? []).forEach((m, n) => {
    const px = ox + m.pivot[0] * s;
    const py = oy + m.pivot[1] * s;
    // A square around the pivot big enough for the whole piece: rotation then pivots on the joint.
    const r = Math.max(aw, ah);
    children.push({
      id: newId('el_'), kind: 'group', slot: 'art-mover', name: m.name,
      x: px - r, y: py - r, width: 2 * r, height: 2 * r, rotation: 0, opacity: 1,
      children: m.parts.map((p) => partEl(p, art.viewBox, ox - (px - r), oy - (py - r), aw, ah, s)),
      anim: { enter: 'none', delay: 0, duration: 0.01, loop: LOOPS[m.loop], phase: m.phase ?? n * 0.37 },
    });
  });
  return { id: newId('el_'), kind: 'group', slot, name, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), rotation: 0, opacity: 1, children };
}
