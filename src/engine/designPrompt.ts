// "Describe the look": turns a free-text design prompt ("dreamy pastel clay shapes with bouncy motion",
// "black and gold luxury, serif, no animation") into a carousel design. The built-in interpreter works
// offline and costs nothing; an AI model is only asked when the prompt uses words it doesn't know.
import { z } from 'zod';
import { fonts as allFonts, getPalette, getStyle, palettes, styles, type Palette } from '@/styles';
import { contrast, hexToRgb } from '@/styles/color';
import type { CarouselTheme, ContinuousStyle, DesignModifiers, PatternKind, TextureKind } from '@/model/types';
import { completeJson } from './generate';
import type { AIProvider } from './types';
import { pickVariations, type Variation } from './variations';
import type { CarouselPlan } from './schema';
import type { Tone } from './types';
import { cacheGet as aiCacheGet, cachePut as aiCachePut, hashKey } from './aiCache';

export type FontFeel = 'serif' | 'sans' | 'handwritten' | 'mono' | 'rounded' | 'condensed';

export interface DesignBrief {
  styleId?: string;
  scheme?: 'light' | 'dark';
  /** Wanted main hue in degrees (from color words). */
  hue?: number;
  /** Exact brand color from a hex code in the prompt. */
  primary?: string;
  moods?: string[];
  font?: FontFeel;
  texture?: TextureKind | 'none';
  pattern?: PatternKind | 'none';
  background?: DesignModifiers['background'];
  decoration?: DesignModifiers['decoration'];
  continuous?: ContinuousStyle | 'off';
  motion?: string;
  typeScale?: number;
  headlineCase?: 'none' | 'upper';
}

export interface Interpretation {
  brief: DesignBrief;
  /** Human-readable list of what was understood, e.g. ["Clay style", "pastel colors"]. */
  understood: string[];
  /** Words in the prompt that matched nothing (a hint that an AI model could help). */
  unknown: string[];
}

type Rule = [RegExp, (b: DesignBrief) => void, string];

const STYLE_WORDS: [RegExp, string, string][] = [
  [/\b(minimal(ist|ism)?|clean|simple|white ?space|understated|quiet)\b/, 'minimalism', 'Minimalism'],
  [/\b(maximal(ist|ism)?|loud|busy|chaotic|more is more|eclectic|clash(ing)?)\b/, 'maximalism', 'Maximalism'],
  [/\b(surreal(ism|ist)?|dream(y|like)?|ethereal|fantasy|magical|otherworldly|cosmic)\b/, 'surreal', 'Surreal'],
  [/\b(swiss|international (typographic )?style|helvetica|grid poster|bauhaus)\b/, 'swiss-poster', 'Swiss design'],
  [/\b(editorial|magazine|newspaper|news ?print|press|headline news|broadsheet)\b/, 'editorial-bold', 'Editorial'],
  [/\b(paper ?cut|paper|papercraft|craft paper|origami|layered paper|cut[- ]?out)\b/, 'paper-cut', 'Paper'],
  [/\b(clay(morphism)?|plasticine|puffy|squishy|soft 3d|3d|inflated)\b/, 'clay-3d', 'Clay'],
  [/\b(vector|flat (design|illustration)|illustrat(ed|ion)|geometric shapes?|flat)\b/, 'vector-art', 'Vector art'],
  [/\b(hand ?written|handwriting|bullet journal|journal|notebook|diary|doodles?|sketch(y|ed)?)\b/, 'handwritten-journal', 'Handwritten'],
  [/\b(graffiti|street( art)?|urban|spray( paint)?|hip[- ]?hop|tag(ging)?|mural)\b/, 'graffiti-street', 'Graffiti'],
  [/\b(luxury|luxurious|elegant|premium|high[- ]end|fashion)\b/, 'luxury-serif', 'Luxury'],
  [/\b(tech|developer|code|coding|terminal|hacker|cyber(punk)?|saas)\b/, 'dark-tech', 'Tech'],
  [/\b(glass(morphism)?|frosted|translucent)\b/, 'glassmorphism', 'Glass'],
  [/\b(synthwave|vaporwave|80s|outrun|retro grid)\b/, 'neo-retro-grid', 'Retro grid'],
  [/\b(retro|vintage|70s|print|risograph|riso)\b/, 'retro-print', 'Retro print'],
  [/\b(brutal(ist|ism)?|raw|anti[- ]design)\b/, 'brutalist', 'Brutalist'],
  [/\b(data|infographic|charts?|statistics|numbers)\b/, 'data-infographic', 'Data / infographic'],
  [/\b(tweet|twitter|x post|thread)\b/, 'tweet-style', 'Post / tweet'],
  [/\b(corporate|business|consulting|b2b|enterprise)\b/, 'corporate-clean', 'Corporate'],
  [/\b(pop art|comic|neo[- ]?pop|memphis)\b/, 'neo-pop', 'Neo pop'],
  [/\b(quotes?|quotation)\b/, 'quote-card', 'Quote cards'],
  [/\b(tutorial|how[- ]to|step[- ]by[- ]step|steps)\b/, 'step-tutorial', 'Step tutorial'],
  [/\b(gradient|vibrant gradient)\b/, 'bold-gradient', 'Bold gradient'],
  [/\b(pastel soft|soft pastel|cute|kawaii)\b/, 'pastel-soft', 'Pastel soft'],
];

