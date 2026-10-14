// Mask shapes for images (normalized to a w×h box) and helpers.
import type { ImageMask } from '@/model/types';

type Ctx = { beginPath(): void; closePath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; arc(x: number, y: number, r: number, a: number, b: number): void; ellipse(x: number, y: number, rx: number, ry: number, rot: number, a: number, b: number): void; quadraticCurveTo(cx: number, cy: number, x: number, y: number): void; bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void; rect(x: number, y: number, w: number, h: number): void };

export function traceMask(ctx: Ctx, mask: ImageMask | undefined, w: number, h: number, radius = 0) {
  ctx.beginPath();
  switch (mask) {
    case 'circle':
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'arch':
      ctx.moveTo(0, h);
      ctx.lineTo(0, w / 2);
      ctx.ellipse(w / 2, w / 2, w / 2, w / 2, 0, Math.PI, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      break;
    case 'hexagon':
      [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]].forEach(([x, y], i) => (i ? ctx.lineTo(x! * w, y! * h) : ctx.moveTo(x! * w, y! * h)));
      ctx.closePath();
      break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.22;
        const a = (Math.PI * i) / 5 - Math.PI / 2;
        const x = w / 2 + Math.cos(a) * r * w;
        const y = h / 2 + Math.sin(a) * r * h;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'blob':
      ctx.moveTo(0.58 * w, 0.04 * h);
      ctx.bezierCurveTo(0.81 * w, 0.08 * h, 0.97 * w, 0.28 * h, 0.96 * w, 0.52 * h);
      ctx.bezierCurveTo(0.95 * w, 0.78 * h, 0.72 * w, 0.97 * h, 0.46 * w, 0.96 * h);
      ctx.bezierCurveTo(0.2 * w, 0.95 * h, 0.03 * w, 0.74 * h, 0.04 * w, 0.48 * h);
      ctx.bezierCurveTo(0.05 * w, 0.22 * h, 0.34 * w, 0, 0.58 * w, 0.04 * h);
      ctx.closePath();
      break;
    case 'rounded':
    default: {
      const r = Math.min(mask === 'rounded' ? Math.max(radius, Math.min(w, h) * 0.08) : radius, w / 2, h / 2);
      if (r <= 0) {
        ctx.rect(0, 0, w, h);
        break;
      }
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
    }
  }
}

/** Source rectangle for "cover" with zoom and focal point. */
export function coverCrop(imgW: number, imgH: number, boxW: number, boxH: number, crop?: { zoom: number; focusX: number; focusY: number }) {
  const zoom = Math.max(1, crop?.zoom ?? 1);
  const scale = Math.max(boxW / imgW, boxH / imgH) * zoom;
  const w = boxW / scale;
  const h = boxH / scale;
  const fx = crop?.focusX ?? 0.5;
  const fy = crop?.focusY ?? 0.5;
  const x = Math.min(Math.max(0, fx * imgW - w / 2), imgW - w);
  const y = Math.min(Math.max(0, fy * imgH - h / 2), imgH - h);
  return { x, y, width: w, height: h };
}
