// Text measurement + line breaking used by BOTH the layout engine and the Konva renderer, so what
// the engine measures is exactly what gets drawn. Supports per-word emphasis, character-range rich
// text spans (font/weight/italic/color/underline/highlight), and bulleted/numbered lists.
import { cssFamily } from '@/styles/fontLoader';
import { nearestWeight } from '@/styles';
import type { TextElement, TextEmphasis, TextSpan } from '@/model/types';

export interface FontSpec {
  fontId: string;
  size: number;
  weight: number;
  italic: boolean;
  letterSpacing: number;
}

export interface RunStyle {
  fontId: string;
  weight: number;
  italic: boolean;
  color?: string;
  underline?: boolean;
  highlight?: string;
}

export interface Run {
  text: string;
  x: number;
  width: number;
  emphasized: boolean;
  style: RunStyle;
  /** List marker ("•", "3.") rather than content. */
  marker?: boolean;
}
export interface Line { runs: Run[]; width: number; y: number; indent: number }
export interface TextLayout { lines: Line[]; height: number; width: number; lineHeightPx: number }

export interface LayoutOptions {
  spans?: TextSpan[];
  listStyle?: 'none' | 'bullet' | 'number';
  /** Underline the whole text. */
  underline?: boolean;
}

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

const styleKey = (s: RunStyle, e: boolean) => `${s.fontId}|${s.weight}|${s.italic}|${s.color ?? ''}|${s.underline ?? ''}|${s.highlight ?? ''}|${e}`;

interface Seg { text: string; w: number; style: RunStyle; e: boolean }
interface Word { segs: Seg[]; w: number }

/**
 * Greedy line breaking (respects explicit \n), then groups consecutive segments with the same style
 * into runs with x offsets. Words longer than the box are split by character.
 */
export function layoutText(
  text: string,
  f: FontSpec,
  maxWidth: number,
  lineHeight: number,
  emphasisWords: string[] = [],
  emFont: EmphasisFont = {},
  opts: LayoutOptions = {},
): TextLayout {
  const emph = new Set(emphasisWords.flatMap((w) => w.split(/\s+/)).map(norm).filter(Boolean));
  const spans = (opts.spans ?? []).filter((s) => s.end > s.start);
  const base: RunStyle = { fontId: f.fontId, weight: f.weight, italic: f.italic, underline: opts.underline || undefined };
  const specOf = (s: RunStyle): FontSpec => ({ ...f, fontId: s.fontId, weight: s.weight, italic: s.italic });
  const space = measure(' ', f);
  const lineHeightPx = f.size * lineHeight;
  const lines: Line[] = [];
  const list = opts.listStyle && opts.listStyle !== 'none' ? opts.listStyle : null;

  const styleAt = (pos: number, e: boolean): RunStyle => {
    let s: RunStyle = e ? { ...base, ...emFont } : base;
    for (const sp of spans) {
      if (pos >= sp.start && pos < sp.end) {
        s = {
          ...s,
          ...(sp.fontId ? { fontId: sp.fontId } : {}),
          ...(sp.fontWeight ? { weight: sp.fontWeight } : {}),
          ...(sp.italic !== undefined ? { italic: sp.italic } : {}),
          ...(sp.color ? { color: sp.color } : {}),
          ...(sp.underline !== undefined ? { underline: sp.underline } : {}),
          ...(sp.highlight ? { highlight: sp.highlight } : {}),
        };
      }
    }
    return s;
  };
  const cuts = [...new Set(spans.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);

  const makeWord = (tok: string, offset: number): Word => {
    const e = emph.has(norm(tok));
    const points = [0, ...cuts.map((c) => c - offset).filter((c) => c > 0 && c < tok.length), tok.length];
    const segs: Seg[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const t = tok.slice(points[i], points[i + 1]);
      const style = styleAt(offset + points[i]!, e);
      segs.push({ text: t, w: measure(t, specOf(style)), style, e });
    }
    return { segs, w: segs.reduce((a, s) => a + s.w, 0) };
  };

  let offset = 0;
  let itemNo = 0;
  for (const para of text.split('\n')) {
    const paraStart = offset;
    offset += para.length + 1;
    const isItem = list && para.trim().length > 0;
    if (isItem) itemNo++;
    const markerText = isItem ? (list === 'number' ? `${itemNo}.` : '•') : '';
    const markerW = isItem ? measure(markerText, f) : 0;
    const indent = isItem ? Math.max(markerW + space * 1.6, f.size * (list === 'number' ? 1.6 : 1.1)) : 0;
    const width = maxWidth - indent;

    const words: Word[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(para))) words.push(makeWord(m[0], paraStart + m.index));

    let current: Word[] = [];
    let w = 0;
    let first = true;
    const push = () => {
      const line = toLine(current, space, lines.length * lineHeightPx, indent);
      if (first && isItem) {
        // Marker sits in the hanging indent, right-aligned against the content column.
        line.runs.unshift({ text: markerText, x: Math.max(0, indent - markerW - space * 0.9), width: markerW, emphasized: false, style: { ...base, underline: undefined }, marker: true });
      }
      first = false;
      lines.push(line);
      current = [];
      w = 0;
    };
    if (words.length === 0) {
      push();
      continue;
    }
    for (const word of words) {
      let wd = word;
      while (wd.w > width && wd.segs.reduce((a, s) => a + s.text.length, 0) > 1) {
        // Hard-break an over-long word: take characters until the box is full.
        const flat = wd.segs.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style, e: s.e })));
        let take = flat.length - 1;
        const widthOf = (n: number) => flat.slice(0, n).reduce((a, c) => a + measure(c.ch, specOf(c.style)), 0);
        while (take > 1 && widthOf(take) > width) take--;
        const headSegs = regroup(flat.slice(0, take), specOf);
        if (current.length) push();
        current.push({ segs: headSegs, w: headSegs.reduce((a, s) => a + s.w, 0) });
        push();
        const tailSegs = regroup(flat.slice(take), specOf);
        wd = { segs: tailSegs, w: tailSegs.reduce((a, s) => a + s.w, 0) };
      }
      const add = current.length ? space + wd.w : wd.w;
      if (current.length && w + add > width) push();
      w += current.length ? space + wd.w : wd.w;
      current.push(wd);
    }
    if (current.length) push();
  }
  const width = lines.reduce((mx, l) => Math.max(mx, l.width + l.indent), 0);
  return { lines, height: lines.length * lineHeightPx, width, lineHeightPx };
}