const HUES: [RegExp, number, string][] = [
  [/\b(red|crimson|scarlet|cherry)\b/, 0, 'red'],
  [/\b(coral|salmon|peach)\b/, 14, 'coral'],
  [/\b(orange|tangerine|amber|rust|terracotta)\b/, 26, 'orange'],
  [/\b(brown|coffee|chocolate|earthy|earth)\b/, 24, 'brown'],
  [/\b(gold(en)?|mustard)\b/, 44, 'gold'],
  [/\b(yellow|lemon|sunny|sunshine)\b/, 52, 'yellow'],
  [/\b(lime|chartreuse)\b/, 85, 'lime'],
  [/\b(green|emerald|forest|leaf|nature|sage|olive)\b/, 140, 'green'],
  [/\b(mint)\b/, 155, 'mint'],
  [/\b(teal|turquoise|aqua)\b/, 175, 'teal'],
  [/\b(cyan|sky)\b/, 195, 'sky blue'],
  [/\b(blue|ocean|sea|cobalt|azure)\b/, 220, 'blue'],
  [/\b(navy|indigo)\b/, 235, 'navy'],
  [/\b(purple|violet|lavender|lilac|plum|grape)\b/, 270, 'purple'],
  [/\b(magenta|fuchsia)\b/, 305, 'magenta'],
  [/\b(pink|rose|blush|bubblegum)\b/, 335, 'pink'],
];

const TEXTURES: [RegExp, TextureKind, string][] = [
  [/\b(kraft|cardboard|brown paper)\b/, 'kraft', 'kraft card texture'],
  [/\b(crumpled|wrinkled)\b/, 'crumpled', 'crumpled paper texture'],
  [/\b(linen|fabric|cloth)\b/, 'linen', 'linen texture'],
  [/\b(canvas)\b/, 'canvas', 'canvas texture'],
  [/\b(watercolou?r|painted)\b/, 'watercolor', 'watercolor texture'],
  [/\b(concrete|cement|wall)\b/, 'concrete', 'concrete texture'],
  [/\b(stucco|plaster)\b/, 'stucco', 'stucco texture'],
  [/\b(grunge|grungy|distressed|worn)\b/, 'grunge', 'grunge texture'],
  [/\b(terrazzo|speckled)\b/, 'terrazzo', 'terrazzo texture'],
  [/\b(metal(lic)?|brushed|steel|chrome)\b/, 'brushed', 'brushed metal texture'],
  [/\b(grain(y)?|noise|film|riso grain)\b/, 'riso', 'grain'],
  [/\b(paper texture|textured paper)\b/, 'paper', 'paper texture'],
];

