// .docx → markdown-ish via mammoth (HTML) and the shared DOM converter. mammoth is loaded on demand
// so it lands in its own chunk.
import { ImportError } from './errors';
import { htmlToMarkdown } from './html';
import { firstHeading } from './text';

export interface DocxResult { text: string; title?: string; warnings: string[] }

// Map common Word paragraph styles onto the elements the converter understands.
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
];

export async function docxToMarkdown(data: ArrayBuffer): Promise<DocxResult> {
  const mammoth = await import('mammoth');
  const convert = mammoth.convertToHtml ?? (mammoth as unknown as { default: typeof mammoth }).default.convertToHtml;
  let html: string;
  const warnings: string[] = [];
  try {
    // The browser build of mammoth reads `arrayBuffer`; its Node build (Vitest) reads `buffer`.
    const input = { arrayBuffer: data, buffer: new Uint8Array(data) } as unknown as { arrayBuffer: ArrayBuffer };
    const result = await convert(input, { styleMap: STYLE_MAP, ignoreEmptyParagraphs: true });
    html = result.value;
    const unknown = result.messages.filter((m) => m.type === 'warning' && /unrecognised|unrecognized/i.test(m.message));
    if (unknown.length) warnings.push('Some Word formatting was not recognized and was imported as plain paragraphs.');
  } catch (cause) {
    throw new ImportError("This Word file couldn't be read. Make sure it is a .docx file (not the older .doc format) and isn't password-protected.", { cause });
  }
  const text = htmlToMarkdown(html);
  return { text, title: firstHeading(text), warnings };
}
