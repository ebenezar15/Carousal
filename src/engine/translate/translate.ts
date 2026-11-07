// Translates a whole carousel project into another language while keeping its exact design: every
// element, color, font, effect and position stays; only text changes. Emphasis and rich-text styling
// travel with the words (tags.ts), text that grows is shrunk to fit its box, right-to-left languages
// mirror text alignment, and glyphs the design fonts lack come from bundled script fonts.
//
// Efficiency: identical strings are translated once, a translation memory answers repeats without any
// model call, and the rest goes out in a few batched requests on the provider's "quick task" model.
import { z } from 'zod';
import type { Project, TextElement, SlideElement, TextSpan } from '@/model/types';
import type { CarouselPlan } from '../schema';
import type { AIProvider } from '../types';
import { completeJson } from '../generate';
import { pickEmphasis } from '../text';
import { applyCase, emphasisFont, fitFontSize, isComplexScript, layoutElement, refitText } from '../layout/textLayout';
import { ensureSlideFonts } from '@/styles/slideFonts';
import { newId } from '@/model/id';
import { decodeTags, encodeTags, reconcile, stripTags, tagProblems, type Decoded } from './tags';
import { isRtl, languageLabel, nativeLabel } from './languages';
import { isRtlText } from '@/styles/scriptFonts';

// ---- collecting the text --------------------------------------------------------------------------

interface Field {
  /** Tagged source text. */
  source: string;
  spans?: TextSpan[];
  hadEmphasis: boolean;
  set(text: string, spans: TextSpan[], emphasis: string[]): void;
}

export interface Unit {
  id: string;
  /** Source with <em>/<sN> tags. */
  source: string;
  /** Source as the user sees it. */
  plain: string;
  /** Where it appears, for the review list ("Slide 3", "Caption"…). */
  where: string;
  /** How many places use this exact text. */
  uses: number;
}