const PATTERNS: [RegExp, PatternKind, string][] = [
  [/\b(polka|dots|dotted)\b/, 'dots', 'dot pattern'],
  [/\b(grid|graph paper)\b/, 'grid', 'grid pattern'],
  [/\b(lined|ruled lines)\b/, 'lines', 'lined pattern'],
  [/\b(halftone)\b/, 'halftone', 'halftone pattern'],
  [/\b(wav(es|y))\b/, 'waves', 'wave pattern'],
  [/\b(checker(ed|board)?|chequered)\b/, 'checker', 'checker pattern'],
  [/\b(zig ?zag|chevron pattern)\b/, 'zigzag', 'zigzag pattern'],
  [/\b(stripes|striped)\b/, 'stripes', 'stripes'],
  [/\b(crosses|plus signs)\b/, 'crosses', 'cross pattern'],
  [/\b(rings|circles pattern)\b/, 'rings', 'ring pattern'],
  [/\b(triangles)\b/, 'triangles', 'triangle pattern'],
];

const RULES: Rule[] = [
  [/\b(dark( mode)?|black|night|midnight|noir|moody)\b/, (b) => (b.scheme = 'dark'), 'dark colors'],
  [/\b(light|white|bright|airy)\b/, (b) => (b.scheme ??= 'light'), 'light colors'],
  [/\b(pastel|soft colou?rs?|muted)\b/, (b) => (b.moods = [...(b.moods ?? []), 'pastel']), 'pastel colors'],
  [/\b(neon|electric|glow(ing)?)\b/, (b) => ((b.scheme ??= 'dark'), (b.moods = [...(b.moods ?? []), 'bold'])), 'neon colors'],
  [/\b(colou?rful|vibrant|rainbow|bright colou?rs)\b/, (b) => (b.moods = [...(b.moods ?? []), 'colorful']), 'colorful'],
  [/\b(warm|cosy|cozy)\b/, (b) => (b.moods = [...(b.moods ?? []), 'warm']), 'warm'],
  [/\b(calm|serene|peaceful)\b/, (b) => (b.moods = [...(b.moods ?? []), 'calm']), 'calm'],
  [/\b(professional|formal)\b/, (b) => (b.moods = [...(b.moods ?? []), 'professional']), 'professional'],
  [/\b(playful|fun|friendly)\b/, (b) => (b.moods = [...(b.moods ?? []), 'playful']), 'playful'],
  [/\b(serif)\b/, (b) => (b.font = 'serif'), 'serif type'],
  [/\b(sans[- ]?serif|sans|grotesk|grotesque)\b/, (b) => (b.font = 'sans'), 'sans-serif type'],
  [/\b(script|cursive|handwritten (font|type|letters))\b/, (b) => (b.font = 'handwritten'), 'handwritten type'],
  [/\b(mono(space)?|typewriter font)\b/, (b) => (b.font = 'mono'), 'monospace type'],
  [/\b(rounded|bubbly)\b/, (b) => (b.font = 'rounded'), 'rounded type'],
  [/\b(condensed|tall type|narrow)\b/, (b) => (b.font = 'condensed'), 'condensed type'],
  [/\b(huge|giant|big|large|oversized) (type|text|letters|headlines?|font)\b/, (b) => (b.typeScale = 1.2), 'big type'],
  [/\b(small|subtle|tiny) (type|text|headlines?)\b/, (b) => (b.typeScale = 0.88), 'smaller type'],
  [/\b(all caps|uppercase|capitals)\b/, (b) => (b.headlineCase = 'upper'), 'all caps headlines'],
  [/\b(plain|flat colou?r|solid colou?r|no background)\b/, (b) => ((b.background = 'plain'), (b.texture = 'none'), (b.pattern = 'none')), 'plain background'],
  [/\b(mesh gradient|aurora)\b/, (b) => (b.background = 'mesh'), 'mesh gradient'],
  [/\b(gradient)\b/, (b) => (b.background ??= 'gradient'), 'gradient background'],
  [/\b(radial|spotlight|glow background)\b/, (b) => (b.background = 'radial'), 'radial glow'],
  [/\b(no (decorations?|shapes)|undecorated)\b/, (b) => (b.decoration = 'none'), 'no decorations'],
  [/\b(lots of (shapes|decorations?|stickers)|decorated|ornate|rich)\b/, (b) => (b.decoration = 'rich'), 'rich decorations'],
  [/\b(no texture|smooth)\b/, (b) => (b.texture = 'none'), 'no texture'],
  [/\b(no pattern)\b/, (b) => (b.pattern = 'none'), 'no pattern'],
  [/\b(continuous|seamless|panorama|panoramic|connected slides|flows? across)\b/, (b) => (b.continuous ??= 'flow'), 'continuous slides'],
  [/\b(ribbon)\b/, (b) => (b.continuous = 'ribbon'), 'ribbon across slides'],
  [/\b(journey|road ?map|timeline path|path across)\b/, (b) => (b.continuous = 'path'), 'journey path across slides'],
  [/\b(giant word|big word across)\b/, (b) => (b.continuous = 'word'), 'giant word across slides'],
  [/\b(split shapes|shapes across)\b/, (b) => (b.continuous = 'blocks'), 'shapes split across slides'],
  [/\b(static|no (animation|motion)|still)\b/, (b) => (b.motion = 'none'), 'no animation'],
  [/\b(kinetic|word by word|animated (text|type)|moving type)\b/, (b) => (b.motion = 'kinetic'), 'kinetic type'],
  [/\b(typewriter|typing)\b/, (b) => (b.motion = 'typewriter'), 'typewriter animation'],
  [/\b(bouncy|bounce|lively|energetic|playful motion)\b/, (b) => (b.motion = 'lively'), 'lively motion'],
  [/\b(subtle (motion|animation)|gentle|slow fades?)\b/, (b) => (b.motion = 'subtle'), 'subtle motion'],
  [/\b(squash|squishy motion)\b/, (b) => (b.motion = 'clay'), 'clay motion'],
  [/\b(drift(ing)?|floating|float)\b/, (b) => (b.motion = 'dreamy'), 'floating motion'],
];

