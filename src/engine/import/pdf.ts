// PDF → markdown-ish. pdf.js only gives positioned text runs, so lines, paragraphs, lists and
// headings are reconstructed here from geometry (assemblePdfText is pure and unit-tested).
import { ImportError } from './errors';

/** One positioned text run, in PDF user space (y grows upwards). `size` is the font size. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
  hasEOL?: boolean;
}

interface Line { text: string; x: number; y: number; size: number; page: number; gapBefore: number }

const BULLET_RE = /^([•●▪■◦‣○∙·–*-]|\(?\d{1,3}[.)]|\(?[a-z][.)])\s+/;
const BULLET_ONLY_RE = /^([•●▪■◦‣○∙·–*-]|\(?\d{1,3}[.)])$/;
const PAGE_NUMBER_RE = /^(?:page\s+)?\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?$/i;
const TERMINAL_RE = /[.!?:;"'”’)]$/;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

/** Groups a page's runs into lines (by baseline) in reading order. */
function pageLines(items: PdfTextItem[], page: number): Line[] {
  const lines: { items: PdfTextItem[]; y: number; size: number }[] = [];
  for (const it of items) {
    if (!it.str && !it.hasEOL) continue;
    const last = lines[lines.length - 1];
    const tol = Math.max(2, 0.45 * Math.max(it.size, last?.size ?? 0));
    if (last && Math.abs(last.y - it.y) <= tol && it.str) {
      last.items.push(it);
      last.size = Math.max(last.size, it.str.trim() ? it.size : 0);
    } else if (it.str) {
      lines.push({ items: [it], y: it.y, size: it.str.trim() ? it.size : 0 });
    }
  }
  const out: Line[] = [];
  for (const l of lines) {
    const runs = [...l.items].sort((a, b) => a.x - b.x);
    let text = '';
    let end = -Infinity;
    for (const r of runs) {
      const gap = r.x - end;
      if (text && !/\s$/.test(text) && !/^\s/.test(r.str) && gap > 0.15 * (r.size || l.size || 10)) text += ' ';
      text += r.str;
      end = Math.max(end, r.x + r.width);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    out.push({ text, x: runs[0]!.x, y: l.y, size: l.size || runs[0]!.size, page, gapBefore: prev ? prev.y - l.y : Infinity });
  }
  return out;
}

const shape = (s: string) => s.toLowerCase().replace(/\d+/g, '#');

/**
 * Rebuilds markdown-ish text from per-page text runs: joins hyphenated line breaks, starts
 * paragraphs on larger vertical gaps, promotes larger-font short lines to headings, normalizes
 * bullets and drops page numbers and running headers/footers.
 */
export function assemblePdfText(pages: PdfTextItem[][]): string {
  const perPage = pages.map((items, i) => pageLines(items, i));

  // Running headers/footers: the same first/last line (digits ignored) on most pages.
  const drop = new Set<string>();
  if (perPage.length >= 3) {
    const counts = new Map<string, number>();
    for (const lines of perPage) {
      const edge = new Set([lines[0], lines[lines.length - 1]].filter(Boolean).map((l) => shape(l!.text)));
      for (const k of edge) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const [k, n] of counts) if (n >= Math.max(3, perPage.length * 0.5)) drop.add(k);
  }
  const lines = perPage.flatMap((ls) =>
    ls.filter((l, i) => {
      const edge = i === 0 || i === ls.length - 1;
      return !(edge && (PAGE_NUMBER_RE.test(l.text) || drop.has(shape(l.text))));
    }),
  );
  if (!lines.length) return '';

  // Body font size = the size carrying the most characters.
  const weight = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size * 2) / 2;
    weight.set(k, (weight.get(k) ?? 0) + l.text.length);
  }
  const body = [...weight].sort((a, b) => b[1] - a[1])[0]![0] || 10;
  const gaps = lines.filter((l) => Number.isFinite(l.gapBefore) && l.gapBefore > 0 && Math.abs(l.size - body) < 1).map((l) => l.gapBefore);
  const lineGap = median(gaps) || body * 1.2;

  const blocks: string[] = [];
  let cur: { kind: 'para' | 'heading' | 'item'; text: string; size: number; x: number; level: number } | null = null;
  let lastWasItem = false;
  const flush = () => {
    if (!cur) return;
    const t = cur.text.trim();
    if (t) {
      if (cur.kind === 'heading') blocks.push(`${'#'.repeat(cur.level)} ${t}`);
      // Consecutive list items stay together in one block.
      else if (cur.kind === 'item' && lastWasItem && blocks.length) blocks[blocks.length - 1] += `\n${t}`;
      else blocks.push(t);
      lastWasItem = cur.kind === 'item';
    }
    cur = null;
  };
  const append = (text: string) => {
    if (!cur) return;
    // Re-join words hyphenated across a line break ("exam-" + "ple").
    if (/[A-Za-zÀ-ÿ]-$/.test(cur.text) && /^[a-zà-ÿ]/.test(text)) cur.text = cur.text.slice(0, -1) + text;
    else cur.text += (cur.text ? ' ' : '') + text;
  };

  let pendingMarker: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const prev = lines[i - 1];
    const newPage = !!prev && prev.page !== l.page;
    const bigGap = !newPage && l.gapBefore > lineGap * 1.45;
    const words = l.text.split(' ').length;

    if (l.size >= body * 1.18 && words <= 16 && !/[.,;]$/.test(l.text)) {
      const level = l.size >= body * 1.6 ? 1 : 2;
      if (cur?.kind === 'heading' && cur.level === level && Math.abs(cur.size - l.size) < 0.5 && !bigGap && !newPage) append(l.text);
      else {
        flush();
        cur = { kind: 'heading', text: l.text, size: l.size, x: l.x, level };
      }
      continue;
    }

    // A bullet glyph laid out as its own line; the item text follows.
    if (BULLET_ONLY_RE.test(l.text)) {
      flush();
      pendingMarker = l.text;
      continue;
    }
    const bullet = BULLET_RE.exec(l.text);
    if (bullet || pendingMarker) {
      const src = bullet ? bullet[1]! : pendingMarker!;
      const rest = bullet ? l.text.slice(bullet[0].length) : l.text;
      const num = /^\(?(\d+)/.exec(src);
      flush();
      cur = { kind: 'item', text: `${num ? `${num[1]}.` : '-'} ${rest}`, size: l.size, x: l.x, level: 0 };
      pendingMarker = null;
      continue;
    }

    const continues =
      (cur?.kind === 'item' && !bigGap && !newPage && l.x > cur.x + 1) ||
      (cur?.kind === 'para' && (newPage ? !TERMINAL_RE.test(cur.text) : !bigGap));
    if (continues) append(l.text);
    else {
      flush();
      cur = { kind: 'para', text: l.text, size: l.size, x: l.x, level: 0 };
    }
  }
  flush();
  return blocks.join('\n\n');
}

