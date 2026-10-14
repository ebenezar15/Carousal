// Browser sampler for the accessibility checker: renders the slide with the text element hidden and
// reads the pixels behind it (low resolution, cached per slide).
import type { Slide, SlideElement } from '@/model/types';
import { rgbToHex } from '@/styles/color';
import { getPreset } from '@/styles';
import { renderSlideToCanvas } from '@/export/render';
import { prepareSlides } from '@/export/images';
import type { Sampler } from './accessibility';

const SCALE = 0.25;

/** All text hidden: what's left (backgrounds, cards, images, shapes) is what text sits on. */
function hideText(els: SlideElement[]): SlideElement[] {
  return els.map((e) => (e.kind === 'text' ? { ...e, hidden: true } : e.kind === 'group' ? { ...e, children: hideText(e.children) } : e));
}

export function canvasSampler(presetId: string): Sampler {
  const p = getPreset(presetId);
  // One low-res render per slide (keyed by object identity, so edits invalidate it).
  const cache = new WeakMap<Slide, HTMLCanvasElement>();
  return async (_i, slide: Slide, _excludeId, rects) => {
    let canvas = cache.get(slide);
    if (!canvas) {
      await prepareSlides([slide]);
      canvas = renderSlideToCanvas({ ...slide, elements: hideText(slide.elements) }, p.width, p.height, SCALE);
      cache.set(slide, canvas);
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    // Every sampled pixel is kept (with repeats), so the checker's percentile reflects area.
    const out: string[] = [];
    for (const rect of rects) {
      const x = Math.max(0, Math.floor(rect.x * SCALE));
      const y = Math.max(0, Math.floor(rect.y * SCALE));
      const w = Math.min(canvas.width - x, Math.ceil(rect.width * SCALE));
      const h = Math.min(canvas.height - y, Math.ceil(rect.height * SCALE));
      if (w <= 0 || h <= 0) continue;
      const data = ctx.getImageData(x, y, w, h).data;
      const sx = Math.max(1, Math.floor(w / 16));
      const sy = Math.max(1, Math.floor(h / 6));
      for (let yy = 0; yy < h; yy += sy)
        for (let xx = 0; xx < w; xx += sx) {
          const o = (yy * w + xx) * 4;
          out.push(rgbToHex(data[o]!, data[o + 1]!, data[o + 2]!));
        }
    }
    return out;
  };
}