const translatable = (s: string) => {
  const t = s.trim();
  return /\p{L}/u.test(t) && !/^[@#][\p{L}\p{N}_.]+$/u.test(t) && !/^(https?:\/\/|www\.)\S+$/i.test(t) && !/^\S+@\S+\.\S+$/.test(t);
};

/** Visits every translatable string of a project in a fixed order (used to collect and to apply). */
function visit(project: Project, cb: (f: Field, where: string) => void): void {
  const plainField = (get: () => string, put: (v: string) => void): Field => ({ source: encodeTags({ text: get() }), hadEmphasis: false, set: (t) => put(t) });
  const walk = (els: SlideElement[], where: string) => {
    for (const el of els) {
      if (el.kind === 'text') {
        if (!translatable(el.text)) continue;
        const words = el.emphasis?.words ?? [];
        cb(
          {
            source: encodeTags({ text: el.text, spans: el.spans, emphasis: words }),
            spans: el.spans,
            hadEmphasis: words.length > 0,
            set(text, spans, emphasis) {
              el.text = text;
              el.spans = spans.length ? spans : undefined;
              if (el.emphasis) el.emphasis = { ...el.emphasis, words: emphasis };
            },
          },
          where,
        );
      } else if (el.kind === 'table') {
        el.rows.forEach((row, r) => row.forEach((cell, c) => translatable(cell) && cb(plainField(() => el.rows[r]![c]!, (v) => (el.rows[r]![c] = v)), where)));
      } else if (el.kind === 'chart') {
        el.labels.forEach((l, i) => translatable(l) && cb(plainField(() => el.labels[i]!, (v) => (el.labels[i] = v)), where));
        el.series.forEach((s) => translatable(s.name) && cb(plainField(() => s.name, (v) => (s.name = v)), where));
      } else if (el.kind === 'group') walk(el.children, where);
    }
  };
  project.carousel.slides.forEach((s, i) => walk(s.elements, `Slide ${i + 1}`));

  const plan = project.plan as CarouselPlan | undefined;
  if (plan?.slides) {
    const field = (where: string, get: () => string, put: (v: string) => void) => translatable(get()) && cb(plainField(get, put), where);
    field('Title', () => plan.title, (v) => (plan.title = v));
    plan.slides.forEach((s, i) => {
      const where = `Slide ${i + 1}`;
      if (translatable(s.headline))
        cb(
          {
            source: encodeTags({ text: s.headline, emphasis: s.emphasis }),
            hadEmphasis: s.emphasis.length > 0,
            set(text, _spans, emphasis) {
              s.headline = text;
              s.emphasis = emphasis;
            },
          },
          where,
        );
      field(where, () => s.body, (v) => (s.body = v));
      s.bullets.forEach((_, j) => field(where, () => s.bullets[j]!, (v) => (s.bullets[j] = v)));
      if (s.stat) field(where, () => s.stat!.label, (v) => (s.stat!.label = v));
      if (s.quote) field(where, () => s.quote!.text, (v) => (s.quote!.text = v));
    });
    field('Caption', () => plan.caption, (v) => (plan.caption = v));
  }
  project.altText?.forEach((_, i) => translatable(project.altText![i]!) && cb(plainField(() => project.altText![i]!, (v) => (project.altText![i] = v)), `Alt text ${i + 1}`));
}

/** The unique strings to translate (deduplicated, in reading order). */
export function collectUnits(project: Project): Unit[] {
  const units = new Map<string, Unit>();
  visit(project, (f, where) => {
    const u = units.get(f.source);
    if (u) u.uses++;
    else units.set(f.source, { id: `t${units.size + 1}`, source: f.source, plain: stripTags(f.source), where, uses: 1 });
  });
  return [...units.values()];
}

// ---- translators ----------------------------------------------------------------------------------

export interface TranslateOptions {
  /** BCP-47 code of the source, if known. */
  sourceLang?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface Translator {
  id: string;
  label: string;
  /** Returns tagged translations by unit id; missing ids mean "not translated". */
  translate(units: Pick<Unit, 'id' | 'source'>[], target: string, opts: TranslateOptions): Promise<Map<string, string>>;
}

export const TRANSLATE_SYSTEM = `You translate the text of a social media carousel (slides, caption, alt text).
Return JSON {"items":[{"id":"…","text":"…"}]} containing every input id exactly once.

Rules:
- Translate naturally, the way a native social media writer in the target language would. Keep it concise: slide text must fit the same space, so prefer short words and phrasing of similar length to the source.
- Tags mark styled words: <em>…</em> and <s0>…</s0>, <s1>…</s1>, … Keep every tag exactly, placing each pair around the translated words that carry the same meaning. Never add, drop, rename or reorder-nest tags.
- Keep line breaks (\\n): the same number of lines, so list items stay list items.
- Do not translate @handles, #hashtags, URLs, email addresses, code, brand and product names, or people's names. Keep numbers, units, emoji and symbols.
- Keep the source's casing style where the target script has case (ALL CAPS stays caps).
- Keep the entities &amp; &lt; &gt; as written.
- Output only the translation: no notes, explanations or added quotation marks.`;

const TranslationSchema = z.object({ items: z.array(z.object({ id: z.string(), text: z.string() })) });

/** Splits units into requests of at most `maxChars` source characters. */
export function batchUnits<T extends { source: string }>(units: T[], maxChars: number): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const u of units) {
    if (cur.length && size + u.source.length > maxChars) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(u);
    size += u.source.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/**
 * Runs `fn` over items with at most `limit` in flight. A failure stops new work from starting (no more
 * credits spent) but keeps every result already finished; the first error is returned, not thrown.
 */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, signal?: AbortSignal): Promise<unknown> {
  let next = 0;
  let failure: unknown = null;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && failure === null && !signal?.aborted) {
      try {
        await fn(items[next++]!);
      } catch (e) {
        failure ??= e;
      }
    }
  }));
  return failure;
}

/** Translation through any AI provider (Claude, Ollama, OpenAI-compatible) as batched JSON requests. */
export function aiTranslator(provider: AIProvider): Translator {
  const local = provider.id === 'ollama' || provider.id === 'openai';
  return {
    id: provider.id,
    label: provider.label,
    async translate(units, target, opts) {
      const out = new Map<string, string>();
      // Small local models stay accurate on short requests; hosted models take bigger batches in parallel.
      const batches = batchUnits(units, local ? 1800 : 7000);
      let done = 0;
      opts.onProgress?.(0, units.length);
      const sourceLine = opts.sourceLang && opts.sourceLang !== 'auto' ? `Source language: ${languageLabel(opts.sourceLang)} (${opts.sourceLang}).` : 'Detect the source language.';
      const ask = async (items: Pick<Unit, 'id' | 'source'>[]) => {
        const { value } = await completeJson(
          provider,
          TRANSLATE_SYSTEM,
          { role: 'user', content: `Target language: ${languageLabel(target)} (${target}). ${sourceLine}\n\n${JSON.stringify({ items: items.map((u) => ({ id: u.id, text: u.source })) })}` },
          TranslationSchema,
          undefined,
          opts.signal,
          'fast',
        );
        const ids = new Set(items.map((u) => u.id));
        return new Map(value.items.filter((i) => ids.has(i.id) && i.text.trim()).map((i) => [i.id, i.text]));
      };
      const failure = await pool(batches, local ? 1 : 3, async (batch) => {
        const got = await ask(batch);
        // Only the lines that came back missing or with broken style tags are asked again (one small call),
        // instead of repeating the whole batch and the model's previous answer.
        const retry = batch.filter((u) => !got.has(u.id) || tagProblems(u.source, got.get(u.id)!));
        if (retry.length && !opts.signal?.aborted) {
          const again = await ask(retry).catch(() => new Map<string, string>());
          for (const u of retry) {
            const t = again.get(u.id);
            if (t && (!got.has(u.id) || !tagProblems(u.source, t))) got.set(u.id, t);
          }
        }
        got.forEach((t, id) => out.set(id, t));
        done += batch.length;
        opts.onProgress?.(done, units.length);
      }, opts.signal);
      if (opts.signal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');
      // Keep what finished; only fail outright when nothing came back at all.
      if (failure && out.size === 0) throw failure;
      return out;
    },
  };
}

interface BrowserTranslatorApi {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string; signal?: AbortSignal; monitor?: (m: EventTarget) => void }): Promise<{ translate(text: string, o?: { signal?: AbortSignal }): Promise<string>; destroy?(): void }>;
}
const browserApi = (): BrowserTranslatorApi | null => {
  const t = (globalThis as { Translator?: BrowserTranslatorApi }).Translator;
  return t && typeof t.create === 'function' ? t : null;
};

