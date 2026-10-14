// Content import: turns .txt/.md/.docx/.pdf files and web pages into markdown-ish text that the
// rules splitter (and AI providers) consume — '#' headings, '- ' / '1. ' items, '> ' quotes and
// blank-line paragraphs. Heavy parsers (mammoth, pdf.js, Readability) are loaded on demand.
import { ImportError } from './errors';
import { decodeText, firstHeading, normalizeText } from './text';
import { pdfToMarkdown } from './pdf';
import { urlToMarkdown } from './url';

export { ImportError } from './errors';
export { htmlToMarkdown, domToMarkdown } from './html';
export { assemblePdfText, type PdfTextItem } from './pdf';
export { normalizeText } from './text';

export type ImportSource = 'text' | 'md' | 'docx' | 'pdf' | 'url';

export interface ImportResult {
  text: string;
  title?: string;
  source: ImportSource;
  warnings: string[];
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Value for `<input type="file" accept>`. */
export const ACCEPTED_FILE_TYPES = [
  '.txt', '.text', '.md', '.markdown', '.docx', '.pdf',
  'text/plain', 'text/markdown', 'text/x-markdown', DOCX_MIME, 'application/pdf',
].join(',');

const SUPPORTED = 'plain text (.txt), Markdown (.md), Word (.docx) and PDF (.pdf)';

type FileKind = Exclude<ImportSource, 'url'>;

function detectKind(file: File): FileKind | 'doc' | null {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  const mime = (file.type || '').toLowerCase().split(';')[0]!.trim();
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd' || mime === 'text/markdown' || mime === 'text/x-markdown') return 'md';
  if (ext === 'txt' || ext === 'text') return 'text';
  if (ext === 'docx' || mime === DOCX_MIME) return 'docx';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'doc' || mime === 'application/msword') return 'doc';
  if (mime === 'text/plain') return 'text';
  return null;
}

async function readBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

const hasMagic = (b: Uint8Array, magic: number[]) => magic.every((m, i) => b[i] === m);

/** Imports a user-picked file. Throws ImportError with a user-facing message on failure. */
export async function importFile(file: File): Promise<ImportResult> {
  const kind = detectKind(file);
  if (kind === 'doc') {
    throw new ImportError('Old Word .doc files aren\'t supported. Open the file in Word (or LibreOffice/Google Docs) and save it as .docx, then import that.');
  }
  if (!kind) {
    throw new ImportError(`"${file.name}" isn't a supported file type. You can import ${SUPPORTED} files.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files up to ${MAX_FILE_BYTES / 1024 / 1024} MB can be imported.`);
  }
  if (file.size === 0) throw new ImportError(`"${file.name}" is empty.`);

  let buf: ArrayBuffer;
  try {
    buf = await readBytes(file);
  } catch (cause) {
    throw new ImportError(`"${file.name}" couldn't be read. Check that the file still exists and try again.`, { cause });
  }
  const bytes = new Uint8Array(buf);
  const baseTitle = file.name.replace(/\.[^.]+$/, '').trim() || undefined;

  if (kind === 'docx') {
    if (!hasMagic(bytes, [0x50, 0x4b])) throw new ImportError(`"${file.name}" isn't a valid .docx file. If it's an older .doc file, save it as .docx first.`);
    const { docxToMarkdown } = await import('./docx');
    const r = await docxToMarkdown(buf);
    if (!r.text.trim()) throw new ImportError(`"${file.name}" doesn't contain any text.`);
    return { ...r, title: r.title ?? baseTitle, source: 'docx' };
  }
  if (kind === 'pdf') {
    if (!new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
      throw new ImportError(`"${file.name}" isn't a valid PDF file.`);
    }
    const r = await pdfToMarkdown(bytes);
    return { ...r, title: r.title ?? baseTitle, source: 'pdf' };
  }

  // Text and Markdown.
  if (bytes.subarray(0, 8192).includes(0) && !hasMagic(bytes, [0xff, 0xfe]) && !hasMagic(bytes, [0xfe, 0xff])) {
    throw new ImportError(`"${file.name}" looks like a binary file, not text. You can import ${SUPPORTED} files.`);
  }
  const text = normalizeText(decodeText(bytes));
  if (!text) throw new ImportError(`"${file.name}" doesn't contain any text.`);
  return { text, title: firstHeading(text) ?? baseTitle, source: kind, warnings: [] };
}

/**
 * Imports the main article of a web page (or a plain-text/Markdown/PDF URL). Aborting via
 * `opts.signal` rejects with the signal's AbortError rather than an ImportError.
 */
export async function importUrl(url: string, opts: { signal?: AbortSignal } = {}): Promise<ImportResult> {
  const r = await urlToMarkdown(url, opts);
  return { ...r, source: 'url' };
}
