// URL → markdown-ish article text. Fetches through appFetch (Tauri HTTP plugin on desktop, so no
// CORS limits there), extracts the article with Readability and converts it with the DOM converter.
import { appFetch } from '@/engine/net';
import { isTauri } from '@/secrets';
import { ImportError } from './errors';
import { domToMarkdown, removePageChrome } from './html';
import { decodeText, normalizeText, firstHeading } from './text';
import { pdfToMarkdown } from './pdf';

export const URL_TIMEOUT_MS = 15_000;
export const MAX_URL_BYTES = 5 * 1024 * 1024;

export interface UrlResult { text: string; title?: string; warnings: string[] }

const OFFLINE = 'You are offline. URL import needs an internet connection — paste the text instead.';
const CORS =
  "This site blocks requests from the browser version of CarouselForge (cross-origin restrictions), or it couldn't be reached. Use the desktop app to import from any site, or copy the article text and paste it in.";
const TOO_BIG = 'That page is larger than 5 MB, which is too big to import. Copy the part you need and paste it in instead.';

/** Parses and validates an http(s) URL; a bare domain like "example.com/post" gets https://. */
export function parseImportUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new ImportError('Enter a web address to import, starting with https://');
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch (cause) {
    throw new ImportError(`"${raw}" isn't a valid web address. It should look like https://example.com/article`, { cause });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImportError('Only web pages (http:// or https:// addresses) can be imported.');
  }
  if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost' && !/^\[/.test(url.hostname))) {
    throw new ImportError(`"${raw}" isn't a valid web address. It should look like https://example.com/article`);
  }
  return url;
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError' || (e as { name?: string })?.name === 'TimeoutError';

/** Reads the body, refusing anything larger than `limit` bytes (streamed when possible). */
async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(res.headers?.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new ImportError(TOO_BIG);
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > limit) throw new ImportError(TOO_BIG);
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ImportError(TOO_BIG);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function httpError(status: number): ImportError {
  if (status === 401 || status === 403) return new ImportError(`The site refused access (HTTP ${status}). It may require a login or block automated requests — copy the text and paste it in instead.`);
  if (status === 404 || status === 410) return new ImportError(`That page wasn't found (HTTP ${status}). Check the address and try again.`);
  if (status === 429) return new ImportError('The site is rate-limiting requests (HTTP 429). Wait a moment and try again, or paste the text in.');
  return new ImportError(`The site responded with an error (HTTP ${status}). Try again later, or paste the text in.`);
}

/** Converts a fetched HTML page to article text. Exported for tests. */
export async function articleFromHtml(html: string, baseUrl: string): Promise<{ text: string; title?: string; warnings: string[] }> {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Let Readability resolve relative links and read the canonical URL.
  if (!doc.querySelector('base[href]')) {
    const base = doc.createElement('base');
    base.setAttribute('href', baseUrl);
    doc.head?.prepend(base);
  }
  const pageTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || doc.title?.trim() || undefined;
  removePageChrome(doc);
  const fallbackDoc = doc.cloneNode(true) as Document;

  let text = '';
  let title: string | undefined;
  try {
    const { Readability } = await import('@mozilla/readability');
    const article = new Readability<Node>(doc, { serializer: (el) => el, keepClasses: false }).parse();
    if (article?.content) {
      text = domToMarkdown(article.content);
      title = article.title?.trim() || undefined;
    }
  } catch {
    // Readability can throw on unusual markup; fall back to the raw page below.
  }
  if (text.replace(/\s+/g, ' ').length < 80) {
    const main = fallbackDoc.querySelector('article, main, [role="main"]') ?? fallbackDoc.body;
    const raw = main ? domToMarkdown(main, { stripBoilerplate: true }) : '';
    if (raw.length > text.length) {
      text = raw;
      warnings.push("Couldn't find a clear article on this page, so all of its text was imported. You may want to trim it.");
    }
  }
  title = cleanTitle(title ?? pageTitle, fallbackDoc);
  if (!text.trim()) throw new ImportError("Couldn't find any readable text on that page. It may need JavaScript to load its content — copy the text and paste it in instead.");

  // Put the title on top as a heading unless the article already starts with it.
  const lead = firstHeading(text);
  const startsWithHeading = /^#{1,6}\s/.test(text);
  if (title && !(startsWithHeading && lead && sameText(lead, title))) text = `# ${title}\n\n${text}`;
  return { text: normalizeText(text), title, warnings };
}