/** Minimal surface of pdf.js used here (so tests can pass the legacy Node build). */
export interface PdfjsLib {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; useSystemFonts?: boolean; disableFontFace?: boolean; verbosity?: number }): {
    promise: Promise<PdfDoc>;
    destroy(): Promise<void>;
  };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }>; cleanup(): void }>;
  getMetadata(): Promise<{ info: unknown }>;
}

export interface PdfResult { text: string; title?: string; warnings: string[] }

const MAX_PAGES = 500;

async function loadPdfjs(): Promise<PdfjsLib> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs as unknown as PdfjsLib;
}

function toItems(raw: unknown[]): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (const r of raw) {
    const it = r as { str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean };
    if (typeof it.str !== 'string' || !it.transform) continue;
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = it.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 0;
    out.push({ str: it.str, x: e, y: f, width: it.width ?? 0, size, hasEOL: it.hasEOL });
  }
  return out;
}

export async function pdfToMarkdown(data: ArrayBuffer | Uint8Array, lib?: PdfjsLib): Promise<PdfResult> {
  const pdfjs = lib ?? (await loadPdfjs());
  const task = pdfjs.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  let doc: PdfDoc;
  try {
    doc = await task.promise;
  } catch (cause) {
    const name = (cause as { name?: string })?.name;
    if (name === 'PasswordException') throw new ImportError('This PDF is password-protected. Remove the password (or copy the text out of it) and try again.', { cause });
    throw new ImportError("This PDF couldn't be opened — the file may be damaged or not a real PDF.", { cause });
  }
  const warnings: string[] = [];
  try {
    const count = Math.min(doc.numPages, MAX_PAGES);
    if (doc.numPages > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} of ${doc.numPages} pages were imported.`);
    const pages: PdfTextItem[][] = [];
    let emptyPages = 0;
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const items = toItems((await page.getTextContent()).items);
      if (!items.some((i) => i.str.trim())) emptyPages++;
      pages.push(items);
      page.cleanup();
    }
    const text = assemblePdfText(pages);
    if (!text.trim()) {
      throw new ImportError(
        "This PDF has no selectable text — it looks like a scanned image. CarouselForge can't read text from images; run it through an OCR tool first, or paste the text in directly.",
      );
    }
    if (emptyPages) {
      warnings.push(`${emptyPages} of ${count} pages had no selectable text (probably scanned images) and were skipped.`);
    }
    let title: string | undefined;
    try {
      const info = (await doc.getMetadata()).info as { Title?: unknown };
      if (typeof info?.Title === 'string' && info.Title.trim() && !/^(untitled|microsoft word)/i.test(info.Title.trim())) title = info.Title.trim();
    } catch { /* metadata is optional */ }
    title ??= /^#{1,6}\s+(.+)$/m.exec(text)?.[1];
    return { text, title, warnings };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
