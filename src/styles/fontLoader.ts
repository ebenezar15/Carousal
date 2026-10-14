// Registers bundled woff2 fonts (assets/fonts → served at /fonts) with the FontFace API.
// Canvas (Konva) text only uses a font once it is loaded, so renderers await ensureFonts() first.
import { findFont } from './index';
import { db } from '@/storage/db';

const loaded = new Map<string, Promise<void>>();
const BASE = `${import.meta.env.BASE_URL}fonts`;

/**
 * Font ids: bundled `inter`, installed `system:Arial`, uploaded `custom:<assetId>`.
 * Bundled/custom families are namespaced to avoid clashing with system fonts.
 */
export const cssFamily = (fontId: string) =>
  fontId.startsWith('system:') ? fontId.slice(7) : fontId.startsWith('custom:') ? `cf-custom-${fontId.slice(7)}` : `cf-${fontId}`;

const customLoaded = new Map<string, Promise<void>>();

function loadCustom(fontId: string): Promise<void> {
  let p = customLoaded.get(fontId);
  if (!p) {
    p = (async () => {
      const rec = await db.assets.get(fontId.slice(7));
      if (!rec) throw new Error(`Custom font missing: ${fontId}`);
      const face = new FontFace(cssFamily(fontId), await rec.blob.arrayBuffer());
      await face.load();
      document.fonts.add(face);
    })().catch((e) => {
      customLoaded.delete(fontId);
      console.warn(e);
    });
    customLoaded.set(fontId, p);
  }
  return p;
}

function loadFace(fontId: string, weight: number, style: 'normal' | 'italic'): Promise<void> {
  const key = `${fontId}:${weight}:${style}`;
  let p = loaded.get(key);
  if (!p) {
    const def = findFont(fontId);
    if (!def) return Promise.resolve();
    // latin + latin-ext as separate faces with unicode ranges so the browser only fetches what it needs.
    const faces = def.subsets.map(
      (subset) =>
        new FontFace(cssFamily(fontId), `url(${BASE}/${fontId}/${subset}-${weight}-${style}.woff2) format('woff2')`, {
          weight: String(weight),
          style,
          unicodeRange: subset === 'latin' ? LATIN : LATIN_EXT,
        }),
    );
    p = Promise.all(
      faces.map(async (face) => {
        document.fonts.add(face);
        await face.load();
      }),
    ).then(
      () => undefined,
      (err) => {
        loaded.delete(key);
        console.warn(`Font failed to load: ${key}`, err);
      },
    );
    loaded.set(key, p);
  }
  return p;
}

/** Loads every bundled weight (and italic) of the given fonts. Unknown ids are ignored. */
export async function ensureFonts(fontIds: Iterable<string>): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const id of new Set(fontIds)) {
    if (id.startsWith('custom:')) {
      jobs.push(loadCustom(id));
      continue;
    }
    const def = findFont(id);
    if (!def) continue;
    def.weights.forEach((w) => jobs.push(loadFace(id, w, 'normal')));
    def.italics.forEach((w) => jobs.push(loadFace(id, w, 'italic')));
  }
  await Promise.all(jobs);
}

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
