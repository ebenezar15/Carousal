import { describe, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { db } from '@/storage/db';
import type { ImageElement, Project, TextElement } from '@/model/types';
import { exportProjectFile, importProjectFile, referencedAssets, ProjectFileError } from '@/export/projectFile';
import { slideFileName, slug } from '@/export/images';
import { videoSize } from '@/export/video';
import { zipFiles } from '@/export/archive';
import { ARTICLE } from './fixtures';

async function blobToBytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

function project(): Project {
  const plan = planFromText(ARTICLE, defaultOptions);
  const carousel = buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('minimal-swiss') });
  const img: ImageElement = { id: 'el_img', kind: 'image', src: 'asset:img_1', fit: 'cover', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
  const t = carousel.slides[0]!.elements.find((e) => e.kind === 'text') as TextElement;
  carousel.slides[0]!.elements.push(img, { ...t, id: 'el_t2', fontId: 'custom:font_1' });
  carousel.slides[1]!.background = { type: 'image', src: 'asset:img_2', color: '#000000' };
  return { id: 'prj_test', name: 'My Carousel!', createdAt: 1, updatedAt: 1, plan, carousel };
}

describe('naming', () => {
  it('produces project_01.png style names', () => {
    expect(slug('My Carousel!')).toBe('my-carousel');
    expect(slideFileName('My Carousel!', 0, 'png')).toBe('my-carousel_01.png');
    expect(slideFileName('x', 11, 'jpg')).toBe('x_12.jpg');
  });
  it('video sizes are even and capped', () => {
    expect(videoSize(1080, 1350)).toEqual({ width: 1080, height: 1350 });
    expect(videoSize(1920, 1080)).toEqual({ width: 1080, height: 608 });
    expect(videoSize(1000, 1500, 540)).toEqual({ width: 540, height: 810 });
  });
});

describe('zip', () => {
  it('stores files under their names', async () => {
    const z = await zipFiles([{ name: 'a_01.png', blob: new Blob([new Uint8Array([1, 2, 3])]) }, { name: 'caption.txt', blob: new Blob(['hi']) }]);
    const files = unzipSync(await blobToBytes(z));
    expect(Object.keys(files).sort()).toEqual(['a_01.png', 'caption.txt']);
    expect([...files['a_01.png']!]).toEqual([1, 2, 3]);
  });
});

describe('.carousel project files', () => {
  it('collects referenced assets (images, backgrounds, uploaded fonts)', () => {
    expect(referencedAssets(project().carousel).sort()).toEqual(['font_1', 'img_1', 'img_2']);
  });

  it('round-trips a project with embedded assets', async () => {
    // fake-indexeddb doesn't preserve Blobs under jsdom (browsers do), so back the asset table with a Map.
    type Rec = { id: string; name: string; mime: string; blob: Blob; createdAt: number };
    const store = new Map<string, Rec>();
    vi.spyOn(db.assets, 'get').mockImplementation((async (id: string) => store.get(id)) as never);
    vi.spyOn(db.assets, 'put').mockImplementation((async (r: Rec) => (store.set(r.id, r), r.id)) as never);
    for (const r of [
      { id: 'img_1', name: 'a.png', mime: 'image/png', blob: new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' }), createdAt: 1 },
      { id: 'img_2', name: 'b.jpg', mime: 'image/jpeg', blob: new Blob([new Uint8Array([7])], { type: 'image/jpeg' }), createdAt: 1 },
      { id: 'font_1', name: 'Brand.ttf', mime: 'font/ttf', blob: new Blob([new Uint8Array([1, 2])]), createdAt: 1 },
    ])
      store.set(r.id, r);
    const p = project();
    const file = await exportProjectFile(p);
    const entries = unzipSync(await blobToBytes(file));
    const manifest = JSON.parse(strFromU8(entries['project.json']!));
    expect(manifest.format).toBe('carouselforge.project');
    expect(manifest.assets).toHaveLength(3);
    expect(entries['assets/img_1']).toBeDefined();

    // Simulate another machine: empty asset store, existing project id → new id.
    store.clear();
    await db.projects.put(p);
    const imported = await importProjectFile(file);
    expect(imported.id).not.toBe(p.id);
    expect(imported.name).toContain('(imported)');
    expect(imported.carousel.slides).toHaveLength(p.carousel.slides.length);
    const restored = await db.assets.get('img_1');
    expect(new Uint8Array(await restored!.blob.arrayBuffer())).toEqual(new Uint8Array([9, 9, 9]));
  });

  it('rejects files that are not projects', async () => {
    await expect(importProjectFile(new Blob(['nope']))).rejects.toBeInstanceOf(ProjectFileError);
    const bad = await zipFiles([{ name: 'project.json', blob: new Blob(['{"format":"other"}']) }]);
    await expect(importProjectFile(bad)).rejects.toThrow(/damaged or from an unsupported version/);
  });
});
