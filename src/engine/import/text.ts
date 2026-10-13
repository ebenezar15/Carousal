// Plain-text helpers shared by every importer: decoding and whitespace normalization.

/** Decodes bytes as text, honoring a UTF-8/UTF-16 BOM and an optional charset label. */
export function decodeText(bytes: Uint8Array, charset?: string): string {
  let label = (charset ?? 'utf-8').trim().toLowerCase();
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { label = 'utf-8'; start = 3; }
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { label = 'utf-16le'; start = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { label = 'utf-16be'; start = 2; }
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(label); } catch { decoder = new TextDecoder('utf-8'); }
  return stripBom(decoder.decode(bytes.subarray(start)));
}

export const stripBom = (s: string) => s.replace(/^\uFEFF/, '');

/**
 * Normalizes markdown-ish text: LF line endings, no trailing spaces, no invisible characters,
 * collapsed runs of spaces, and at most one blank line between blocks.
 */
export function normalizeText(input: string): string {
  return stripBom(input)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\t]/g, ' ')
    .replace(/[\u2028\u2029\f\v]/g, '\n')
    .split('\n')
    .map((line) => {
      // Keep leading indentation (nested lists), collapse internal runs of spaces.
      const indent = /^ */.exec(line)![0];
      const body = line.slice(indent.length).replace(/ {2,}/g, ' ').trimEnd();
      return body ? indent + body : '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** First markdown heading in the text, if any. */
export function firstHeading(text: string): string | undefined {
  const m = /^#{1,6}\s+(.+)$/m.exec(text);
  return m?.[1]?.trim() || undefined;
}
