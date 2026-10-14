// Multi-script text with the design's own fonts. Canvas text uses a font *stack*: the design font first,
// then a per-category fallback family (cf-fb-serif, cf-fb-display, …) that holds bundled OFL fonts for
// Tamil, Devanagari, Arabic, Cyrillic and more, each limited to its script by unicode-range. Latin
// letters, digits and brand names keep the design font; other scripts get the closest-feeling font of
// the same category, at the same weight. Measurement and rendering share the stack, so layout matches.
import catalog from '@research/script-fonts.json';
import generated from './generated/scriptFonts.json';
import fontSubsets from './generated/fontSubsets.json';
import { findFont } from './index';

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export interface ScriptDef {
  id: string;
  label: string;
  subset: string;
  extraSubsets?: string[];
  langs: string[];
  rtl?: boolean;
  fonts: Record<Exclude<FontCategory, 'monospace'>, string>;
  /** Fonts the user may pick instead of matching each design (Settings → Fonts for other languages). */
  alternatives?: string[];
  note?: string;
}

export const scripts = catalog.scripts as ScriptDef[];

interface GeneratedFace { subset: string; file: string; weight: string }
const packages = generated.packages as Record<string, { family: string; license: string; faces: GeneratedFace[] }>;
const ranges: Record<string, string> = { ...generated.ranges, ...fontSubsets.ranges };
/** Extra (lazily loaded) subsets each bundled design font ships, e.g. cyrillic or vietnamese. */
export const extraSubsetsOf = (fontId: string): string[] => (fontSubsets.fonts as Record<string, string[]>)[fontId] ?? [];
export const unicodeRangeOf = (subset: string): string | undefined => ranges[subset];

const FALLBACK_CATEGORIES: Exclude<FontCategory, 'monospace'>[] = ['sans-serif', 'serif', 'display', 'handwriting'];

/** The font category a font id belongs to (system and uploaded fonts count as sans-serif). */
export function categoryOf(fontId: string): Exclude<FontCategory, 'monospace'> {
  const c = findFont(fontId)?.category;
  return c === 'serif' || c === 'display' || c === 'handwriting' ? c : 'sans-serif';
}

export const fallbackFamily = (category: Exclude<FontCategory, 'monospace'>) => `cf-fb-${category}`;

/** CSS font-family list for a primary family: design font, then the script fallback, then the generic. */
export function familyStack(primary: string, fontId: string): string {
  const cat = categoryOf(fontId);
  return `"${primary}", "${fallbackFamily(cat)}", ${cat === 'serif' ? 'serif' : 'sans-serif'}`;
}

// ---- unicode-range matching -------------------------------------------------------------------

type Span = [number, number];
const parsed = new Map<string, Span[]>();
export function parseRange(range: string): Span[] {
  let p = parsed.get(range);
  if (!p) {
    p = range.split(',').map((part) => {
      const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
      const lo = parseInt(a!, 16);
      return [lo, b ? parseInt(b, 16) : lo] as Span;
    });
    parsed.set(range, p);
  }
  return p;
}

const inSpans = (cp: number, spans: Span[]) => spans.some(([lo, hi]) => cp >= lo && cp <= hi);

const LATIN_MAX = 0x024f;
/** Non-Latin subsets (from the bundled fonts' unicode ranges) that the text needs. */
export function subsetsForText(text: string): Set<string> {
  const out = new Set<string>();
  const seen = new Set<number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= LATIN_MAX || seen.has(cp)) continue;
    seen.add(cp);
    for (const [subset, range] of Object.entries(ranges)) if (!out.has(subset) && inSpans(cp, parseRange(range))) out.add(subset);
  }
  return out;
}

/** The script a language code is written in (by our catalog), if it needs a fallback font. */
export function scriptForLang(lang: string): ScriptDef | undefined {
  const base = lang.toLowerCase().split(/[-_]/)[0]!;
  return scripts.find((s) => s.langs.includes(base));
}

const RTL_LANGS = new Set(['ar', 'fa', 'ur', 'ps', 'he', 'yi', 'ug', 'sd', 'dv']);
export const isRtlLang = (lang: string) => RTL_LANGS.has(lang.toLowerCase().split(/[-_]/)[0]!);

/** True if the first strong (letter) character is from a right-to-left script. */
export function isRtlText(text: string): boolean {
  const m = /\p{L}/u.exec(text);
  return Boolean(m && /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u.test(m[0]));
}

// ---- fallback face registration ---------------------------------------------------------------

const BASE = `${import.meta.env.BASE_URL}fonts`;
const fallbackFaces = new Map<string, FontFace[]>(); // subset → faces across categories
let registered = false;
const registeredFaces: FontFace[] = [];
/** Per-script font override (script id → package id); missing = match each design's category. */
let overrides: Record<string, string> = {};

export const familyLabel = (pkg: string) => packages[pkg]?.family ?? pkg;

/**
 * Uses one font for a script in every design (e.g. Mukta Malar for all Tamil text), or '' to match
 * each design's category again. Returns true if anything changed (callers re-measure text).
 */
export function setScriptFontOverrides(next: Record<string, string>): boolean {
  const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v));
  if (JSON.stringify(clean) === JSON.stringify(overrides)) return false;
  overrides = clean;
  if (registered && typeof document !== 'undefined' && 'fonts' in document) {
    registeredFaces.forEach((f) => document.fonts.delete(f));
    registeredFaces.length = 0;
    fallbackFaces.clear();
    registered = false;
  }
  return true;
}

/** Adds every fallback face to document.fonts (not loaded; ensureSubsets loads what text needs). */
export function registerScriptFallbacks(): void {
  if (registered || typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') return;
  registered = true;
  const seen = new Set<string>();
  for (const s of scripts) {
    for (const cat of FALLBACK_CATEGORIES) {
      const pkg = packages[overrides[s.id] || s.fonts[cat]];
      if (!pkg) continue;
      for (const face of pkg.faces) {
        if (![s.subset, ...(s.extraSubsets ?? [])].includes(face.subset)) continue;
        const key = `${cat}|${face.file}|${face.weight}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ff = new FontFace(fallbackFamily(cat), `url(${BASE}/${face.file}) format('woff2')`, {
          weight: face.weight,
          unicodeRange: ranges[face.subset],
          display: 'block',
        });
        document.fonts.add(ff);
        registeredFaces.push(ff);
        const list = fallbackFaces.get(face.subset) ?? [];
        list.push(ff);
        fallbackFaces.set(face.subset, list);
      }
    }
  }
}

/** Loads the fallback faces for the given subsets; resolves to how many were not loaded yet. */
export async function loadFallbackSubsets(subsets: Iterable<string>): Promise<number> {
  registerScriptFallbacks();
  const jobs: Promise<unknown>[] = [];
  for (const s of subsets) for (const f of fallbackFaces.get(s) ?? []) if (f.status !== 'loaded') jobs.push(f.load().catch((e) => console.warn('Script font failed to load', e)));
  await Promise.all(jobs);
  return jobs.length;
}

/** License/attribution lines for the bundled script fonts (shown in Settings → About). */
export const scriptFontCredits = () =>
  Object.values(packages)
    .map((p) => `${p.family} (${p.license})`)
    .filter((v, i, a) => a.indexOf(v) === i);
