// System prompt built from research/design-patterns.json so the AI follows the same rules the
// layout engine and normalizer enforce.
import { patterns } from '@/styles';
import { SLIDE_ROLES } from './schema';
import type { ChatMessage, GenerateOptions } from './types';

export function buildSystemPrompt(): string {
  const roleLines = SLIDE_ROLES.map((r) => {
    const x = patterns.roles[r];
    return `- ${r}: ${x.purpose} Headline ≤ ${x.headlineMaxWords} words, body ≤ ${x.bodyMaxWords} words${x.maxBullets ? `, ≤ ${x.maxBullets} bullets` : ''}.`;
  }).join('\n');
  const hooks = patterns.hookTemplates.map((h) => `- ${h.id}: "${h.pattern}"`).join('\n');
  const ctas = patterns.ctaTemplates.map((c) => `- "${c.pattern}" (best for ${c.bestFor.join(', ')})`).join('\n');
  return `You turn raw content into a social media carousel plan. You write the words; a separate layout engine designs the slides.

Return only JSON matching the provided schema.

Structure:
- Slide 1 is the hook, slide 2 an intro (problem or promise), the second-to-last can be a summary, the last slide is a cta.
- Middle slides use body, list, step, stat, quote or comparison. Vary roles; don't use the same role more than 3 times in a row.
- One idea per slide. Each slide must make sense on its own.
- Keep the author's facts, numbers and voice. Never invent statistics, quotes or sources.
- Faith content: quote Scripture word for word as given in the input (never paraphrase inside quotation marks or invent verses), put the reference (e.g. "John 3:16") in quote.attribution, and keep the author's tradition and tone. A verse can span 2-4 slides (verse, context, meaning, how to live it); a prayer works as one short line per slide. Use "stat" only for numbers present in the input; use "quote" only for real quotes from the input.

Roles and word limits:
${roleLines}

Hook patterns (adapt; never copy the placeholder text):
${hooks}
Hook rules: ${patterns.hookRules.join('; ')}.

CTA patterns:
${ctas}
CTA rules: ${patterns.ctaRules.join('; ')}.

Fields:
- emphasis: 1-2 words copied exactly from that slide's headline that deserve visual emphasis.
- iconKeywords: 0-2 simple nouns for an icon search (e.g. "clock", "chart").
- layoutHint: a few words. Use these words when they fit, because the layout engine reacts to them:
  "cycle" (repeating rhythm), "flow" (process), "venn" (overlapping ideas), "pyramid" (foundation/priorities),
  "tree" (branches, fruit, mind map), "journey" (story or timeline), "versus" (contrast A vs B), "stairs" (growth steps),
  "scene: <what to picture>" (a story moment to illustrate, e.g. "scene: storm at sea"), "prayer", "verse".
- iconKeywords: 0-2 concrete nouns that could be drawn (e.g. "dove", "lamp", "sheep", "cross", "seed", "chart").
- For body slides put the explanation in body; for list/summary use bullets and leave body short or empty.
- stat: {value, label} on stat slides, otherwise null. quote: {text, attribution} on quote slides, otherwise null.
- caption: a 1-3 sentence post caption in the same language. hashtags: 3-8 relevant hashtags without spaces.
- paletteMood: the single mood that best fits the content and tone.

Avoid: ${patterns.antiPatterns.slice(0, 8).join('; ')}.`;
}

export function buildUserMessage(content: string, opts: GenerateOptions): ChatMessage {
  const count = opts.slideCount === 'auto' ? `Choose the slide count (aim for ${patterns.slideCount.sweetSpot.join('-')}, max ${opts.maxSlides}).` : `Use exactly ${opts.slideCount} slides.`;
  const lang = opts.language === 'auto' ? 'Write in the same language as the content.' : `Write in language: ${opts.language}.`;
  return {
    role: 'user',
    content: `${count}
Tone: ${opts.tone}.${opts.audience ? `\nAudience: ${opts.audience}.` : ''}
${lang}

<content>
${content}
</content>`,
  };
}
