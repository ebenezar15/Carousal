// Carries a text box's emphasis and rich-text spans through translation. Before translating, emphasized
// words are wrapped in <em>…</em> and each styled range in <sN>…</sN> (N = index into the element's
// spans); the translator keeps the tags around the equivalent words, and decoding turns them back into
// emphasis words and span ranges on the translated text — so highlights land on the right words.
import type { TextSpan } from '@/model/types';
import { tokenize } from '@/engine/layout/textLayout';

export interface Styled {
  text: string;
  spans?: TextSpan[];
  emphasis?: string[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const norm = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}%]+$/gu, '');

/** Wraps emphasis words and spans in tags. Overlapping spans (rare) are left out. */
export function encodeTags({ text, spans = [], emphasis = [] }: Styled): string {
  const marks: { pos: number; tag: string; order: number }[] = [];
  const taken: [number, number][] = [];
  spans.forEach((sp, i) => {
    if (sp.end <= sp.start || taken.some(([a, b]) => sp.start < b && sp.end > a)) return;
    taken.push([sp.start, sp.end]);
    marks.push({ pos: sp.start, tag: `<s${i}>`, order: 1 }, { pos: sp.end, tag: `</s${i}>`, order: 0 });
  });
  const emph = new Set(emphasis.flatMap((w) => w.split(/\s+/)).map(norm).filter(Boolean));
  if (emph.size) {
    // Consecutive emphasized words share one <em> so phrases translate as a unit.
    let open: { start: number; end: number } | null = null;
    const flush = () => {
      if (open) marks.push({ pos: open.start, tag: '<em>', order: 1 }, { pos: open.end, tag: '</em>', order: 0 });
      open = null;
    };
    for (const t of tokenize(text)) {
      const start = t.index;
      const end = start + t.text.length;
      const inSpan = taken.some(([a, b]) => start < b && end > a);
      if (!inSpan && emph.has(norm(t.text))) {
        const sameLine = open && !text.slice(open.end, start).includes('\n');
        if (open && sameLine) open.end = end;
        else {
          flush();
          open = { start, end };
        }
      } else flush();
    }
    flush();
  }
  marks.sort((a, b) => a.pos - b.pos || a.order - b.order);
  let out = '';
  let pos = 0;
  for (const m of marks) {
    out += esc(text.slice(pos, m.pos)) + m.tag;
    pos = m.pos;
  }
  return out + esc(text.slice(pos));
}

export const stripTags = (tagged: string) => unesc(tagged.replace(/<\/?(?:em|s\d+)>/g, ''));

export interface Decoded {
  text: string;
  spans: TextSpan[];
  emphasis: string[];
  /** False when the tags were missing or mangled (styling falls back; see reconcile). */
  ok: boolean;
}

/** Turns translated, tagged text back into plain text + spans + emphasis words. */
export function decodeTags(tagged: string, originalSpans: TextSpan[] = []): Decoded {
  const re = /<(\/?)(em|s(\d+))>/g;
  const stack: { name: string; start: number }[] = [];
  const spans: TextSpan[] = [];
  const emphasis: string[] = [];
  let text = '';
  let last = 0;
  let ok = true;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagged))) {
    text += unesc(tagged.slice(last, m.index));
    last = re.lastIndex;
    const name = m[2]!;
    if (!m[1]) {
      stack.push({ name, start: text.length });
      continue;
    }
    const top = stack.pop();
    if (!top || top.name !== name) {
      ok = false;
      continue;
    }
    if (name === 'em') {
      const phrase = text.slice(top.start).trim();
      if (phrase) emphasis.push(...phrase.split(/\s+/).flatMap((w) => tokenize(w).map((t) => t.text)));
    } else {
      const orig = originalSpans[Number(m[3])];
      if (orig && text.length > top.start) spans.push({ ...orig, start: top.start, end: text.length });
      else if (!orig) ok = false;
    }
  }
  text += unesc(tagged.slice(last));
  if (stack.length) ok = false;
  return { text, spans: spans.sort((a, b) => a.start - b.start), emphasis: [...new Set(emphasis)], ok };
}

/** Problems with a translation's tags compared to its source (used to ask the model for a repair). */
export function tagProblems(source: string, translated: string): string | null {
  const count = (s: string) => {
    const c = new Map<string, number>();
    for (const m of s.matchAll(/<\/?(?:em|s\d+)>/g)) c.set(m[0], (c.get(m[0]) ?? 0) + 1);
    return c;
  };
  const a = count(source);
  const b = count(translated);
  const missing = [...a].filter(([tag, n]) => (b.get(tag) ?? 0) < n).map(([t]) => t);
  if (missing.length) return `keep the tags ${missing.join(' ')} around the matching translated words`;
  if (!decodeTags(translated).ok) return 'tags are not properly nested';
  return null;
}

/**
 * Styling for text the user edited after translation: keeps the emphasis words and span texts the
 * decoded translation had wherever they still occur in the edited text.
 */
export function reconcile(edited: string, decoded: Decoded): { spans: TextSpan[]; emphasis: string[] } {
  const spans: TextSpan[] = [];
  let from = 0;
  for (const sp of decoded.spans) {
    const piece = decoded.text.slice(sp.start, sp.end);
    const at = piece ? edited.indexOf(piece, from) : -1;
    if (at >= 0) {
      spans.push({ ...sp, start: at, end: at + piece.length });
      from = at + piece.length;
    }
  }
  const present = new Set(tokenize(edited).map((t) => norm(t.text)));
  return { spans, emphasis: decoded.emphasis.filter((w) => present.has(norm(w))) };
}
