// `.carousel` project files: a ZIP holding project.json plus every embedded asset (images, uploaded
// fonts, logos), so a project opens on another machine — offline — exactly as it was.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { Carousel, Project, Slide, SlideElement } from '@/model/types';
import { db } from '@/storage/db';
import { newId } from '@/model/id';

export const PROJECT_EXT = 'carousel';
export const FORMAT = 'carouselforge.project';
export const VERSION = 1;

const Manifest = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  app: z.string(),
  project: z.object({ id: z.string(), name: z.string(), carousel: z.object({ presetId: z.string(), slides: z.array(z.unknown()), theme: z.object({ styleId: z.string() }).passthrough() }).passthrough() }).passthrough(),
  assets: z.array(z.object({ id: z.string(), name: z.string(), mime: z.string(), path: z.string() })),
});

/** Asset ids referenced by a carousel (images, background images, watermark logo, uploaded fonts). */
export function referencedAssets(c: Carousel): string[] {
  const ids = new Set<string>();
  const src = (s?: string) => s?.startsWith('asset:') && ids.add(s.slice(6));
  const font = (f?: string) => f?.startsWith('custom:') && ids.add(f.slice(7));
  const walk = (els: SlideElement[]) =>
    els.forEach((e) => {
      if (e.kind === 'image') src(e.src);
      if (e.kind === 'text') {
        font(e.fontId);
        e.spans?.forEach((s) => font(s.fontId));
      }
      if (e.kind === 'chart' || e.kind === 'table') font(e.fontId);
      if (e.kind === 'group') walk(e.children);
    });
  c.slides.forEach((s: Slide) => {
    walk(s.elements);
    if (s.background.type === 'image') src(s.background.src);
  });
  src(c.theme.watermark?.logoSrc);
  font(c.theme.headingFont);
  font(c.theme.bodyFont);
  return [...ids];
}

export async function exportProjectFile(project: Project): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const assets: z.infer<typeof Manifest>['assets'] = [];
  for (const id of referencedAssets(project.carousel)) {
    const rec = await db.assets.get(id);
    if (!rec) continue; // missing assets render as placeholders; don't fail the export
    const path = `assets/${id}`;
    files[path] = new Uint8Array(await rec.blob.arrayBuffer());
    assets.push({ id, name: rec.name, mime: rec.mime, path });
  }
  const { thumbnail: _t, ...rest } = project;
  void _t;
  const manifest = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), app: 'CarouselForge', project: rest, assets };
  files['project.json'] = strToU8(JSON.stringify(manifest));
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith('.json') ? 6 : 1 }]])) as never);
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export class ProjectFileError extends Error {}

/** Reads a .carousel file: restores assets and returns a project ready to save (new id if it already exists). */
export async function importProjectFile(file: Blob): Promise<Project> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new ProjectFileError('This is not a CarouselForge project file (could not unzip it).');
  }
  const raw = entries['project.json'];
  if (!raw) throw new ProjectFileError('The project file is missing project.json.');
  let parsed: z.infer<typeof Manifest>;
  try {
    parsed = Manifest.parse(JSON.parse(strFromU8(raw)));
  } catch (e) {
    throw new ProjectFileError(`The project file is damaged or from an unsupported version: ${(e as Error).message.slice(0, 200)}`);
  }
  if (parsed.version > VERSION) throw new ProjectFileError(`This file was made with a newer CarouselForge (format v${parsed.version}). Please update the app.`);
  for (const a of parsed.assets) {
    const bytes = entries[a.path];
    if (!bytes) continue;
    if (!(await db.assets.get(a.id))) await db.assets.put({ id: a.id, name: a.name, mime: a.mime, blob: new Blob([bytes as BlobPart], { type: a.mime }), createdAt: Date.now() });
  }
  const project = parsed.project as unknown as Project;
  const exists = await db.projects.get(project.id);
  return {
    ...project,
    id: exists ? newId('prj_') : project.id,
    name: exists ? `${project.name} (imported)` : project.name,
    updatedAt: Date.now(),
  };
}
