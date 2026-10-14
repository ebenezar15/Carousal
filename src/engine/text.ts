// Small text utilities shared by the rules splitter and plan normalization.

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const wordCount = (s: string) => words(s).length;

/** Splits prose into sentences without breaking on common abbreviations or decimals. */
export function sentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out: string[] = [];
  const re = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;
  let buf = '';
  for (const m of t.match(re) ?? [t]) {
    buf += m;
    // Join back fragments that ended on an abbreviation like "e.g." or "Dr."
    if (/\b(e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|St|No)\.\s*$/i.test(buf)) continue;
    out.push(buf.trim());
    buf = '';
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Trims to at most n words, preferring to stop at a clause boundary; adds an ellipsis only if cut mid-clause. */
export function clampWords(s: string, n: number): string {
  const w = words(s);
  if (w.length <= n) return s.trim();
  const cut = w.slice(0, n);
  for (let i = cut.length - 1; i >= Math.ceil(n * 0.5); i--) {
    if (/[,;:—–-]$/.test(cut[i]!)) return cut.slice(0, i + 1).join(' ').replace(/[,;:—–-]+$/, '');
  }
  return cut.join(' ').replace(/[,;:.!?—–-]+$/, '') + '…';
}

/** Packs sentences into chunks of at most `max` words each (a single long sentence is clamped). */
export function packSentences(sents: string[], max: number): string[] {
  const chunks: string[] = [];
  let cur: string[] = [];
  let count = 0;
  for (const s of sents) {
    const c = wordCount(s);
    if (count + c > max && cur.length) {
      chunks.push(cur.join(' '));
      cur = [];
      count = 0;
    }
    if (c > max) {
      chunks.push(clampWords(s, max));
      continue;
    }
    cur.push(s);
    count += c;
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks;
}

const STOP = new Set(
  'a an the and or but of to in on for with at by from is are was were be been this that these those it its your you we our their they as into about how why what when which who than then so not no do does can will just more most very'.split(' '),
);

/** Picks words worth emphasizing: numbers first, then the longest non-stopword. */
export function pickEmphasis(headline: string, max = 1): string[] {
  const tokens = words(headline).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '')).filter(Boolean);
  const nums = tokens.filter((t) => /\d/.test(t));
  const rest = tokens.filter((t) => !/\d/.test(t) && !STOP.has(t.toLowerCase()) && t.length > 3).sort((a, b) => b.length - a.length);
  return [...nums, ...rest].slice(0, max);
}

export const stripMarkdown = (s: string) =>
  s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2').replace(/[*_`]/g, '').replace(/\[(.+?)\]\(.+?\)/g, '$1').trim();