/** Words that carry no design meaning (ignored when deciding whether an AI model could help). */
const FILLER = new Set('a an and the with of in on for to make it look style design carousel slides slide please me some very more less but not like using use feel vibe theme colors colours colour color type font fonts text background backgrounds animation motion shapes look-and-feel is are be that this mood tone i want would love lots little bit kind sort'.split(' '));

/** Offline, deterministic: reads a design prompt into a brief. */
export function interpretPrompt(prompt: string): Interpretation {
  const text = ` ${prompt.toLowerCase().replace(/[^\p{L}\p{N}#\s-]/gu, ' ')} `;
  const brief: DesignBrief = {};
  const understood: string[] = [];
  const used = new Set<string>();
  const take = (re: RegExp) => {
    const m = text.match(new RegExp(re.source, 'g'));
    m?.forEach((w) => w.split(/\s+/).forEach((x) => used.add(x)));
    return Boolean(m);
  };

  // Style: the first family named wins (users name the main look first).
  let bestAt = Infinity;
  for (const [re, id, label] of STYLE_WORDS) {
    const m = re.exec(text);
    if (m && m.index < bestAt) {
      bestAt = m.index;
      brief.styleId = id;
      understood[0] = `${label} style`;
    }
    take(re);
  }
  for (const [re, hue, label] of HUES) {
    if (take(re) && brief.hue === undefined) {
      brief.hue = hue;
      understood.push(`${label} colors`);
    }
  }
  const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(prompt);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split('').map((c) => c + c).join('') : hex[1]!;
    brief.primary = `#${h.toUpperCase()}`;
    used.add(`#${hex[1]!.toLowerCase()}`);
    understood.push(`brand color ${brief.primary}`);
  }
  for (const [re, kind, label] of TEXTURES) {
    if (take(re) && !brief.texture) {
      brief.texture = kind;
      understood.push(label);
    }
  }
  for (const [re, kind, label] of PATTERNS) {
    if (take(re) && !brief.pattern) {
      brief.pattern = kind;
      understood.push(label);
    }
  }
  for (const [re, fn, label] of RULES) {
    if (take(re)) {
      fn(brief);
      understood.push(label);
    }
  }

  const unknown = [...new Set(text.split(/\s+/).filter((w) => w.length > 2 && !used.has(w) && !FILLER.has(w)))];
  return { brief, understood: [...new Set(understood.filter(Boolean))], unknown };
}

