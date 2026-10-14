import { afterEach, describe, expect, it, vi } from 'vitest';
import { Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from 'docx';
import {
  ACCEPTED_FILE_TYPES,
  ImportError,
  MAX_FILE_BYTES,
  assemblePdfText,
  htmlToMarkdown,
  importFile,
  importUrl,
  type PdfTextItem,
} from '@/engine/import';
import { pdfToMarkdown, type PdfjsLib } from '@/engine/import/pdf';
import { parseBlocks } from '@/engine/rules';
import { makePdf } from './fixtures/import/makePdf';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const file = (parts: BlobPart[], name: string, type = '') => new File(parts, name, { type });

async function rejection(p: Promise<unknown>): Promise<ImportError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ImportError);
    return e as ImportError;
  }
  throw new Error('expected a rejection');
}

describe('text and markdown files', () => {
  it('strips the BOM, normalizes CRLF and collapses whitespace', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('# Title\r\n\r\n\r\n\r\nFirst   para here.  \r\n- one\r\n- two\r\n')]);
    const r = await importFile(file([bytes], 'notes.md'));
    expect(r).toEqual({ text: '# Title\n\nFirst para here.\n- one\n- two', title: 'Title', source: 'md', warnings: [] });
  });

  it('detects type by MIME when the extension is unknown and uses the file name as title', async () => {
    const r = await importFile(file(['Just some words.\n'], 'clipboard', 'text/plain'));
    expect(r.source).toBe('text');
    expect(r.title).toBe('clipboard');
    expect(r.text).toBe('Just some words.');
  });

  it('decodes UTF-16 files with a BOM', async () => {
    const s = 'Héllo';
    const buf = new Uint8Array(2 + s.length * 2);
    buf.set([0xff, 0xfe]);
    for (let i = 0; i < s.length; i++) buf[2 + i * 2] = s.charCodeAt(i);
    expect((await importFile(file([buf], 'u16.txt'))).text).toBe('Héllo');
  });

  it('rejects unsupported, legacy .doc, empty and oversized files', async () => {
    const unsupported = await rejection(importFile(file(['x'], 'photo.png', 'image/png')));
    expect(unsupported.userMessage).toMatch(/isn't a supported file type.*\.txt.*\.md.*\.docx.*\.pdf/);
    expect((await rejection(importFile(file(['x'], 'old.doc')))).userMessage).toMatch(/save it as \.docx/);
    expect((await rejection(importFile(file([], 'empty.txt')))).userMessage).toMatch(/empty/);
    const big = file(['x'], 'huge.txt');
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });
    expect((await rejection(importFile(big))).userMessage).toMatch(/Files up to 25 MB/);
  });

  it('rejects binary content disguised as text, and fake PDFs/DOCX', async () => {
    expect((await rejection(importFile(file([new Uint8Array([1, 0, 2, 0])], 'x.txt')))).userMessage).toMatch(/binary/);
    expect((await rejection(importFile(file(['hello'], 'x.pdf')))).userMessage).toMatch(/isn't a valid PDF/);
    expect((await rejection(importFile(file(['hello'], 'x.docx')))).userMessage).toMatch(/isn't a valid \.docx/);
  });

  it('exposes an accept string covering every supported type', () => {
    for (const t of ['.txt', '.md', '.markdown', '.docx', '.pdf', 'text/plain', 'application/pdf']) expect(ACCEPTED_FILE_TYPES.split(',')).toContain(t);
  });
});

