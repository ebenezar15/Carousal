// Storing user images in IndexedDB and creating image elements sized to fit the slide.
import { db } from '@/storage/db';
import { newId } from '@/model/id';
import type { ImageElement } from '@/model/types';
import { loadImage } from './render/images';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

export async function storeImage(blob: Blob, name = 'image'): Promise<string> {
  if (!blob.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Images must be under 30 MB.');
  const id = newId('img_');
  await db.assets.put({ id, name, mime: blob.type, blob, createdAt: Date.now() });
  return `asset:${id}`;
}

export async function assetBlob(src: string): Promise<Blob> {
  if (src.startsWith('asset:')) {
    const rec = await db.assets.get(src.slice(6));
    if (!rec) throw new Error('Image not found.');
    return rec.blob;
  }
  const res = await fetch(src);
  return res.blob();
}

/** An image element fitted inside `max` (default: 70% of the slide), centered. */
export async function imageElement(src: string, canvas: { width: number; height: number }, extra: Partial<ImageElement> = {}): Promise<ImageElement> {
  const img = await loadImage(src);
  const maxW = canvas.width * 0.7;
  const maxH = canvas.height * 0.6;
  const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1.5);
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  return { id: newId('el_'), kind: 'image', name: 'Image', src, fit: 'cover', x: Math.round((canvas.width - w) / 2), y: Math.round((canvas.height - h) / 2), width: w, height: h, rotation: 0, opacity: 1, ...extra };
}
