// Small DOM → markdown-ish converter shared by the .docx and URL importers. It keeps only the
// structure the rules splitter understands (headings, paragraphs, lists, quotes) and flattens
// inline formatting (bold, italics, links, code) to plain text.
import { normalizeText } from './text';

export interface HtmlToMarkdownOptions {
  /** Also drop page chrome found by class/id/role (cookie banners, share bars, menus…). Use for raw pages. */
  stripBoilerplate?: boolean;
}

/** Elements whose content is never article text. */
const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'canvas', 'svg', 'math',
  'nav', 'aside', 'footer', 'form', 'button', 'input', 'select', 'textarea', 'label', 'dialog',
  'menu', 'img', 'picture', 'video', 'audio', 'source', 'track', 'map', 'head', 'title', 'meta', 'link',
]);

const DROP_ROLES = /^(navigation|banner|contentinfo|complementary|search|menu|menubar|dialog|alert|toolbar)$/i;

const BOILERPLATE =
  /(^|[\s_-])(cookie|consent|gdpr|newsletter|subscribe|signup|share|sharing|social|related|recommend|comments?|promo|advert|ads?|sponsor|banner|breadcrumbs?|sidebar|footer|masthead|navbar|nav|menu|skip-link|paywall|popup|modal)([\s_-]|$)/i;

const HEADING = /^h([1-6])$/;
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'main', 'header', 'body', 'html', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'figure', 'figcaption', 'details',
  'summary', 'dl', 'dt', 'dd', 'hr', 'address', 'center', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const ELEMENT = 1;
const TEXT = 3;

function shouldDrop(el: Element, stripBoilerplate: boolean): boolean {
  const tag = el.localName;
  if (DROP_TAGS.has(tag)) return true;
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.getAttribute('style') ?? '';
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
  const role = el.getAttribute('role');
  if (role && DROP_ROLES.test(role)) return true;
  if (stripBoilerplate) {
    if (tag === 'header' && el.parentElement?.localName === 'body') return true;
    if (tag !== 'body' && tag !== 'html' && tag !== 'main' && tag !== 'article') {
      const hint = `${el.getAttribute('class') ?? ''} ${el.id}`;
      if (BOILERPLATE.test(hint)) return true;
    }
  }
  return false;
}

