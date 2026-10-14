// Fonts the editor can offer: bundled (OFL/Apache), installed on this machine, and user uploads.
import { db } from '@/storage/db';
import { newId } from '@/model/id';
import { fonts, fontGroups } from './index';
import { ensureFonts } from './fontLoader';

export interface FontChoice { id: string; label: string; group: string }

const COMMON_SYSTEM = [
  'Arial', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria', 'Candara', 'Georgia',
  'Times New Roman', 'Garamond', 'Palatino', 'Book Antiqua', 'Courier New', 'Consolas', 'Menlo', 'Monaco', 'SF Pro Display', 'SF Pro Text',
  'Avenir', 'Avenir Next', 'Futura', 'Gill Sans', 'Optima', 'Baskerville', 'Didot', 'Rockwell', 'Impact', 'Franklin Gothic Medium',
  'Century Gothic', 'Lucida Grande', 'Ubuntu', 'Cantarell', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Liberation Serif', 'Noto Sans', 'Noto Serif', 'Roboto',
];

/** Detects installed fonts by comparing glyph widths against generic fallbacks (no permission prompt). */
export function detectSystemFonts(candidates = COMMON_SYSTEM): string[] {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [];
  const sample = 'mmmmmmmmmmlli1WQ@#';
  const width = (font: string) => ((c.font = `48px ${font}`), c.measureText(sample).width);
  const bases = ['monospace', 'serif', 'sans-serif'].map((b) => [b, width(b)] as const);
  return candidates.filter((name) => bases.some(([b, w]) => Math.abs(width(`"${name}", ${b}`) - w) > 0.5));
}

/** Chromium's Local Font Access API (asks permission); falls back to detection. */
export async function querySystemFonts(): Promise<string[]> {
  const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
  if (q) {
    try {
      const list = await q();
      return [...new Set(list.map((f) => f.family))].sort();
    } catch {
      /* permission denied → fall back */
    }
  }
  return detectSystemFonts();
}

export async function customFonts(): Promise<FontChoice[]> {
  const all = await db.assets.toArray();
  return all.filter((a) => isFontAsset(a.mime, a.name)).map((a) => ({ id: `custom:${a.id}`, label: a.name.replace(/\.(ttf|otf|woff2?)$/i, ''), group: 'Uploaded' }));
}

export const isFontAsset = (mime: string, name: string) => mime.startsWith('font/') || /\.(ttf|otf|woff2?)$/i.test(name);

export const FONT_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

/** Stores an uploaded font file and registers it; returns its font id. */
export async function addCustomFont(file: File): Promise<string> {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('Upload a .ttf, .otf, .woff or .woff2 font file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Font files must be under 15 MB.');
  const id = newId('font_');
  const ext = file.name.split('.').pop()!.toLowerCase();
  await db.assets.put({ id, name: file.name, mime: file.type || `font/${ext}`, blob: file, createdAt: Date.now() });
  const fontId = `custom:${id}`;
  await ensureFonts([fontId]);
  return fontId;
}

export function bundledChoices(): FontChoice[] {
  const label = new Map(fontGroups.map((g) => [g.id, g.label]));
  return fonts.map((f) => ({ id: f.id, label: f.family, group: label.get(f.group) ?? f.group }));
}

export function fontLabel(id: string): string {
  if (id.startsWith('system:')) return id.slice(7);
  if (id.startsWith('custom:')) return 'Uploaded font';
  return fonts.find((f) => f.id === id)?.family ?? id;
}

/** Weights to offer for a font: bundled weights, or the standard set for system/custom fonts. */
export function weightsFor(id: string): number[] {
  const f = fonts.find((x) => x.id === id);
  return f ? f.weights : [300, 400, 500, 600, 700, 800, 900];
}
