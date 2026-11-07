// "What kind of carousel?": the structure the author wants (a doctrine explainer, a sermon recap, myth vs
// truth, a Bible story…). The type steers the AI's writing (an instruction in the prompt), shapes the
// offline rules plan (roles, layout hints, kicker labels) and suggests matching templates.
import type { CarouselPlan, SlidePlan } from './schema';
import type { GenerateOptions } from './types';

export type TypeGroup = 'faith' | 'teach' | 'story' | 'business';

export interface CarouselType {
  id: string;
  label: string;
  group: TypeGroup;
  /** One line shown under the chip. */
  description: string;
  /** Words in a free-text brief that point to this type. */
  match: RegExp;
  /** Told to the AI model (how to structure the slides). */
  instruction: string;
  /** Kicker label prefix for numbered middle slides offline ("CLAIM" → "CLAIM 01"). */
  kicker?: string;
  /** Layout hint added to middle slides offline (diagrams/illustrations react to it). */
  hint?: string;
  /** Roles to turn middle slides into offline, cycling (e.g. myth vs truth → comparison). */
  roles?: SlidePlan['role'][];
  /** Illustration density that suits this type (used when a template doesn't say). */
  illustrations?: 'none' | 'some' | 'rich' | 'story';
  /** Template tags that fit this type (templates gallery suggestions). */
  tags: string[];
}

