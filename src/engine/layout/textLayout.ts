// Text measurement + line breaking used by BOTH the layout engine and the Konva renderer, so what
// the engine measures is exactly what gets drawn (no overflow surprises). Supports per-word
// emphasis runs, which Konva's built-in Text node cannot do.
import { cssFamily } from '@/styles/fontLoader';
import { nearestWeight } from '@/styles';
import type { TextEmphasis } from '@/model/types';

export interface FontSpec {
  fontId: string;
  size: number;
  weight: number;
  italic: boolean;
  letterSpacing: number;
}

export interface Run { text: string; x: number; width: number; emphasized: boolean }
export interface Line { runs: Run[]; width: number; y: number }
export interface TextLayout { lines: Line[]; height: number; width: number; lineHeightPx: number }

let ctx: CanvasRenderingContext2D | null | undefined;
function context(): CanvasRenderingContext2D | null {
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export const fontString = (f: Pick<FontSpec, 'fontId' | 'size' | 'weight' | 'italic'>) =>
  `${f.italic ? 'italic ' : ''}${f.weight} ${f.size}px "${cssFamily(f.fontId)}", sans-serif`;

export function measure(text: string, f: FontSpec): number {
  const c = context();
  // jsdom / non-browser fallback: average glyph ≈ 0.55em (keeps unit tests deterministic).
  const base = c ? ((c.font = fontString(f)), c.measureText(text).width) : text.length * f.size * 0.55;
  return base + f.letterSpacing * text.length;
}

export function applyCase(text: string, c: 'none' | 'upper' | 'lower' | 'title'): string {
  if (c === 'upper') return text.toUpperCase();
  if (c === 'lower') return text.toLowerCase();
  if (c === 'title') return text.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
  return text;
}

/** Font overrides for emphasized words, so measurement matches what the renderer draws. */
export type EmphasisFont = Partial<Pick<FontSpec, 'italic' | 'weight'>>;

export function emphasisFont(fontId: string, em: Pick<TextEmphasis, 'style'> | undefined): EmphasisFont {
  if (em?.style === 'italic') return { italic: true };
  if (em?.style === 'bold') return { weight: nearestWeight(fontId, 800) };
  return {};
}

const norm = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '');

/**
 * Greedy line breaking (respects explicit \n), then groups consecutive words with the same
 * emphasis state into runs with x offsets. Words longer than the box are split by character.
 */
export function layoutText(
  text: string,
  f: FontSpec,
  maxWidth: number,
  lineHeight: number,
  emphasisWords: string[] = [],
  emFont: EmphasisFont = {},
): TextLayout {
  const emph = new Set(emphasisWords.flatMap((w) => w.split(/\s+/)).map(norm).filter(Boolean));
  const ef: FontSpec = { ...f, ...emFont };
  const space = measure(' ', f);
  const lineHeightPx = f.size * lineHeight;
  const lines: Line[] = [];

  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const tokens = para.split(/\s+/).filter(Boolean);
    let current: { word: string; w: number; e: boolean }[] = [];
    let width = 0;
    const push = () => {
      lines.push(toLine(current, space, lines.length * lineHeightPx));
      current = [];
      width = 0;
    };
    if (tokens.length === 0) { push(); continue; }
    for (const tok of tokens) {
      let word = tok;
      const e = emph.has(norm(word));
      const wf = e ? ef : f;
      let w = measure(word, wf);
      while (w > maxWidth && word.length > 1) {
        // Hard-break an over-long word.
        let i = word.length - 1;
        while (i > 1 && measure(word.slice(0, i), wf) > maxWidth) i--;
        if (current.length) push();
        current.push({ word: word.slice(0, i), w: measure(word.slice(0, i), wf), e });
        push();
        word = word.slice(i);
        w = measure(word, wf);
      }
      const add = current.length ? space + w : w;
      if (current.length && width + add > maxWidth) push();
      width += current.length ? space + w : w;
      current.push({ word, w, e });
    }
    if (current.length) push();
  }
  const width = lines.reduce((m, l) => Math.max(m, l.width), 0);
  return { lines, height: lines.length * lineHeightPx, width, lineHeightPx };
}

function toLine(words: { word: string; w: number; e: boolean }[], space: number, y: number): Line {
  const runs: Run[] = [];
  let x = 0;
  for (const [i, wd] of words.entries()) {
    const last = runs[runs.length - 1];
    if (last && last.emphasized === wd.e) {
      last.text += ' ' + wd.word;
      last.width += space + wd.w;
    } else {
      // The space before a new run belongs to the gap, not either run (keeps highlights tight).
      runs.push({ text: wd.word, x: i === 0 ? 0 : x + space, width: wd.w, emphasized: wd.e });
    }
    x += (i === 0 ? 0 : space) + wd.w;
  }
  return { runs, width: x, y };
}

/** Largest font size in [min, max] whose wrapped text fits the box (binary search). */
export function fitFontSize(
  text: string,
  f: Omit<FontSpec, 'size'>,
  box: { width: number; height: number },
  lineHeight: number,
  min: number,
  max: number,
  emphasis: string[] = [],
  emFont: EmphasisFont = {},
): { size: number; layout: TextLayout; fits: boolean } {
  let lo = Math.floor(min);
  let hi = Math.ceil(max);
  let best: { size: number; layout: TextLayout } | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const layout = layoutText(text, { ...f, size: mid }, box.width, lineHeight, emphasis, emFont);
    if (layout.height <= box.height && layout.width <= box.width + 0.5) {
      best = { size: mid, layout };
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best) return { ...best, fits: true };
  const layout = layoutText(text, { ...f, size: Math.floor(min) }, box.width, lineHeight, emphasis, emFont);
  return { size: Math.floor(min), layout, fits: false };
}