function regroup(chars: { ch: string; style: RunStyle; e: boolean }[], specOf: (s: RunStyle) => FontSpec): Seg[] {
  const segs: Seg[] = [];
  for (const c of chars) {
    const last = segs[segs.length - 1];
    if (last && styleKey(last.style, last.e) === styleKey(c.style, c.e)) last.text += c.ch;
    else segs.push({ text: c.ch, w: 0, style: c.style, e: c.e });
  }
  segs.forEach((s) => (s.w = measure(s.text, specOf(s.style))));
  return segs;
}

function toLine(words: Word[], space: number, y: number, indent: number): Line {
  const runs: Run[] = [];
  let x = 0;
  words.forEach((word, wi) => {
    if (wi > 0) x += space;
    word.segs.forEach((seg, si) => {
      const last = runs[runs.length - 1];
      const joinable = last && styleKey(last.style, last.emphasized) === styleKey(seg.style, seg.e);
      if (joinable) {
        // The space between words joins the run only when both sides share a style.
        last.text += (si === 0 && wi > 0 ? ' ' : '') + seg.text;
        last.width = x + seg.w - last.x;
      } else {
        runs.push({ text: seg.text, x, width: seg.w, emphasized: seg.e, style: seg.style });
      }
      x += seg.w;
    });
  });
  return { runs: runs.map((r) => ({ ...r, x: r.x + indent })), width: x, y, indent };
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
  opts: LayoutOptions = {},
): { size: number; layout: TextLayout; fits: boolean } {
  let lo = Math.floor(min);
  let hi = Math.ceil(max);
  let best: { size: number; layout: TextLayout } | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const layout = layoutText(text, { ...f, size: mid }, box.width, lineHeight, emphasis, emFont, opts);
    if (layout.height <= box.height && layout.width <= box.width + 0.5) {
      best = { size: mid, layout };
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best) return { ...best, fits: true };
  const layout = layoutText(text, { ...f, size: Math.floor(min) }, box.width, lineHeight, emphasis, emFont, opts);
  return { size: Math.floor(min), layout, fits: false };
}

/** Layout of a text element exactly as the renderer draws it. */
export function layoutElement(el: TextElement, overrides: Partial<Pick<TextElement, 'fontSize' | 'width'>> = {}): TextLayout {
  return layoutText(
    applyCase(el.text, el.textCase),
    { fontId: el.fontId, size: overrides.fontSize ?? el.fontSize, weight: el.fontWeight, italic: el.italic, letterSpacing: el.letterSpacing },
    overrides.width ?? el.width,
    el.lineHeight,
    el.emphasis?.words,
    emphasisFont(el.fontId, el.emphasis),
    { spans: el.spans, listStyle: el.listStyle, underline: el.underline },
  );
}

/**
 * After the user edits text or resizes a box: auto-fit shrinks/grows the font to fill the box height
 * (between 40% and 100% of the font size it had before shrinking), otherwise the box grows to fit.
 */
export function refitText(el: TextElement, maxSize = el.fontSize): TextElement {
  if (el.autoFit && !el.curve) {
    const r = fitFontSize(
      applyCase(el.text, el.textCase),
      { fontId: el.fontId, weight: el.fontWeight, italic: el.italic, letterSpacing: el.letterSpacing },
      { width: el.width, height: el.height },
      el.lineHeight,
      Math.max(8, Math.round(maxSize * 0.4)),
      maxSize,
      el.emphasis?.words,
      emphasisFont(el.fontId, el.emphasis),
      { spans: el.spans, listStyle: el.listStyle, underline: el.underline },
    );
    return { ...el, fontSize: r.size };
  }
  const h = Math.ceil(layoutElement(el).height);
  return h > el.height ? { ...el, height: h } : el;
}
