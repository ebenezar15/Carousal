// No-AI fallback: turns raw text/markdown into a CarouselPlan with deterministic rules derived
// from research/design-patterns.json. Always available, fully offline.
import { detectLanguage, phrasesFor } from './phrases';
import { SCRIPTURE_REF } from './art/topics';
import { patterns } from '@/styles';
import { emptySlide, type CarouselPlan, type SlidePlan } from './schema';
import { clampWords, packSentences, pickEmphasis, sentences, stripMarkdown, wordCount } from './text';
import type { GenerateOptions } from './types';
import { normalizePlan } from './normalize';

type Block =
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'para'; text: string }
  | { kind: 'bullets'; items: string[]; ordered: boolean }
  | { kind: 'quote'; text: string; attribution: string };

const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;

export function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'para', text: stripMarkdown(para.join(' ')) });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ kind: 'heading', text: stripMarkdown(h[2]!), level: h[1]!.length }); continue; }
    if (BULLET.test(line)) {
      flush();
      const item = stripMarkdown(line.replace(BULLET, ''));
      const last = blocks[blocks.length - 1];
      const ordered = /^\s*\d/.test(line);
      if (last?.kind === 'bullets') last.items.push(item);
      else blocks.push({ kind: 'bullets', items: [item], ordered });
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      const text = stripMarkdown(line.replace(/^>\s*/, ''));
      const m = /^(.*?)\s+[—–-]{1,2}\s*([^—–-]{2,60})$/.exec(text);
      blocks.push({ kind: 'quote', text: (m ? m[1]! : text).replace(/^["“]|["”]$/g, ''), attribution: m ? m[2]!.trim() : '' });
      continue;
    }
    // A short line followed by text, ending without punctuation, reads like a heading.
    para.push(line);
  }
  flush();
  // Promote short unpunctuated single-line paragraphs to headings; a Bible verse with its reference
  // ("“…” — John 3:16", "John 3:16 — …", "… (Psalm 23:1 NIV)") becomes a scripture quote.
  return blocks.map((b) => {
    if (b.kind !== 'para') return b;
    const verse = scriptureQuote(b.text);
    if (verse) return { kind: 'quote', ...verse };
    return wordCount(b.text) <= 10 && !/[.!?:]$/.test(b.text) && !SCRIPTURE_REF.test(b.text) ? { kind: 'heading', text: b.text, level: 2 } : b;
  });
}

const REF = SCRIPTURE_REF.source;
const VERSION = String.raw`(?:\s(?:KJV|NIV|ESV|NKJV|NLT|NASB|CSB|WEB|ASV|MSG|AMP|NRSV|RSV))?`;
const VERSE_AFTER = new RegExp(String.raw`^["“]?(.{12,400}?)["”]?\s*(?:[—–-]{1,2}\s*|\(\s*)${REF}${VERSION}\)?\.?$`);
const VERSE_BEFORE = new RegExp(String.raw`^${REF}${VERSION}\s*[:—–-]{1,2}\s*["“]?(.{12,400}?)["”]?$`);

/** A paragraph that is a Bible verse plus its reference, split into text and reference. */
export function scriptureQuote(text: string): { text: string; attribution: string } | null {
  const a = VERSE_AFTER.exec(text.trim());
  if (a) {
    const ref = text.trim().slice(a[1]!.length).match(SCRIPTURE_REF);
    if (ref) return { text: a[1]!.trim().replace(/^["“]|["”]$/g, ''), attribution: ref[1]!.trim() };
  }
  const b = VERSE_BEFORE.exec(text.trim());
  if (b) return { text: b[2]!.trim().replace(/^["“]|["”]$/g, ''), attribution: b[1]!.trim() };
  return null;
}

const STAT_RE = /(\$?\d[\d,.]*\s?(?:%|x|k|m|bn|million|billion|percent|hours?|days?|minutes?)?)/i;

/** Turns one sentence into a headline (≤ max words) and the remainder of the sentence. */
function headlineFrom(sentence: string, max: number): { headline: string; rest: string } {
  const s = sentence.trim();
  if (wordCount(s) <= max) return { headline: s.replace(/[.]$/, ''), rest: '' };
  const clause = /^(.{8,}?)[,:;—–]\s+(.*)$/.exec(s);
  if (clause && wordCount(clause[1]!) <= max) return { headline: clause[1]!, rest: clause[2]! };
  return { headline: clampWords(s, max), rest: s };
}

function slidesFromParagraph(text: string, heading: string | null): SlidePlan[] {
  const r = patterns.roles.body;
  const sents = sentences(text);
  if (!sents.length) return [];
  // Short, number-led paragraph → stat slide.
  const first = sents[0]!;
  const stat = STAT_RE.exec(first);
  if (stat && wordCount(text) <= patterns.roles.stat.maxWords + 5 && stat.index < 25) {
    const s = emptySlide('stat', heading ?? clampWords(first.replace(stat[0], '').trim(), patterns.roles.stat.headlineMaxWords));
    s.stat = { value: stat[0].trim(), label: clampWords(first.replace(stat[0], '').trim(), 10) };
    s.body = clampWords(sents.slice(1).join(' '), patterns.roles.stat.bodyMaxWords);
    return [s];
  }
  let headline: string;
  let restSents: string[];
  if (heading) {
    headline = clampWords(heading, r.headlineMaxWords + 2);
    restSents = sents;
  } else {
    const h = headlineFrom(first, r.headlineMaxWords + 2);
    headline = h.headline;
    restSents = h.rest && h.rest !== first ? [h.rest, ...sents.slice(1)] : sents.slice(1);
  }
  const chunks = packSentences(restSents, r.bodyMaxWords);
  if (!chunks.length) return [emptySlide('body', headline)];
  return chunks.map((c, i) => emptySlide('body', i === 0 ? headline : `${headline} (cont.)`, c));
}

