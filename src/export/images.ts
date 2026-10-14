// Slide → image file (PNG/JPG/WebP at 1×/2×), file naming and output verification.
import type { Slide } from '@/model/types';
import type { PlatformPreset } from '@/styles';
import { preloadImages } from '@/editor/render/images';
import { renderSlideToCanvas } from './render';
import { ensureSlideFonts } from '@/editor/render/fonts';

export type ImageFormat = 'png' | 'jpg' | 'webp';
export const MIME: Record<ImageFormat, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export interface ImageOptions { format: ImageFormat; scale: 1 | 2; quality: number }

export const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'carousel';

/** `project_01.png`, `project_02.png`, … */
export const slideFileName = (project: string, index: number, ext: string) => `${slug(project)}_${String(index + 1).padStart(2, '0')}.${ext}`;

let webp: boolean | null = null;
/** Safari/WebKit can decode WebP but not always encode it from canvas. */
export function webpEncodeSupported(): boolean {
  if (webp === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      webp = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webp = false;
    }
  }
  return webp;
}

export async function prepareSlides(slides: Slide[]): Promise<void> {
  await Promise.all([ensureSlideFonts(slides), preloadImages(slides)]);
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), mime, quality));
}

/** JPEG has no alpha: flatten onto white so transparent areas don't turn black. */
function flatten(c: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = c.width;
  out.height = c.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0);
  return out;
}

export async function slideToBlob(slide: Slide, preset: Pick<PlatformPreset, 'width' | 'height'>, opts: ImageOptions): Promise<Blob> {
  await prepareSlides([slide]);
  if (opts.format === 'webp' && !webpEncodeSupported()) throw new Error('This browser cannot encode WebP. Choose PNG or JPG.');
  let canvas = renderSlideToCanvas(slide, preset.width, preset.height, opts.scale);
  if (opts.format === 'jpg') canvas = flatten(canvas);
  return canvasToBlob(canvas, MIME[opts.format], opts.format === 'png' ? undefined : opts.quality);
}

/** Decodes an image blob to read its real pixel size (used to verify exports). */
export async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(blob);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

export interface Verified {
  name: string;
  blob: Blob;
  expected: { width: number; height: number };
  actual?: { width: number; height: number };
  sizeOk: boolean;
  dimsOk: boolean;
}

export async function verifyImage(name: string, blob: Blob, expected: { width: number; height: number }, maxMB?: number): Promise<Verified> {
  const actual = await imageSize(blob);
  return { name, blob, expected, actual, dimsOk: actual.width === expected.width && actual.height === expected.height, sizeOk: !maxMB || blob.size <= maxMB * 1024 * 1024 };
}