/** Collapses whitespace in inline text while keeping explicit `<br>` line breaks. */
const cleanInline = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/[ \t\r\f\u00A0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

class Converter {
  private blocks: string[] = [];
  private inline = '';

  constructor(private stripBoilerplate: boolean) {}

  run(root: Node, childrenOnly = false): string {
    if (childrenOnly) for (const child of Array.from(root.childNodes)) this.walk(child);
    else this.walk(root);
    this.flush();
    return normalizeText(this.blocks.join('\n\n'));
  }

  private flush() {
    const text = cleanInline(this.inline);
    this.inline = '';
    if (text) this.blocks.push(text);
  }

  /** Text of an element, flattened to a single inline run (inline formatting stripped). */
  private inlineText(node: Node, preserve = false): string {
    if (node.nodeType === TEXT) {
      const t = node.textContent ?? '';
      return preserve ? t : t.replace(/\s+/g, ' ');
    }
    if (node.nodeType !== ELEMENT) return '';
    const el = node as Element;
    if (shouldDrop(el, this.stripBoilerplate)) return '';
    if (el.localName === 'br') return '\n';
    let out = '';
    for (const child of Array.from(el.childNodes)) {
      const part = this.inlineText(child, preserve || el.localName === 'pre');
      // Separate adjacent block-ish children (e.g. <p> inside <li>) with a space.
      out += child.nodeType === ELEMENT && BLOCK_TAGS.has((child as Element).localName) ? ` ${part} ` : part;
    }
    return out;
  }

  private walk(node: Node) {
    if (node.nodeType === TEXT) {
      this.inline += (node.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (node.nodeType !== ELEMENT && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType !== ELEMENT) {
      for (const child of Array.from(node.childNodes)) this.walk(child);
      return;
    }
    const el = node as Element;
    if (shouldDrop(el, this.stripBoilerplate)) return;
    const tag = el.localName;

    if (tag === 'br') { this.inline += '\n'; return; }
    if (!BLOCK_TAGS.has(tag)) {
      // Inline element (span, strong, em, a, code…) — plain text only.
      this.inline += this.inlineText(el);
      return;
    }

    this.flush();
    const heading = HEADING.exec(tag);
    if (heading) {
      const text = cleanInline(this.inlineText(el)).replace(/\n/g, ' ');
      if (text) this.blocks.push(`${'#'.repeat(Math.min(Number(heading[1]), 3))} ${text}`);
      return;
    }
    switch (tag) {
      case 'ul':
      case 'ol':
        this.list(el, 0);
        return;
      case 'blockquote': {
        // <footer>/<cite> inside a quote is its attribution, not page chrome.
        const copy = el.cloneNode(true) as Element;
        const attributionEl = copy.querySelector(':scope > footer, :scope > cite, :scope > p > cite:only-child');
        const attribution = attributionEl ? cleanInline(attributionEl.textContent ?? '').replace(/^[—–-]+\s*/, '') : '';
        attributionEl?.remove();
        const paras = new Converter(this.stripBoilerplate)
          .run(copy, true)
          .split(/\n{2,}/)
          .map((p) => p.split('\n').map((l) => l.replace(/^(?:>\s*)+|^#{1,6}\s+|^(?:[-*]|\d+[.)])\s+/, '')).join(' ').trim())
          .filter(Boolean);
        if (paras.length) {
          if (attribution) paras[paras.length - 1] += ` — ${attribution.replace(/\n/g, ' ')}`;
          this.blocks.push(paras.map((p) => `> ${p}`).join('\n'));
        }
        return;
      }
      case 'pre': {
        const text = (el.textContent ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
        if (text) this.blocks.push(text);
        return;
      }
      case 'table':
        this.table(el);
        return;
      case 'hr':
        return;
      default:
        for (const child of Array.from(el.childNodes)) this.walk(child);
        this.flush();
    }
  }

  private list(listEl: Element, depth: number) {
    const ordered = listEl.localName === 'ol';
    const startAttr = Number(listEl.getAttribute('start'));
    let n = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
    const lines: string[] = [];
    for (const li of Array.from(listEl.children)) {
      if (li.localName !== 'li' || shouldDrop(li, this.stripBoilerplate)) continue;
      const nested: Element[] = [];
      let text = '';
      for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === ELEMENT && /^(ul|ol)$/.test((child as Element).localName)) nested.push(child as Element);
        else text += this.inlineText(child);
      }
      const clean = cleanInline(text).replace(/\n/g, ' ');
      const indent = '  '.repeat(depth);
      if (clean) lines.push(`${indent}${ordered ? `${n++}.` : '-'} ${clean}`);
      for (const sub of nested) {
        const saved = this.blocks;
        this.blocks = [];
        this.list(sub, depth + 1);
        lines.push(...this.blocks);
        this.blocks = saved;
      }
    }
    if (lines.length) this.blocks.push(lines.join('\n'));
  }

  private table(table: Element) {
    const rows: string[] = [];
    for (const tr of Array.from(table.querySelectorAll('tr'))) {
      const cells = Array.from(tr.children)
        .filter((c) => c.localName === 'td' || c.localName === 'th')
        .map((c) => cleanInline(this.inlineText(c)).replace(/\n/g, ' '))
        .filter(Boolean);
      if (cells.length) rows.push(cells.join(' | '));
    }
    if (rows.length) this.blocks.push(rows.join('\n'));
  }
}

const CHROME =
  /(^|[\s_-])(cookies?|consent|gdpr|newsletter|subscribe|signup|share|sharing|social|promo|advert|ads|sponsored|paywall|popup|modal|skip-link)([\s_-]|$)/i;

/**
 * Removes high-confidence page chrome (cookie/consent banners, share bars, newsletter boxes,
 * dialogs) before article extraction, which otherwise sometimes keeps them.
 */
export function removePageChrome(doc: Document): void {
  for (const el of Array.from(doc.querySelectorAll('[class], [id], [role], dialog, [aria-modal]'))) {
    if (!el.isConnected || /^(html|body|main|article)$/.test(el.localName)) continue;
    const role = el.getAttribute('role') ?? '';
    const hint = `${el.getAttribute('class') ?? ''} ${el.id}`;
    if (el.localName === 'dialog' || el.getAttribute('aria-modal') === 'true' || /^(dialog|alertdialog)$/i.test(role) || CHROME.test(hint)) el.remove();
  }
}

/** Converts a DOM node (document, element or fragment) to markdown-ish text. */
export function domToMarkdown(root: Node, opts: HtmlToMarkdownOptions = {}): string {
  return new Converter(!!opts.stripBoilerplate).run(root);
}

/** Parses an HTML string and converts its body to markdown-ish text. */
export function htmlToMarkdown(html: string, opts: HtmlToMarkdownOptions = {}): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return domToMarkdown(doc.body ?? doc, opts);
}