export const CAROUSEL_TYPES: CarouselType[] = [
  // ---- Faith ----
  {
    id: 'doctrine-explainer', label: 'Doctrine explainer', group: 'faith',
    description: 'A doctrine or heresy explained claim by claim, each with Scripture.',
    match: /\b(doctrin\w*|heres\w*|theolog\w*|trinity|orthodox\w*|creed|nicene|arian\w*|modalism|adoptionism|gnostic\w*|christolog\w*|soteriolog\w*|systematic)\b/i,
    instruction: 'Structure: a bold cover claim; a slide that lists the 3 key questions (numbered list); then one slide per error or claim with a short, punchy uppercase-style headline that states the truth (e.g. "Jesus did not become God."), one or two sentences of explanation, and the supporting verse as quote with its reference; a summary; a cta. Fill kicker on every slide with "TOPIC / SHORT SUBTITLE" (e.g. "ADOPTIONISM / THE MAN WHO BECAME GOD"). Emphasize the last, decisive word of each headline.',
    kicker: 'CLAIM', tags: ['theology', 'editorial', 'doctrine'], illustrations: 'some',
  },
  {
    id: 'church-history', label: 'Church history', group: 'faith',
    description: 'Councils, people and turning points told in order.',
    match: /\b(church history|early church|council|nicaea|reformation|church fathers?|martyrs?|century|centuries|schism|apostolic|history of)\b/i,
    instruction: 'Structure as a timeline: a dramatic cover; then events in chronological order, one per slide, with the year or century in kicker (e.g. "AD 325 / NICAEA"), what happened in the headline and why it mattered in the body; use layoutHint "journey" on overview slides; end with the lesson for today and a cta.',
    kicker: 'CHAPTER', hint: 'journey', tags: ['history', 'theology', 'editorial'], illustrations: 'some',
  },
  {
    id: 'myth-vs-truth', label: 'Myth vs truth', group: 'faith',
    description: 'Common misconceptions answered one by one.',
    match: /\b(myths?|misconceptions?|lies?|mistaken|wrong about|actually|objections?|apologetic\w*|debunk\w*|truth)\b/i,
    instruction: 'Structure: a cover that names the misconceptions; then for each one a comparison slide whose headline is "Myth vs truth" style (layoutHint "versus: <myth> vs <truth>"), the myth in the first bullet and the truth in the second; add the verse or source in the body when the input has one; end with a summary and a cta. Kicker: "MYTH 01", "MYTH 02"…',
    kicker: 'MYTH', hint: 'versus', roles: ['comparison'], tags: ['apologetics', 'bold', 'editorial'],
  },
  {
    id: 'verse-breakdown', label: 'Verse breakdown', group: 'faith',
    description: 'One verse unpacked across several slides.',
    match: /\b(verse|scripture|passage|breakdown|unpack\w*|meaning of|exegesis|psalm \d+|john \d+|romans \d+)\b/i,
    instruction: 'Structure: the verse itself on the cover or slide 2 (quote word for word with its reference); then context, key phrase by key phrase (one per slide, the phrase in quotes as the headline), what it means, how to live it; close with the full verse again and a cta. layoutHint "verse" on verse slides.',
    kicker: 'PHRASE', hint: 'verse', tags: ['scripture', 'calm'], illustrations: 'some',
  },
  {
    id: 'sermon-recap', label: 'Sermon recap', group: 'faith',
    description: "Sunday's message: big idea, points, application.",
    match: /\b(sermon|message|preach\w*|pastor|sunday|homily|recap|series)\b/i,
    instruction: 'Structure: cover with the sermon title; the big idea; the main points (one per slide, numbered in kicker "POINT 01"), each with its verse; an application slide ("This week, try…"); a short prayer line; a cta to watch or share.',
    kicker: 'POINT', tags: ['sermon', 'modern', 'church'],
  },
  {
    id: 'bible-story', label: 'Bible story', group: 'story',
    description: 'A story told scene by scene with pictures.',
    match: /\b(story of|bible story|parable|david and goliath|noah|moses|exodus|jonah|daniel|esther|ruth|nativity|prodigal|good samaritan|kids?|children|sunday school)\b/i,
    instruction: 'Tell it as a story, one scene per slide in order: setting, problem, turning point, resolution, lesson. Short sentences. Give every slide a layoutHint "scene: <what to picture>" (e.g. "scene: storm at sea"). End with the lesson and a cta.',
    kicker: 'SCENE', hint: 'scene: story', tags: ['story', 'kids', 'illustrated'], illustrations: 'story',
  },
  {
    id: 'character-study', label: 'Bible character study', group: 'faith',
    description: 'Who they were, key moments, what we learn.',
    match: /\b(character study|life of|who was|abraham|joseph|paul|peter|mary|elijah|gideon|samson|deborah|apostle)\b/i,
    instruction: 'Structure: cover with the name and a hook; who they were (context); 3-4 key moments in order (kicker with the reference, layoutHint "journey" for the overview); their weakness and God\'s faithfulness; lessons for us; a cta.',
    kicker: 'MOMENT', hint: 'journey', tags: ['story', 'editorial', 'illustrated'], illustrations: 'rich',
  },
  {
    id: 'word-study', label: 'Greek / Hebrew word study', group: 'faith',
    description: 'One original-language word and what it reveals.',
    match: /\b(greek|hebrew|word study|original (language|word)|agape|logos|shalom|hesed|chesed|koinonia|grace means)\b/i,
    instruction: 'Structure: cover with the English word and the original word; the original word with transliteration and literal meaning; where it is used (verses as quotes); how it changes the reading; a summary; a cta. Kicker "WORD STUDY".',
    kicker: 'WORD STUDY', tags: ['scripture', 'editorial', 'minimal'],
  },
  {
    id: 'devotional', label: 'Devotional', group: 'faith',
    description: 'A short reflection with a verse and a takeaway.',
    match: /\b(devotion\w*|reflection|encourag\w*|quiet time|daily bread|morning|hope|anxiety|peace|rest)\b/i,
    instruction: 'Structure: a gentle, honest cover; the verse; 3-4 reflection slides with one thought each (short lines, room to breathe); a takeaway question; a one-line prayer; a cta.',
    tags: ['devotional', 'calm', 'soft'], illustrations: 'some',
  },
  {
    id: 'prayer-guide', label: 'Prayer guide', group: 'faith',
    description: 'A prayer, one line per slide.',
    match: /\b(pray\w*|intercession|liturgy|petition|lord'?s prayer|acts prayer)\b/i,
    instruction: 'Structure: a cover inviting the reader to pray; then the prayer one short line or movement per slide (layoutHint "prayer"); a closing "Amen" slide; a cta to save it.',
    hint: 'prayer', tags: ['prayer', 'night', 'calm'],
  },
  {
    id: 'catechism-qa', label: 'Q&A / catechism', group: 'faith',
    description: 'Questions people ask, answered plainly.',
    match: /\b(q&a|faq|questions?|catechism|ask(ed)?|answers?|why does|what is|how can)\b/i,
    instruction: 'Structure: a cover naming the big question; then one question per slide as the headline (ending with "?") and a short, direct answer in the body with a verse when given; a summary; a cta. Kicker "QUESTION 01", "QUESTION 02"…',
    kicker: 'QUESTION', tags: ['qa', 'editorial', 'minimal'],
  },
  {
    id: 'reading-plan', label: 'Reading plan', group: 'faith',
    description: 'Day-by-day readings to follow.',
    match: /\b(reading plan|read through|day \d+|\d+[- ]day|bible in a year|plan)\b/i,
    instruction: 'Structure: cover with the plan name and length; one slide per day or week with the passage as headline and a one-line focus; a checklist-style summary; a cta to save it.',
    kicker: 'DAY', roles: ['step'], tags: ['plan', 'clean', 'checklist'],
  },
  {
    id: 'testimony', label: 'Testimony', group: 'story',
    description: 'Before, the turning point, after.',
    match: /\b(testimony|my story|how god|turning point|before and after|saved me|came to faith)\b/i,
    instruction: 'Tell it in first person: before (the struggle), the turning point, after (what changed), the verse that carried them, an invitation. One beat per slide, short lines.',
    hint: 'journey', tags: ['story', 'warm'], illustrations: 'some',
  },
  {
    id: 'event-promo', label: 'Church event', group: 'faith',
    description: 'What, when, where, why come.',
    match: /\b(event|join us|conference|retreat|service|easter|christmas|vbs|camp|register|rsvp|gathering)\b/i,
    instruction: 'Structure: cover with the event name; why it matters; what happens (list); when and where (one clear slide); who it is for; a cta to register or come.',
    tags: ['event', 'bold', 'modern'],
  },
  // ---- Teaching / general ----
  {
    id: 'listicle', label: 'List of tips', group: 'teach',
    description: 'N tips, ideas or reasons, one per slide.',
    match: /\b(\d+\s+(tips|ways|ideas|reasons|things|lessons|habits|mistakes)|tips|ideas|reasons|list)\b/i,
    instruction: 'Structure: a cover that promises the number ("7 ways to…"); one tip per slide, numbered in the kicker, with a short headline and one sentence of how/why; a recap list; a cta.',
    kicker: 'TIP', tags: ['list', 'bold', 'clean'],
  },
  {
    id: 'how-to', label: 'Step-by-step', group: 'teach',
    description: 'A process taught in clear steps.',
    match: /\b(how to|step[- ]by[- ]step|steps?|guide|tutorial|process|walkthrough)\b/i,
    instruction: 'Structure: cover with the result; why it matters; one step per slide (role step, kicker "STEP 01"), each with an action headline and a one-line detail; common mistake; a recap; a cta.',
    kicker: 'STEP', roles: ['step'], hint: 'flow', tags: ['tutorial', 'clean'],
  },
  {
    id: 'framework', label: 'Framework / model', group: 'teach',
    description: 'A model explained with a diagram.',
    match: /\b(framework|model|system|pillars?|principles?|cycle|pyramid|hierarchy|matrix)\b/i,
    instruction: 'Structure: cover naming the framework; one overview slide with the whole model (layoutHint "cycle", "pyramid", "flow" or "venn" as it fits); one slide per part; how to use it; a cta.',
    hint: 'flow', tags: ['diagram', 'tech', 'clean'],
  },
  {
    id: 'comparison', label: 'This vs that', group: 'teach',
    description: 'Two options compared side by side.',
    match: /\b(vs\.?|versus|compared?|comparison|difference between|or\b.*\?)\b/i,
    instruction: 'Structure: cover posing the choice; comparison slides (layoutHint "versus: A vs B") for each dimension; a verdict; a cta.',
    roles: ['comparison'], hint: 'versus', tags: ['comparison', 'bold'],
  },
  {
    id: 'timeline', label: 'Timeline', group: 'teach',
    description: 'Events or milestones in order.',
    match: /\b(timeline|milestones?|journey|roadmap|evolution|over the years|since \d{4})\b/i,
    instruction: 'Structure: cover; milestones in order, the date in kicker and what happened in the headline (layoutHint "journey" on overview slides); what is next; a cta.',
    kicker: 'MILESTONE', hint: 'journey', tags: ['history', 'editorial'],
  },
  {
    id: 'data-story', label: 'Data story', group: 'business',
    description: 'Numbers that tell a story.',
    match: /\b(data|stats?|statistics|numbers|survey|research|percent|%|report)\b/i,
    instruction: 'Structure: cover with the most surprising number; one stat per slide (role stat, only numbers from the input); what it means; a takeaway; a cta. Never invent numbers.',
    roles: ['stat'], tags: ['data', 'tech'],
  },
  {
    id: 'case-study', label: 'Case study', group: 'business',
    description: 'Problem, approach, result.',
    match: /\b(case study|client|results?|before|after|we helped|growth)\b/i,
    instruction: 'Structure: cover with the result; the situation; the problem; what was done (steps); the results (stats only from the input); the lesson; a cta.',
    tags: ['business', 'clean'],
  },
  {
    id: 'quote-series', label: 'Quote collection', group: 'teach',
    description: 'Quotes or verses, one per slide.',
    match: /\b(quotes?|sayings|wisdom|proverbs?|verses about|said)\b/i,
    instruction: 'Structure: a cover naming the theme; one quote per slide (role quote, word for word, with attribution); a closing reflection; a cta.',
    roles: ['quote'], tags: ['quote', 'minimal', 'scripture'],
  },
  {
    id: 'mistakes', label: 'Mistakes to avoid', group: 'teach',
    description: 'What goes wrong and what to do instead.',
    match: /\b(mistakes?|avoid|don'?t|stop doing|wrong|pitfalls?|red flags?)\b/i,
    instruction: 'Structure: cover ("N mistakes…"); one mistake per slide: the mistake as headline, the fix in the body (or "versus" hint: mistake vs fix); a recap checklist; a cta.',
    kicker: 'MISTAKE', tags: ['bold', 'list'],
  },
  {
    id: 'checklist', label: 'Checklist', group: 'teach',
    description: 'Things to do or check, saveable.',
    match: /\b(checklist|check list|to-?do|before you|must-haves?|essentials)\b/i,
    instruction: 'Structure: cover; checklist slides (role list, 3-5 short items each); a "save this" summary; a cta.',
    roles: ['list'], tags: ['checklist', 'clean'],
  },
];

export const AUTO_TYPE = 'auto';

export const getCarouselType = (id: string | undefined) => CAROUSEL_TYPES.find((t) => t.id === id);

export interface CarouselBrief {
  typeId: string;
  slideCount?: number;
  series?: string;
  /** What was understood, for the UI. */
  understood: string[];
}

/**
 * Reads a free-text "what kind of carousel" brief offline: the best-matching type (most matching words,
 * faith types first on ties), an explicit slide count ("10 slides") and a series name ("series: …").
 */
export function readCarouselBrief(text: string, pickedType = AUTO_TYPE): CarouselBrief {
  const t = text.trim();
  const understood: string[] = [];
  let typeId = pickedType;
  if (t && pickedType === AUTO_TYPE) {
    let best: { id: string; n: number } | null = null;
    for (const ct of CAROUSEL_TYPES) {
      const n = (t.match(new RegExp(ct.match.source, 'gi')) ?? []).length;
      if (n && (!best || n > best.n)) best = { id: ct.id, n };
    }
    if (best) typeId = best.id;
  }
  const type = getCarouselType(typeId);
  if (type) understood.push(type.label);
  const count = /\b(\d{1,2})\s*(?:-\s*)?(?:slides?|pages?|cards?|frames?)\b/i.exec(t);
  const slideCount = count ? Math.min(20, Math.max(3, Number(count[1]))) : undefined;
  if (slideCount) understood.push(`${slideCount} slides`);
  const ser = /\bseries(?: name| title)?\s*[:=–-]\s*["“]?([^"”\n.]{3,48})/i.exec(t) ?? /\bpart of (?:the |a |my )?["“]?([^"”\n.]{3,40}?)["”]? series\b/i.exec(t);
  const series = ser?.[1]?.trim();
  if (series) understood.push(`series “${series}”`);
  return { typeId, slideCount, series, understood };
}

/** Lines added to the AI user message for a chosen type and the author's own brief. */
export function typeInstructions(opts: Pick<GenerateOptions, 'carouselType' | 'carouselBrief'>): string {
  const type = getCarouselType(opts.carouselType);
  const lines: string[] = [];
  if (type) lines.push(`Carousel type: ${type.label}. ${type.instruction}`);
  if (opts.carouselBrief?.trim()) lines.push(`The author describes the carousel they want (follow it where it doesn't conflict with the rules): ${opts.carouselBrief.trim().slice(0, 600)}`);
  return lines.join('\n');
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Shapes a plan to the chosen type without AI: numbered kicker labels, layout hints and roles on the
 * middle slides. Anything the plan already has (an AI's own kickers and hints) is kept.
 */
export function shapeForType(plan: CarouselPlan, typeId: string | undefined): CarouselPlan {
  const type = getCarouselType(typeId);
  if (!type) return plan;
  let n = 0;
  const slides = plan.slides.map((s, i): SlidePlan => {
    const middle = i > 0 && i < plan.slides.length - 1 && s.role !== 'summary' && s.role !== 'cta';
    if (!middle) return s;
    n++;
    const out = { ...s };
    if (type.kicker && !out.kicker?.trim()) out.kicker = type.kicker === 'WORD STUDY' ? type.kicker : `${type.kicker} ${pad(n)}`;
    if (type.hint && !out.layoutHint.trim()) out.layoutHint = type.hint;
    if (type.roles && ['body', 'intro', 'list'].includes(out.role)) {
      const role = type.roles[(n - 1) % type.roles.length]!;
      // Only where the content fits the role: comparisons need two sides, stats a number, quotes a quote.
      if (role === 'comparison' && out.bullets.length >= 2) out.role = role;
      else if (role === 'step' || role === 'list') out.role = role === 'list' && !out.bullets.length ? out.role : role;
      else if (role === 'stat' && out.stat) out.role = role;
      else if (role === 'quote' && out.quote) out.role = role;
    }
    if (type.id === 'catechism-qa' && out.headline && !/[?？]$/.test(out.headline) && /^(what|why|how|who|when|where|is|are|can|does|do|should|will)\b/i.test(out.headline)) out.headline += '?';
    return out;
  });
  return { ...plan, slides };
}
