// Slideshow video export: MP4/WebM via WebCodecs (Mediabunny) and animated GIF (gifenc).
// Slides hold for `hold` seconds, then transition to the next over `transition` seconds.
import type { Slide } from '@/model/types';
import { FrameRenderer } from './render';
import { prepareSlides } from './images';
import { frameOf, introDuration, needsLiveHold, slideHasAnimation } from '@/editor/animation';

export type Transition = 'fade' | 'slide' | 'zoom' | 'none';

export interface VideoOptions {
  width: number;
  height: number;
  hold: number;
  transition: Transition;
  transitionDuration: number;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

/**
 * One slide's segment of the video: animated slides play their entrances first (`intro` seconds), then
 * hold; slides with looping animations are rendered live for the whole segment.
 */
export class SlideClip {
  readonly intro: number;
  readonly duration: number;
  private readonly live: boolean;
  private still: HTMLCanvasElement | null = null;
  private first: HTMLCanvasElement | null = null;
  constructor(readonly slide: Slide, private renderer: FrameRenderer, private unit: number, hold: number) {
    this.intro = slideHasAnimation(slide) ? introDuration(slide) : 0;
    this.duration = this.intro + hold;
    this.live = needsLiveHold(slide);
  }
  private draw(t: number) {
    return this.renderer.render(frameOf(this.slide, t, this.unit));
  }
  /** The slide at time t (seconds into its segment). */
  at(t: number): HTMLCanvasElement {
    if (t <= 0 && this.intro > 0) return (this.first ??= this.draw(0));
    if (this.live || t < this.intro) return this.draw(t);
    return (this.still ??= this.draw(Math.max(t, this.intro)));
  }
}

async function clips(slides: Slide[], w: number, h: number, outW: number, hold: number): Promise<{ segs: SlideClip[]; done(): void }> {
  await prepareSlides(slides);
  const renderer = new FrameRenderer(w, h, outW / w);
  return { segs: slides.map((s) => new SlideClip(s, renderer, w / 1080, hold)), done: () => renderer.dispose() };
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function drawTransition(ctx: CanvasRenderingContext2D, a: HTMLCanvasElement, b: HTMLCanvasElement, t: number, type: Transition) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const e = ease(Math.min(1, Math.max(0, t)));
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (type === 'slide') {
    ctx.drawImage(a, -e * W, 0, W, H);
    ctx.drawImage(b, W - e * W, 0, W, H);
  } else if (type === 'zoom') {
    ctx.drawImage(a, 0, 0, W, H);
    const s = 0.85 + 0.15 * e;
    ctx.globalAlpha = e;
    ctx.drawImage(b, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s);
  } else if (type === 'fade') {
    ctx.drawImage(a, 0, 0, W, H);
    ctx.globalAlpha = e;
    ctx.drawImage(b, 0, 0, W, H);
  } else {
    ctx.drawImage(t < 1 ? a : b, 0, 0, W, H);
  }
  ctx.restore();
}

/** Even dimensions ≤ maxW wide (H.264 needs even sizes). */
export function videoSize(w: number, h: number, maxW = 1080) {
  const s = Math.min(1, maxW / w);
  const even = (v: number) => Math.max(2, Math.round((v * s) / 2) * 2);
  return { width: even(w), height: even(h) };
}

export interface VideoResult { blob: Blob; ext: 'mp4' | 'webm'; codec: string; width: number; height: number; duration: number }

export async function canEncodeVideo(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  const { getFirstEncodableVideoCodec } = await import('mediabunny');
  return Boolean(await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8', 'av1'], { width: 1080, height: 1350 }));
}

export async function slidesToVideo(slides: Slide[], o: VideoOptions): Promise<VideoResult> {
  if (typeof VideoEncoder === 'undefined') throw new Error('Video export needs WebCodecs (Chrome, Edge, or Safari 17+). Export a GIF instead.');
  const mb = await import('mediabunny');
  const size = videoSize(o.width, o.height);
  const codec = await mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8', 'av1'], { width: size.width, height: size.height });
  if (!codec) throw new Error('No supported video encoder for this size in this browser. Export a GIF instead.');
  const mp4 = codec === 'avc' || codec === 'av1';
  const format = mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat();
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format, target });
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d')!;
  const source = new mb.CanvasSource(canvas, { codec, quality: mb.QUALITY_HIGH, keyFrameInterval: 2 });
  const fps = 30;
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const { segs, done: disposeFrames } = await clips(slides, o.width, o.height, size.width, o.hold);
  const trans = o.transition === 'none' || segs.length < 2 ? 0 : o.transitionDuration;
  const starts: number[] = [];
  let acc = 0;
  for (const c of segs) {
    starts.push(acc);
    acc += c.duration + trans;
  }
  const total = acc - trans;
  const totalFrames = Math.round(total * fps);
  let t = 0;
  for (let f = 0; f < totalFrames; f++) {
    if (o.signal?.aborted) {
      disposeFrames();
      await output.cancel();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    const time = f / fps;
    let i = segs.length - 1;
    while (i > 0 && time < starts[i]!) i--;
    const local = time - starts[i]!;
    const clip = segs[i]!;
    if (local < clip.duration || i === segs.length - 1) drawTransition(ctx, clip.at(local), clip.at(local), 1, 'none');
    else drawTransition(ctx, clip.at(clip.duration), segs[i + 1]!.at(0), (local - clip.duration) / trans, o.transition);
    await source.add(time, 1 / fps);
    t = time;
    if (f % 15 === 0) {
      o.onProgress?.(f / totalFrames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  disposeFrames();
  await output.finalize();
  o.onProgress?.(1);
  return { blob: new Blob([target.buffer!], { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', codec, ...size, duration: t };
}

export async function slidesToGif(slides: Slide[], o: VideoOptions & { maxWidth?: number; fps?: number }): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const size = videoSize(o.width, o.height, o.maxWidth ?? 540);
  const { segs, done: disposeFrames } = await clips(slides, o.width, o.height, size.width, o.hold);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const fps = o.fps ?? 12;
  const transFrames = o.transition === 'none' ? 0 : Math.max(2, Math.round(o.transitionDuration * fps));
  const introFrames = segs.map((c) => Math.round(c.intro * fps));
  const steps = segs.length + introFrames.reduce((a, b) => a + b, 0) + (segs.length - 1) * transFrames;
  let done = 0;
  const write = (delayMs: number) => {
    const { data } = ctx.getImageData(0, 0, size.width, size.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), size.width, size.height, { palette, delay: Math.round(delayMs) });
  };
  for (let i = 0; i < segs.length; i++) {
    if (o.signal?.aborted) {
      disposeFrames();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    const clip = segs[i]!;
    // Entrance animation frame by frame, then the finished slide held as one long frame (keeps GIFs small).
    for (let f = 0; f < introFrames[i]!; f++) {
      drawTransition(ctx, clip.at(f / fps), clip.at(f / fps), 1, 'none');
      write(1000 / fps);
      o.onProgress?.(++done / steps);
      await new Promise((r) => setTimeout(r, 0));
    }
    drawTransition(ctx, clip.at(clip.duration), clip.at(clip.duration), 1, 'none');
    write(o.hold * 1000);
    o.onProgress?.(++done / steps);
    if (i < segs.length - 1) {
      for (let f = 1; f <= transFrames; f++) {
        drawTransition(ctx, clip.at(clip.duration), segs[i + 1]!.at(0), f / (transFrames + 1), o.transition);
        write(1000 / fps);
        o.onProgress?.(++done / steps);
        await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
      }
    }
  }
  disposeFrames();
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}