// ---- brief → theme -----------------------------------------------------------------------------

function hueOf(hex: string): { h: number; s: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1) || 1) };
}

const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function scorePalette(p: Palette, brief: DesignBrief, preferred: string[]): number {
  let s = preferred.includes(p.id) ? 1.5 - preferred.indexOf(p.id) * 0.1 : 0;
  if (brief.scheme) s += p.scheme === brief.scheme ? 2.5 : -2.5;
  if (brief.moods) s += brief.moods.filter((m) => p.moods.includes(m)).length * 0.8;
  const target = brief.hue ?? (brief.primary ? hueOf(brief.primary).h : undefined);
  if (target !== undefined) {
    const best = Math.min(...[p.colors.primary, p.colors.accent].map((c) => {
      const { h, s: sat } = hueOf(c);
      return sat < 0.15 ? 180 : hueDist(h, target);
    }));
    s += 3 * (1 - best / 180) - (best > 40 ? 1 : 0);
  }
  return s;
}

const FONT_FEELS: Record<FontFeel, { heading: string; body: string }> = {
  serif: { heading: 'fraunces', body: 'source-serif-4' },
  sans: { heading: 'plus-jakarta-sans', body: 'inter' },
  handwritten: { heading: 'caveat', body: 'nunito' },
  mono: { heading: 'jetbrains-mono', body: 'ibm-plex-sans' },
  rounded: { heading: 'fredoka', body: 'nunito' },
  condensed: { heading: 'bebas-neue', body: 'inter' },
};

const fontMatches = (id: string, feel: FontFeel) => {
  const f = allFonts.find((x) => x.id === id);
  if (!f) return false;
  return feel === 'serif' ? f.category === 'serif' : feel === 'sans' ? f.category === 'sans-serif' : feel === 'handwritten' ? f.category === 'handwriting' : feel === 'mono' ? f.category === 'monospace' : feel === 'rounded' ? ['fredoka', 'nunito', 'quicksand', 'baloo-2', 'comfortaa'].includes(id) : f.group === 'display-condensed';
};