function slidesFromBullets(items: string[], ordered: boolean, heading: string | null): SlidePlan[] {
  const max = patterns.roles.list.maxBullets;
  const out: SlidePlan[] = [];
  // Ordered lists with substantial items become step slides; otherwise list slides of ≤ max bullets.
  if (ordered && items.every((i) => wordCount(i) > 6) && items.length <= 8) {
    items.forEach((item, i) => {
      const h = headlineFrom(item, patterns.roles.step.headlineMaxWords);
      const s = emptySlide('step', `${i + 1}. ${h.headline}`, clampWords(h.rest === item ? '' : h.rest, patterns.roles.step.bodyMaxWords));
      out.push(s);
    });
    return out;
  }
  for (let i = 0; i < items.length; i += max) {
    const s = emptySlide('list', heading ? clampWords(heading, patterns.roles.list.headlineMaxWords) : 'Key points');
    s.bullets = items.slice(i, i + max).map((b) => clampWords(b, 10));
    if (i > 0) s.headline += ' (cont.)';
    out.push(s);
  }
  return out;
}

export function planFromText(input: string, opts: GenerateOptions): CarouselPlan {
  const blocks = parseBlocks(input);
  const firstHeading = blocks.find((b) => b.kind === 'heading') as Extract<Block, { kind: 'heading' }> | undefined;
  const firstPara = blocks.find((b) => b.kind === 'para') as Extract<Block, { kind: 'para' }> | undefined;
  const titleSource = firstHeading?.text ?? (firstPara ? sentences(firstPara.text)[0] : input.trim().slice(0, 120)) ?? 'Untitled';
  const title = clampWords(titleSource, patterns.roles.hook.headlineMaxWords).replace(/\.$/, '');

  const hook = emptySlide('hook', title);
  const content: SlidePlan[] = [];
  let pendingHeading: string | null = null;
  let consumedTitle = false;

  for (const b of blocks) {
    if (b.kind === 'heading') {
      if (!consumedTitle && b === firstHeading) { consumedTitle = true; continue; }
      pendingHeading = b.text;
      continue;
    }
    if (b.kind === 'para') {
      let text = b.text;
      // If the title came from this paragraph's first sentence, don't repeat it.
      if (!firstHeading && b === firstPara && !consumedTitle) {
        consumedTitle = true;
        const rest = sentences(text).slice(1);
        if (!hook.body && rest.length && wordCount(rest[0]!) <= patterns.roles.hook.bodyMaxWords) {
          hook.body = rest.shift()!;
        }
        text = rest.join(' ');
        if (!text) continue;
      }
      content.push(...slidesFromParagraph(text, pendingHeading));
    } else if (b.kind === 'bullets') {
      content.push(...slidesFromBullets(b.items, b.ordered, pendingHeading));
    } else {
      const q = emptySlide('quote', '');
      q.quote = { text: clampWords(b.text, patterns.roles.quote.bodyMaxWords), attribution: b.attribution };
      content.push(q);
    }
    pendingHeading = null;
  }

  const language = opts.language === 'auto' ? detectLanguage(input) : opts.language;
  const words = phrasesFor(language);
  hook.emphasis = pickEmphasis(hook.headline);
  content.forEach((s) => { if (!s.emphasis.length) s.emphasis = pickEmphasis(s.headline); });
  // Faith content: mark prayers and scripture so layouts and illustrations can treat them specially.
  content.forEach((s) => {
    if (/^(a )?(prayer|let'?s pray|pray with me|lord,|father,|dear god)\b/i.test(`${s.headline} ${s.body}`.trim())) {
      s.layoutHint = 'prayer';
      s.iconKeywords = ['hands-praying'];
    } else if (s.quote?.attribution && SCRIPTURE_REF.test(s.quote.attribution)) s.layoutHint = 'verse';
  });

  const cta = emptySlide('cta', words.ctaHeadline, words.ctaBody);
  cta.emphasis = pickEmphasis(words.ctaHeadline);
  const fallbackSubline = !hook.body;

  const plan = normalizePlan(
    {
      title,
      language,
      paletteMood: opts.tone === 'playful' ? 'playful' : opts.tone === 'bold' ? 'bold' : 'professional',
      slides: [hook, ...content, cta],
      caption: clampWords(title, 20),
      hashtags: [],
    },
    opts,
  );
  // Hook subline fallback: promise the payoff, counted after trimming to the platform's slide limit.
  const middle = plan.slides.filter((s) => s.role !== 'hook' && s.role !== 'cta').length;
  const first = plan.slides[0];
  if (fallbackSubline && first?.role === 'hook' && middle >= 3) first.body = words.ideas.replace('{n}', String(middle));
  return plan;
}