/** On-device translation built into recent Chrome/Edge (free, offline after a one-time language download). */
export const browserTranslator = {
  supported: () => browserApi() !== null,
  async available(source: string, target: string): Promise<boolean> {
    const api = browserApi();
    if (!api) return false;
    try {
      return (await api.availability({ sourceLanguage: source, targetLanguage: target })) !== 'unavailable';
    } catch {
      return false;
    }
  },
  create(): Translator {
    return {
      id: 'browser',
      label: 'On-device (browser)',
      async translate(units, target, opts) {
        const api = browserApi();
        if (!api) throw new Error('This browser has no built-in translator.');
        const sourceLanguage = opts.sourceLang && opts.sourceLang !== 'auto' ? opts.sourceLang : 'en';
        const t = await api.create({ sourceLanguage, targetLanguage: target, signal: opts.signal });
        const out = new Map<string, string>();
        let done = 0;
        for (const u of units) {
          // Styling tags don't survive this engine; translate line by line so list structure does.
          const lines = await Promise.all(stripTags(u.source).split('\n').map((l) => (l.trim() ? t.translate(l, { signal: opts.signal }) : Promise.resolve(l))));
          out.set(u.id, lines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
          opts.onProgress?.(++done, units.length);
        }
        t.destroy?.();
        return out;
      },
    };
  },
};

// ---- memory + orchestration ---------------------------------------------------------------------

export interface TranslationMemory {
  lookup(lang: string, sources: string[]): Promise<Map<string, string>>;
  store(lang: string, pairs: [string, string][]): Promise<void>;
  count?(): Promise<number>;
  clear?(): Promise<void>;
}

export interface UnitResult {
  /** Tagged translation (from memory or a translator); empty if it failed. */
  tagged: string;
  origin: 'memory' | 'translator' | 'failed' | 'manual';
}

export interface TranslateRun {
  results: Map<string, UnitResult>;
  fromMemory: number;
  translated: number;
  failed: number;
  error?: string;
}

/** Memory first, then the translator for whatever is left. Never throws for translator failures. */
export async function translateUnits(units: Unit[], target: string, translator: Translator | null, memory: TranslationMemory | null, opts: TranslateOptions = {}): Promise<TranslateRun> {
  const results = new Map<string, UnitResult>();
  const known = memory ? await memory.lookup(target, units.map((u) => u.source)) : new Map<string, string>();
  const todo: Unit[] = [];
  for (const u of units) {
    const hit = known.get(u.source);
    if (hit) results.set(u.id, { tagged: hit, origin: 'memory' });
    else todo.push(u);
  }
  const run: TranslateRun = { results, fromMemory: results.size, translated: 0, failed: 0 };
  if (!todo.length) return run;
  if (!translator) {
    todo.forEach((u) => results.set(u.id, { tagged: u.source, origin: 'manual' }));
    return run;
  }
  try {
    const got = await translator.translate(todo, target, opts);
    for (const u of todo) {
      const t = got.get(u.id);
      if (t?.trim()) {
        results.set(u.id, { tagged: t, origin: 'translator' });
        run.translated++;
      } else {
        results.set(u.id, { tagged: u.source, origin: 'failed' });
        run.failed++;
      }
    }
  } catch (e) {
    // SDKs name their abort errors differently: the signal is the reliable check.
    if (opts.signal?.aborted || (e as Error).name === 'AbortError') throw new DOMException('Translation cancelled', 'AbortError');
    run.error = (e as Error).message;
    for (const u of todo) if (!results.has(u.id)) {
      results.set(u.id, { tagged: u.source, origin: 'failed' });
      run.failed++;
    }
  }
  return run;
}

// ---- applying ---------------------------------------------------------------------------------------

/** Final text per unit after review: the tagged translation and the (possibly edited) plain text. */
export type Accepted = Map<string, { tagged: string; text: string }>;


/** Keeps a translated text box inside its original box: shrinks the font (to 55%) before growing the box. */
export function fitTranslated(el: TextElement): TextElement {
  let next = el;
  if (next.curve && isComplexScript(next.text)) next = { ...next, curve: undefined }; // arc text can't shape these scripts
  if (next.curve) return next;
  const l = layoutElement(next);
  if (l.height <= next.height + 0.5 && l.width <= next.width + 0.5) return next;
  if (next.autoFit) return refitText(next, next.fontSize);
  const r = fitFontSize(
    applyCase(next.text, next.textCase),
    { fontId: next.fontId, weight: next.fontWeight, italic: next.italic, letterSpacing: next.letterSpacing },
    { width: next.width, height: next.height },
    next.lineHeight,
    Math.max(8, Math.round(next.fontSize * 0.55)),
    next.fontSize,
    next.emphasis?.words,
    emphasisFont(next.fontId, next.emphasis),
    { spans: next.spans, listStyle: next.listStyle, underline: next.underline },
  );
  if (r.fits) return { ...next, fontSize: r.size };
  return { ...next, fontSize: r.size, height: Math.ceil(r.layout.height) };
}

function mapText(els: SlideElement[], fn: (el: TextElement) => TextElement): SlideElement[] {
  return els.map((el) => (el.kind === 'text' ? fn(el) : el.kind === 'group' ? { ...el, children: mapText(el.children, fn) } : el));
}

/**
 * Builds the translated copy: a new project with the same design and translated text. `accepted`
 * holds, per unit id, the tagged translation and the final plain text (equal to the stripped tagged
 * text unless the user edited it during review).
 */
export async function applyTranslation(project: Project, units: Unit[], accepted: Accepted, target: string, engine: string): Promise<Project> {
  const bysource = new Map(units.map((u) => [u.source, u]));
  const copy: Project = structuredClone(project);
  visit(copy, (f) => {
    const u = bysource.get(f.source);
    const a = u && accepted.get(u.id);
    if (!a) return;
    const decoded: Decoded = decodeTags(a.tagged, f.spans);
    let { spans, emphasis } = decoded;
    if (a.text !== decoded.text) ({ spans, emphasis } = reconcile(a.text, decoded));
    // Emphasis that didn't survive (tags lost, or text edited) is re-picked so the design keeps its accent.
    if (f.hadEmphasis && !emphasis.length) emphasis = pickEmphasis(a.text, 1);
    f.set(a.text, spans, emphasis);
  });

  const rtl = isRtl(target);
  await ensureSlideFonts(copy.carousel.slides);
  copy.carousel.slides = copy.carousel.slides.map((s) => ({
    ...s,
    elements: mapText(s.elements, (el) => {
      // Only boxes that now hold right-to-left words flip; counters like "01 / 09" stay where they were.
      const flipped: TextElement = rtl && el.align !== 'center' && isRtlText(el.text) ? { ...el, align: el.align === 'left' ? 'right' : 'left' } : el;
      return fitTranslated(flipped);
    }),
  }));
  const plan = copy.plan as CarouselPlan | undefined;
  if (plan) plan.language = target;
  const now = Date.now();
  return {
    ...copy,
    id: newId('proj_'),
    carousel: { ...copy.carousel, id: newId('car_') },
    name: `${project.name} · ${nativeLabel(target)}`,
    createdAt: now,
    updatedAt: now,
    thumbnail: undefined,
    settings: copy.settings ? { ...copy.settings, language: target } : copy.settings,
    translation: { fromId: project.id, fromName: project.name, lang: target, engine },
  };
}

/** Memory entries for what the user accepted (edited text is stored as-is, without tags). */
export function memoryPairs(units: Unit[], accepted: Accepted): [string, string][] {
  const out: [string, string][] = [];
  for (const u of units) {
    const a = accepted.get(u.id);
    // Untranslated text (a failed batch accepted as-is) must not be remembered as a translation.
    if (!a || !a.text.trim() || a.text === u.plain) continue;
    const plain = stripTags(a.tagged);
    out.push([u.source, a.text === plain ? a.tagged : a.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')]);
  }
  return out;
}