/** Builds a complete theme from a brief (style defaults fill whatever the prompt didn't say). */
export function themeFromBrief(brief: DesignBrief, fallbackStyleId: string, handle?: string): CarouselTheme {
  const style = getStyle(brief.styleId ?? fallbackStyleId);
  const pool = [...style.palettes.map(getPalette), ...palettes.filter((p) => !style.palettes.includes(p.id))];
  const palette = pool.reduce((best, p) => (scorePalette(p, brief, style.palettes) > scorePalette(best, brief, style.palettes) ? p : best), pool[0]!);
  let customPalette: CarouselTheme['customPalette'];
  if (brief.primary) {
    const c = palette.colors;
    if (contrast(brief.primary, c.bg) >= 3) customPalette = { ...c, primary: brief.primary };
    else customPalette = { ...c, accent: brief.primary };
  }
  // Fonts: the style's own pairing unless the prompt asked for a different kind of type.
  const pairs = [style.fonts, ...style.altFonts];
  const fontPick = brief.font ? pairs.find((f) => fontMatches(f.heading, brief.font!)) ?? FONT_FEELS[brief.font] : style.fonts;
  const m: DesignModifiers = {};
  if (brief.texture) m.texture = brief.texture;
  if (brief.pattern) m.pattern = brief.pattern;
  if (brief.background) m.background = brief.background;
  if (brief.decoration) m.decoration = brief.decoration;
  if (brief.typeScale) m.typeScale = brief.typeScale;
  if (brief.headlineCase) m.headlineCase = brief.headlineCase;
  if (brief.continuous === 'off') m.panoramic = false;
  else if (brief.continuous) Object.assign(m, { panoramic: true, continuous: brief.continuous });
  const theme: CarouselTheme = {
    styleId: style.id,
    paletteId: palette.id,
    headingFont: fontPick.heading,
    bodyFont: fontPick.body,
    handle,
    ...(customPalette ? { customPalette } : {}),
    ...(Object.keys(m).length ? { modifiers: m } : {}),
    ...(brief.motion ? { motion: brief.motion } : {}),
  };
  theme.label = `${style.name} · ${customPalette ? 'Your color' : palette.name}`;
  return theme;
}

/** Applies the prompt's non-style wishes (texture, motion, continuous…) to another theme. */
export function applyBriefExtras(theme: CarouselTheme, brief: DesignBrief): CarouselTheme {
  const extras = themeFromBrief({ ...brief, styleId: theme.styleId }, theme.styleId);
  const recolor = Boolean(brief.scheme || brief.hue !== undefined || brief.primary);
  const next: CarouselTheme = {
    ...theme,
    modifiers: { ...theme.modifiers, ...extras.modifiers },
    ...(brief.motion ? { motion: brief.motion } : {}),
    ...(recolor ? { paletteId: extras.paletteId, customPalette: extras.customPalette } : {}),
  };
  if (recolor) next.label = `${getStyle(theme.styleId).name} · ${next.customPalette ? 'Your color' : getPalette(next.paletteId).name}`;
  return next;
}

// ---- optional AI interpretation (one small "quick task" call, cached) --------------------------

const AIBriefSchema = z.object({
  styleId: z.enum(styles.map((s) => s.id) as [string, ...string[]]),
  scheme: z.enum(['light', 'dark', 'any']),
  mainColor: z.string().describe('Main color as #RRGGBB, or "" if the prompt names none'),
  font: z.enum(['style', 'serif', 'sans', 'handwritten', 'mono', 'rounded', 'condensed']),
  texture: z.enum(['style', 'none', 'paper', 'kraft', 'crumpled', 'linen', 'canvas', 'watercolor', 'concrete', 'stucco', 'grunge', 'terrazzo', 'brushed', 'riso']),
  pattern: z.enum(['style', 'none', 'dots', 'grid', 'lines', 'halftone', 'waves', 'checker', 'zigzag', 'stripes', 'crosses', 'rings', 'triangles']),
  continuous: z.enum(['style', 'off', 'flow', 'ribbon', 'path', 'blocks', 'word']),
  motion: z.enum(['style', 'none', 'subtle', 'lively', 'typewriter', 'kinetic', 'minimal', 'maximal', 'dreamy', 'swiss', 'editorial', 'paper', 'clay', 'vector', 'handwritten', 'graffiti']),
});

const AI_SYSTEM = () => `You map a short design request for a social media carousel to design settings. Return JSON only.
Styles (pick the closest styleId):
${styles.map((s) => `- ${s.id}: ${s.description}`).join('\n')}
Use "style" to keep a style's default for texture/pattern/continuous/motion/font. Never invent ids.`;

const cacheGet = (prompt: string) => aiCacheGet<DesignBrief>('design', hashKey(prompt)) ?? null;
const cachePut = (prompt: string, brief: DesignBrief) => aiCachePut('design', hashKey(prompt), brief, 100);

