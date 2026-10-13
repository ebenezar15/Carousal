// Slideshow video export: MP4/WebM via WebCodecs (Mediabunny) and animated GIF (gifenc).
// Slides hold for `hold` seconds, then transition to the next over `transition` seconds.
import type { Slide } from '@/model/types';
import { renderSlideToCanvas } from './render';
import { prepareSlides } from './images';

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

/** Renders slides at the video size (downscaled when needed so encoders accept it). */
async function frames(slides: Slide[], w: number, h: number, outW: number): Promise<HTMLCanvasElement[]> {
  await prepareSlides(slides);
  return slides.map((s) => {
    const src = renderSlideToCanvas(s, w, h, outW / w);
    return src;
  });
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

  const imgs = await frames(slides, o.width, o.height, size.width);
  const trans = o.transition === 'none' ? 0 : o.transitionDuration;
  const total = imgs.length * o.hold + (imgs.length - 1) * trans;
  const totalFrames = Math.round(total * fps);
  let t = 0;
  for (let f = 0; f < totalFrames; f++) {
    if (o.signal?.aborted) {
      await output.cancel();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    const time = f / fps;
    // Which segment are we in?
    const seg = o.hold + trans;
    const i = Math.min(imgs.length - 1, Math.floor(time / seg));
    const local = time - i * seg;
    if (local < o.hold || i === imgs.length - 1) drawTransition(ctx, imgs[i]!, imgs[i]!, 1, 'none');
    else drawTransition(ctx, imgs[i]!, imgs[i + 1]!, (local - o.hold) / trans, o.transition);
    await source.add(time, 1 / fps);
    t = time;
    if (f % 15 === 0) o.onProgress?.(f / totalFrames);
  }
  await output.finalize();
  o.onProgress?.(1);
  return { blob: new Blob([target.buffer!], { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', codec, ...size, duration: t };
}

export async function slidesToGif(slides: Slide[], o: VideoOptions & { maxWidth?: number; fps?: number }): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const size = videoSize(o.width, o.height, o.maxWidth ?? 540);
  const imgs = await frames(slides, o.width, o.height, size.width);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const fps = o.fps ?? 12;
  const transFrames = o.transition === 'none' ? 0 : Math.max(2, Math.round(o.transitionDuration * fps));
  const steps = imgs.length + (imgs.length - 1) * transFrames;
  let done = 0;
  const write = (delayMs: number) => {
    const { data } = ctx.getImageData(0, 0, size.width, size.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), size.width, size.height, { palette, delay: Math.round(delayMs) });
  };
  for (let i = 0; i < imgs.length; i++) {
    if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    drawTransition(ctx, imgs[i]!, imgs[i]!, 1, 'none');
    write(o.hold * 1000); // one frame held for the whole duration keeps GIFs small
    o.onProgress?.(++done / steps);
    if (i < imgs.length - 1) {
      for (let f = 1; f <= transFrames; f++) {
        drawTransition(ctx, imgs[i]!, imgs[i + 1]!, f / (transFrames + 1), o.transition);
        write(1000 / fps);
        o.onProgress?.(++done / steps);
        await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
      }
    }
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}
