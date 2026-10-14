// Image loading + caching shared by the editor, thumbnails and export. `asset:<id>` sources resolve
// to object URLs from the IndexedDB assets table. Exports call preloadImages() first so the offscreen
// render can draw synchronously.
import { useSyncExternalStore } from 'react';
import { db } from '@/storage/db';
import type { Slide, SlideElement } from '@/model/types';

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();
const listeners = new Set<() => void>();
const objectUrls = new Map<string, string>();
let version = 0;

const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export async function resolveSrc(src: string): Promise<string> {
  if (!src.startsWith('asset:')) return src;
  const id = src.slice(6);
  const existing = objectUrls.get(id);
  if (existing) return existing;
  const rec = await db.assets.get(id);
  if (!rec) throw new Error(`Missing asset ${id}`);
  const url = URL.createObjectURL(rec.blob);
  objectUrls.set(id, url);
  return url;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = images.get(src);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(src);
  if (!p) {
    p = resolveSrc(src).then(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          if (/^https?:/.test(url)) img.crossOrigin = 'anonymous'; // keeps the canvas exportable
          img.onload = () => {
            images.set(src, img);
            pending.delete(src);
            notify();
            resolve(img);
          };
          img.onerror = () => {
            pending.delete(src);
            reject(new Error(`Could not load image ${src.slice(0, 60)}`));
          };
          img.src = url;
        }),
    );
    pending.set(src, p);
  }
  return p;
}

export const cachedImage = (src: string) => images.get(src);

/** Returns the loaded image (re-rendering when it arrives), starting the load if needed. */
export function useImage(src: string | undefined): HTMLImageElement | undefined {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  if (!src) return undefined;
  const img = images.get(src);
  if (!img && !pending.has(src)) void loadImage(src).catch(() => undefined);
  return img;
}

function collect(els: SlideElement[], out: Set<string>) {
  for (const e of els) {
    if (e.kind === 'image' && e.src) out.add(e.src);
    if (e.kind === 'group') collect(e.children, out);
  }
}

export function slideImageSources(slides: Slide[]): string[] {
  const out = new Set<string>();
  for (const s of slides) {
    collect(s.elements, out);
    if (s.background.type === 'image' && s.background.src) out.add(s.background.src);
  }
  return [...out];
}

/** Loads every image the slides use; failures are ignored (the renderer shows a placeholder). */
export async function preloadImages(slides: Slide[]): Promise<void> {
  await Promise.all(slideImageSources(slides).map((s) => loadImage(s).catch(() => undefined)));
}