/** Should we spend an AI call on this prompt? Only when the offline reading missed meaningful words. */
export const needsAI = (it: Interpretation) => it.unknown.length > 0 && (!it.brief.styleId || it.unknown.length >= 3);

/**
 * Interprets the prompt with an AI model (fast tier). The offline reading is merged on top, so explicit
 * words (a hex color, "no animation") always win. Results are cached per prompt: asking twice is free.
 */
export async function interpretPromptWithAI(prompt: string, provider: AIProvider, signal?: AbortSignal): Promise<Interpretation> {
  const offline = interpretPrompt(prompt);
  const key = prompt.trim().toLowerCase();
  let ai = cacheGet(key);
  if (!ai) {
    const { value } = await completeJson(provider, AI_SYSTEM(), { role: 'user', content: prompt.slice(0, 600) }, AIBriefSchema, undefined, signal, 'fast');
    const color = /^#[0-9a-f]{6}$/i.test(value.mainColor) ? value.mainColor.toUpperCase() : undefined;
    ai = {
      styleId: value.styleId,
      ...(value.scheme !== 'any' ? { scheme: value.scheme } : {}),
      ...(color ? { hue: hueOf(color).h } : {}),
      ...(value.font !== 'style' ? { font: value.font } : {}),
      ...(value.texture !== 'style' ? { texture: value.texture } : {}),
      ...(value.pattern !== 'style' ? { pattern: value.pattern } : {}),
      ...(value.continuous !== 'style' ? { continuous: value.continuous } : {}),
      ...(value.motion !== 'style' ? { motion: value.motion } : {}),
    };
    cachePut(key, ai);
  }
  const brief = { ...ai, ...offline.brief, styleId: offline.brief.styleId ?? ai.styleId };
  return { brief, understood: [...offline.understood, ...(offline.brief.styleId ? [] : [`${getStyle(brief.styleId!).name} style (AI)`])], unknown: [] };
}

/**
 * Designs for a plan that follow a design prompt: the first is built straight from the brief; the others
 * are distinct styles (for comparison) that still honor its texture, motion, colors and continuity wishes.
 */
export function variationsFromBrief(plan: CarouselPlan, brief: DesignBrief, opts: { count: number; tone: Tone; seed?: number; handle?: string }): Variation[] {
  const base = pickVariations(plan, { ...opts, preferStyleId: brief.styleId });
  const first = themeFromBrief(brief, brief.styleId ?? base[0]!.theme.styleId, opts.handle);
  const others = base.filter((v) => v.theme.styleId !== first.styleId).slice(0, Math.max(0, opts.count - 1));
  return [{ theme: first, label: first.label! }, ...others.map((v) => {
    const theme = applyBriefExtras(v.theme, brief);
    return { theme, label: theme.label ?? v.label };
  })];
}

/** The 10 design families offered as one-click starting points for the prompt. */
export const STYLE_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Minimalism', prompt: 'minimalist, lots of white space, quiet colors, slow fades' },
  { label: 'Maximalism', prompt: 'maximalist, loud clashing colors, stickers and confetti shapes, bouncy motion' },
  { label: 'Surreal', prompt: 'surreal dreamy gradients, floating spheres, soft serif, drifting motion' },
  { label: 'Swiss', prompt: 'swiss design, visible grid, huge tight grotesk type, red accent' },
  { label: 'Editorial', prompt: 'editorial magazine, newspaper masthead, serif headlines, italic accents' },
  { label: 'Paper', prompt: 'paper cut layers with shadows, warm paper texture' },
  { label: 'Clay', prompt: 'clay 3D, puffy pastel shapes, rounded type, squishy motion' },
  { label: 'Vector art', prompt: 'flat vector illustration, hills and sun, geometric shapes, bright colors' },
  { label: 'Handwritten', prompt: 'handwritten bullet journal, dot grid, doodles, typewriter motion' },
  { label: 'Graffiti', prompt: 'graffiti street art, spray paint drips, dark wall, neon colors' },
];
