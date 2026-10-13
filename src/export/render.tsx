// Renders a slide on an offscreen Konva stage at exactly the preset's pixel size (scale 1), so exports
// never inherit rounding from the on-screen zoom level.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type Konva from 'konva';
import type { Slide } from '@/model/types';
import { SlideStage } from '@/editor/SlideStage';

export interface RenderOptions {
  mime?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  /** 1 = preset size; 2 = double resolution. */
  pixelRatio?: number;
}

export function renderSlideToDataURL(slide: Slide, width: number, height: number, opts: RenderOptions = {}): string {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  let stage: Konva.Stage | null = null;
  try {
    flushSync(() => {
      root.render(<SlideStage ref={(s) => { stage = s; }} slide={slide} width={width} height={height} displayWidth={width} />);
    });
    if (!stage) throw new Error('Offscreen stage failed to mount');
    return (stage as Konva.Stage).toDataURL({ pixelRatio: opts.pixelRatio ?? 1, mimeType: opts.mime ?? 'image/png', quality: opts.quality ?? 0.92 });
  } finally {
    root.unmount();
    host.remove();
  }
}
