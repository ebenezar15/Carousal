// Konva image filters (brightness/contrast/saturation/blur/grayscale/duotone). Filters need node.cache();
// useLayoutEffect keeps it synchronous so offscreen exports include filtered pixels.
import { useLayoutEffect, useRef } from 'react';
import Konva from 'konva';
import type { ImageFilters } from '@/model/types';
import { hexToRgb } from '@/styles/color';

function duotoneFilter(dark: string, light: string) {
  const [dr, dg, db] = hexToRgb(dark);
  const [lr, lg, lb] = hexToRgb(light);
  return function Duotone(imageData: ImageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const t = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255;
      d[i] = dr + (lr - dr) * t;
      d[i + 1] = dg + (lg - dg) * t;
      d[i + 2] = db + (lb - db) * t;
    }
  };
}

export function hasFilters(f?: ImageFilters) {
  return Boolean(f && (f.brightness || f.contrast || f.saturation || f.blur || f.grayscale || f.duotone));
}

export function useFilters(f: ImageFilters | undefined, img: HTMLImageElement | undefined, w: number, h: number) {
  const ref = useRef<Konva.Image>(null);
  const key = JSON.stringify(f ?? null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (!hasFilters(f)) {
      node.clearCache();
      node.filters([]);
      return;
    }
    const list: Konva.Filter[] = [];
    if (f!.brightness) list.push(Konva.Filters.Brighten);
    if (f!.contrast) list.push(Konva.Filters.Contrast);
    if (f!.saturation) list.push(Konva.Filters.HSL);
    if (f!.blur) list.push(Konva.Filters.Blur);
    if (f!.grayscale) list.push(Konva.Filters.Grayscale);
    if (f!.duotone) list.push(duotoneFilter(f!.duotone[0], f!.duotone[1]) as Konva.Filter);
    node.cache({ pixelRatio: Math.min(2, Math.max(1, img.naturalWidth / Math.max(1, w))) });
    node.filters(list);
    node.brightness(f!.brightness ?? 0);
    node.contrast(f!.contrast ?? 0);
    node.saturation(f!.saturation ?? 0);
    node.blurRadius(f!.blur ?? 0);
    node.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, img, w, h]);
  return ref;
}
