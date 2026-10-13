// Smart guides: snaps a moving box to canvas edges/center, the safe box and other elements' edges/centers.
import type { Rect } from './ops';

export interface Guide { orientation: 'v' | 'h'; pos: number }

export function snapBox(box: Rect, targets: { v: number[]; h: number[] }, threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const xs = [box.x, box.x + box.width / 2, box.x + box.width];
  const ys = [box.y, box.y + box.height / 2, box.y + box.height];
  let best = { dx: 0, dist: threshold + 1, pos: 0 };
  for (const t of targets.v) for (const x of xs) {
    const d = Math.abs(t - x);
    if (d < best.dist) best = { dx: t - x, dist: d, pos: t };
  }
  let bestY = { dy: 0, dist: threshold + 1, pos: 0 };
  for (const t of targets.h) for (const y of ys) {
    const d = Math.abs(t - y);
    if (d < bestY.dist) bestY = { dy: t - y, dist: d, pos: t };
  }
  const guides: Guide[] = [];
  const dx = best.dist <= threshold ? best.dx : 0;
  const dy = bestY.dist <= threshold ? bestY.dy : 0;
  if (best.dist <= threshold) guides.push({ orientation: 'v', pos: best.pos });
  if (bestY.dist <= threshold) guides.push({ orientation: 'h', pos: bestY.pos });
  return { dx, dy, guides };
}

export function snapTargets(canvas: { width: number; height: number }, safe: Rect | null, others: Rect[]) {
  const v = [0, canvas.width / 2, canvas.width];
  const h = [0, canvas.height / 2, canvas.height];
  if (safe) {
    v.push(safe.x, safe.x + safe.width);
    h.push(safe.y, safe.y + safe.height);
  }
  for (const o of others) {
    v.push(o.x, o.x + o.width / 2, o.x + o.width);
    h.push(o.y, o.y + o.height / 2, o.y + o.height);
  }
  return { v, h };
}