describe('HTML → markdown', () => {
  it('keeps headings, lists, quotes and paragraphs and flattens inline formatting', () => {
    const md = htmlToMarkdown(`
      <h1>Big <em>title</em></h1>
      <p>Intro with <strong>bold</strong>,   <a href="/x">a link</a> and <code>code</code>.</p>
      <h2>Steps</h2>
      <ol><li>First</li><li><p>Second</p><ul><li>Nested</li></ul></li></ol>
      <ul><li>Alpha</li><li>Beta</li></ul>
      <blockquote><p>Simplicity is the ultimate sophistication.</p><footer>— Leonardo da Vinci</footer></blockquote>
      <h5>Deep heading</h5>
      <div>Loose text in a div<br>with a break</div>`);
    expect(md).toBe(
      [
        '# Big title',
        'Intro with bold, a link and code.',
        '## Steps',
        '1. First\n2. Second\n  - Nested',
        '- Alpha\n- Beta',
        '> Simplicity is the ultimate sophistication. — Leonardo da Vinci',
        '### Deep heading',
        'Loose text in a div\nwith a break',
      ].join('\n\n'),
    );
    const blocks = parseBlocks(md);
    expect(blocks[0]).toEqual({ kind: 'heading', text: 'Big title', level: 1 });
    expect(blocks).toContainEqual({ kind: 'quote', text: 'Simplicity is the ultimate sophistication.', attribution: 'Leonardo da Vinci' });
    expect(blocks.some((b) => b.kind === 'bullets' && b.items.includes('Alpha') && b.items.includes('Nested'))).toBe(true);
  });

  it('removes navigation, scripts, hidden elements and (optionally) boilerplate by class', () => {
    const html = `
      <body>
        <header><nav><a>Home</a><a>About</a></nav></header>
        <script>var x = 1;</script><style>p{}</style>
        <div class="cookie-banner">We use cookies</div>
        <main><p>Real content.</p><p hidden>Hidden</p><div aria-hidden="true">Icon</div>
          <div class="share-buttons">Share on X</div></main>
        <aside>Sidebar</aside><footer>© 2026</footer>
      </body>`;
    expect(htmlToMarkdown(html, { stripBoilerplate: true })).toBe('Real content.');
    expect(htmlToMarkdown(html)).not.toMatch(/Home|var x|Sidebar|© 2026|Hidden|Icon/);
  });

  it('renders tables as one row per line', () => {
    expect(htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>')).toBe('A | B\n1 | 2');
  });
});

describe('docx files', () => {
  it('converts a real .docx (headings, paragraphs, lists) to markdown-ish text', async () => {
    const doc = new Document({
      numbering: {
        config: [{ reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.' }] }],
      },
      sections: [
        {
          children: [
            new Paragraph({ text: 'Quarterly Review', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun('Revenue grew '), new TextRun({ text: '40%', bold: true }), new TextRun(' this quarter.')] }),
            new Paragraph({ text: 'Highlights', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: 'New customers', bullet: { level: 0 } }),
            new Paragraph({ text: 'Lower churn', bullet: { level: 0 } }),
            new Paragraph({ text: 'Plan', numbering: { reference: 'nums', level: 0 } }),
            new Paragraph({ text: 'Ship', numbering: { reference: 'nums', level: 0 } }),
          ],
        },
      ],
    });
    const buf = await Packer.toArrayBuffer(doc);
    const r = await importFile(file([buf], 'review.docx'));
    expect(r.source).toBe('docx');
    expect(r.title).toBe('Quarterly Review');
    expect(r.text).toBe('# Quarterly Review\n\nRevenue grew 40% this quarter.\n\n## Highlights\n\n- New customers\n- Lower churn\n\n1. Plan\n2. Ship');
  });
});

describe('PDF text assembly', () => {
  const run = (str: string, x: number, y: number, size = 10, width = str.length * size * 0.5): PdfTextItem => ({ str, x, y, size, width });

  it('rebuilds lines, joins hyphenation, splits paragraphs on gaps and finds headings', () => {
    const page: PdfTextItem[] = [
      run('Annual Report', 72, 740, 24),
      run('Our results this year were the', 72, 700),
      run('best', 72 + 30 * 5 + 3, 700),
      run('ever. We expanded into new mar-', 72, 688),
      run('kets across the region.', 72, 676),
      run('A second paragraph follows here.', 72, 650),
      run('Key wins', 72, 620, 14),
      run('• Faster shipping', 72, 600),
      run('• Better support with a longer', 72, 588),
      run('explanation that wraps', 80, 576),
      run('1. Numbered item', 72, 564),
      run('7', 300, 40),
    ];
    expect(assemblePdfText([page])).toBe(
      [
        '# Annual Report',
        'Our results this year were the best ever. We expanded into new markets across the region.',
        'A second paragraph follows here.',
        '## Key wins',
        '- Faster shipping\n- Better support with a longer explanation that wraps\n1. Numbered item',
      ].join('\n\n'),
    );
  });

  it('merges split runs on one baseline and continues sentences across pages', () => {
    const p1 = [run('Hel', 72, 700), run('lo', 72 + 15, 700.4), run('world,', 72 + 30, 700), run('this sentence', 72, 688)];
    const p2 = [run('continues on page two.', 72, 740), run('New idea.', 72, 700)];
    expect(assemblePdfText([p1, p2])).toBe('Hello world, this sentence continues on page two.\n\nNew idea.');
  });

  it('drops running headers and page numbers repeated on every page', () => {
    const pages = [1, 2, 3].map((n) => [run('ACME Confidential', 72, 770), run(`Body text of page ${n}.`, 72, 700), run(`Page ${n} of 3`, 72, 30)]);
    expect(assemblePdfText(pages)).toBe('Body text of page 1.\n\nBody text of page 2.\n\nBody text of page 3.');
  });

  it('returns empty text for image-only pages', () => {
    expect(assemblePdfText([[], []])).toBe('');
  });
});

describe('PDF files (pdf.js legacy build)', () => {
  const legacy = async () => (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsLib;

  it('extracts structured text and metadata title from a real PDF', async () => {
    const bytes = makePdf(
      [
        [
          { text: 'Launch Plan', size: 24, x: 72, y: 720 },
          { text: 'We ship in three phases.', size: 11, x: 72, y: 680 },
          { text: 'Each phase has a clear goal.', size: 11, x: 72, y: 666 },
        ],
      ],
      'Launch Plan 2026',
    );
    const r = await pdfToMarkdown(bytes, await legacy());
    expect(r.text).toBe('# Launch Plan\n\nWe ship in three phases. Each phase has a clear goal.');
    expect(r.title).toBe('Launch Plan 2026');
    expect(r.warnings).toEqual([]);
  });

  it('explains scanned (text-less) PDFs and warns about partially scanned ones', async () => {
    const lib = await legacy();
    const scanned = await rejection(pdfToMarkdown(makePdf([[]]), lib));
    expect(scanned.userMessage).toMatch(/no selectable text.*scanned image.*OCR/);
    const partial = await pdfToMarkdown(makePdf([[{ text: 'Only page one.', size: 11, x: 72, y: 700 }], []]), lib);
    expect(partial.warnings[0]).toMatch(/1 of 2 pages had no selectable text/);
  });

  it('reports damaged PDFs', async () => {
    const bad = new TextEncoder().encode('%PDF-1.4\ngarbage');
    expect((await rejection(pdfToMarkdown(bad, await legacy()))).userMessage).toMatch(/couldn't be opened/);
  });
});

describe('URL import', () => {
  const article = `<!doctype html><html><head><title>How to Focus | Blog</title></head><body>
    <header class="site-header"><nav><a href="/">Home</a><a href="/blog">Blog</a></nav></header>
    <div class="cookie-banner">We use cookies. Accept?</div>
    <main><article>
      <h1>How to Focus</h1>
      <p>Deep work is the ability to focus without distraction on a cognitively demanding task. It is a skill that allows you to quickly master complicated information.</p>
      <h2>Three rules</h2>
      <ul><li>Work deeply in long blocks</li><li>Embrace boredom instead of reaching for your phone</li><li>Quit social media for a month</li></ul>
      <p>Most people never train this skill, which is exactly why it is so valuable in a modern economy that rewards rare and valuable output.</p>
      <blockquote><p>Clarity about what matters provides clarity about what does not.</p></blockquote>
    </article></main>
    <aside class="sidebar"><h3>Popular posts</h3><ul><li>Other post</li></ul></aside>
    <footer>© 2026 Blog Inc. All rights reserved.</footer>
  </body></html>`;

  const respond = (body: string, type = 'text/html; charset=utf-8', status = 200) =>
    vi.fn(() => Promise.resolve(new Response(body, { status, headers: { 'content-type': type } })));

  it('extracts the article with Readability and converts it', async () => {
    const fetchMock = respond(article);
    vi.stubGlobal('fetch', fetchMock);
    const r = await importUrl('example.com/focus');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/focus', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(r.source).toBe('url');
    expect(r.title).toBe('How to Focus');
    expect(r.text.startsWith('# How to Focus\n\nDeep work is the ability')).toBe(true);
    expect(r.text).toContain('## Three rules\n\n- Work deeply in long blocks\n- Embrace boredom');
    expect(r.text).toContain('> Clarity about what matters');
    expect(r.text).not.toMatch(/cookies|Home|Popular posts|All rights reserved/);
  });

  it('falls back to the page body (minus chrome) when there is no clear article', async () => {
    vi.stubGlobal('fetch', respond('<html><head><title>Tiny</title></head><body><nav>Menu</nav><div class="newsletter">Subscribe now</div><p>Short note.</p></body></html>'));
    const r = await importUrl('https://example.com/tiny');
    expect(r.title).toBe('Tiny');
    expect(r.text).toContain('Short note.');
    expect(r.text).not.toMatch(/Menu|Subscribe/);
  });

  it('imports plain text and markdown URLs directly', async () => {
    vi.stubGlobal('fetch', respond('# Notes\r\n\r\n- a\r\n- b', 'text/markdown'));
    expect(await importUrl('https://example.com/notes.md')).toEqual({ text: '# Notes\n\n- a\n- b', title: 'Notes', source: 'url', warnings: [] });
  });

  it('fails clearly when offline, without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(false);
    const e = await rejection(importUrl('https://example.com'));
    expect(e.userMessage).toBe('You are offline. URL import needs an internet connection — paste the text instead.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains browser CORS failures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const e = await rejection(importUrl('https://example.com/post'));
    expect(e.userMessage).toMatch(/blocks requests from the browser version.*desktop app.*paste it in/);
    expect(e.cause).toBeInstanceOf(TypeError);
  });

  it('validates the URL', async () => {
    expect((await rejection(importUrl('ftp://example.com/file'))).userMessage).toMatch(/http:\/\/ or https:\/\//);
    expect((await rejection(importUrl('not a url'))).userMessage).toMatch(/isn't a valid web address/);
    expect((await rejection(importUrl('   '))).userMessage).toMatch(/Enter a web address/);
  });

  it('maps HTTP errors, oversize bodies and unsupported content types', async () => {
    vi.stubGlobal('fetch', respond('nope', 'text/html', 404));
    expect((await rejection(importUrl('https://example.com/missing'))).userMessage).toMatch(/wasn't found \(HTTP 404\)/);
    vi.stubGlobal('fetch', respond('x'.repeat(5 * 1024 * 1024 + 1), 'text/plain'));
    expect((await rejection(importUrl('https://example.com/big'))).userMessage).toMatch(/larger than 5 MB/);
    vi.stubGlobal('fetch', respond('PNG', 'image/png'));
    expect((await rejection(importUrl('https://example.com/a.png'))).userMessage).toMatch(/image\/png file, which can't be imported/);
  });

  it('times out after 15 seconds and honors a caller abort signal', async () => {
    const hang = vi.fn((_u: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    );
    vi.stubGlobal('fetch', hang);
    vi.useFakeTimers();
    const pending = rejection(importUrl('https://slow.example.com'));
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).userMessage).toMatch(/longer than 15 seconds/);
    vi.useRealTimers();

    const ctrl = new AbortController();
    const p = importUrl('https://slow.example.com', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
