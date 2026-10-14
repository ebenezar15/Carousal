// Renders a slide on an offscreen Konva stage at exactly the preset's pixel size (scale 1), so exports
// never inherit rounding from the on-screen zoom level.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type Konva from 'konva';
import type { Slide } from '@/model/types';
import { SlideStage } from '@/editor/SlideStage';
import { preloadImages } from '@/editor/render/images';
import { ensureSlideFonts } from '@/editor/render/fonts';

export { slideFonts } from '@/editor/render/fonts';

export interface RenderOptions {
  mime?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  /** 1 = preset size; 2 = double resolution. */
  pixelRatio?: number;
}

/** Renders to a canvas at width×height×pixelRatio (offscreen, synchronous; fonts/images must be ready). */
export function renderSlideToCanvas(slide: Slide, width: number, height: number, pixelRatio = 1): HTMLCanvasElement {
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
    return (stage as Konva.Stage).toCanvas({ pixelRatio });
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Renders many frames through one persistent offscreen stage (animation exports): React only updates
 * what changed between frames instead of mounting a new stage each time.
 */
export class FrameRenderer {
  private host: HTMLDivElement;
  private root: ReturnType<typeof createRoot>;
  private stage: Konva.Stage | null = null;
  constructor(private width: number, private height: number, private pixelRatio = 1) {
    this.host = document.createElement('div');
    this.host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
    document.body.appendChild(this.host);
    this.root = createRoot(this.host);
  }
  render(slide: Slide): HTMLCanvasElement {
    flushSync(() => {
      this.root.render(<SlideStage ref={(s) => { this.stage = s; }} slide={slide} width={this.width} height={this.height} displayWidth={this.width} />);
    });
    if (!this.stage) throw new Error('Offscreen stage failed to mount');
    return this.stage.toCanvas({ pixelRatio: this.pixelRatio });
  }
  dispose() {
    this.root.unmount();
    this.host.remove();
  }
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

/** Waits for fonts and images, then renders at the exact output size. */
export async function renderSlide(slide: Slide, width: number, height: number, opts: RenderOptions = {}): Promise<string> {
  await Promise.all([ensureSlideFonts([slide]), preloadImages([slide])]);
  return renderSlideToDataURL(slide, width, height, opts);
}