/** Drops a " | Site name" style suffix when one part of the title matches a page <h1>. */
function cleanTitle(title: string | undefined, doc: Document): string | undefined {
  if (!title) return undefined;
  const parts = title.split(/\s+[|–—·»:]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return title;
  const h1s = Array.from(doc.querySelectorAll('h1'), (h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim());
  return parts.find((p) => h1s.some((h) => sameText(h, p))) ?? title;
}

const sameText = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const [x, y] = [n(a), n(b)].sort((p, q) => p.length - q.length) as [string, string];
  return x === y || (y.startsWith(x) && x.length >= 0.6 * y.length);
};

export async function urlToMarkdown(input: string, opts: { signal?: AbortSignal } = {}): Promise<UrlResult> {
  const url = parseImportUrl(input);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ImportError(OFFLINE);
  opts.signal?.throwIfAborted();

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, URL_TIMEOUT_MS);
  const onAbort = () => ctrl.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await appFetch(url.href, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,text/markdown;q=0.9,application/pdf;q=0.8,*/*;q=0.5' },
      });
    } catch (cause) {
      if (timedOut) throw new ImportError(`The site took longer than ${URL_TIMEOUT_MS / 1000} seconds to respond. Try again, or paste the text in.`, { cause });
      if (opts.signal?.aborted || isAbort(cause)) throw cause;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ImportError(OFFLINE, { cause });
      if (cause instanceof TypeError && !isTauri()) throw new ImportError(CORS, { cause });
      throw new ImportError(`Couldn't reach ${url.hostname}. Check the address and your connection, or paste the text in.`, { cause });
    }
    if (!res.ok) throw httpError(res.status);

    let bytes: Uint8Array;
    try {
      bytes = await readLimited(res, MAX_URL_BYTES);
    } catch (cause) {
      if (cause instanceof ImportError) throw cause;
      if (timedOut) throw new ImportError(`The site took longer than ${URL_TIMEOUT_MS / 1000} seconds to respond. Try again, or paste the text in.`, { cause });
      if (opts.signal?.aborted) throw cause;
      throw new ImportError('The download was interrupted. Try again, or paste the text in.', { cause });
    }

    const contentType = (res.headers?.get('content-type') ?? '').toLowerCase();
    const mime = contentType.split(';')[0]!.trim();
    const charset = /charset=["']?([\w-]+)/.exec(contentType)?.[1];
    const finalUrl = res.url || url.href;
    const path = new URL(finalUrl).pathname.toLowerCase();

    if (mime === 'application/pdf' || (!mime && path.endsWith('.pdf'))) {
      return await pdfToMarkdown(bytes);
    }
    const body = decodeText(bytes, charset);
    const looksHtml = /^\s*(<!doctype html|<html|<head|<body)/i.test(body);
    if (mime === 'text/html' || mime === 'application/xhtml+xml' || ((!mime || mime === 'application/octet-stream') && looksHtml)) {
      return await articleFromHtml(body, finalUrl);
    }
    if (mime.startsWith('text/') || /markdown|x-markdown/.test(mime) || (!mime && /\.(md|markdown|txt)$/.test(path))) {
      const text = normalizeText(body);
      if (!text) throw new ImportError('That address returned an empty document.');
      return { text, title: firstHeading(text), warnings: [] };
    }
    throw new ImportError(`That address returned a ${mime || 'unknown'} file, which can't be imported. Use a web page, plain text, Markdown or PDF link — or download the file and import it directly.`);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
