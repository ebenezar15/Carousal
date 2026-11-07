// Built-in carousel templates: named, ready-to-use designs grouped by what they're for. Each template is
// a style system plus a palette, a font pairing and design modifiers (art treatment, light/dark rhythm,
// texture, illustration amount…), so one style yields several clearly different looks. Families were
// shaped by what works in faith and education carousels online (see research/template-inspiration.md);
// every template is original — no layouts, artwork or wording copied from any creator.
import type { CarouselTheme, DesignModifiers } from '@/model/types';
import { findFont, getPalette, getStyle } from './index';

export type TemplateCategory =
  | 'theology' | 'history' | 'apologetics' | 'scripture' | 'devotional' | 'sermon' | 'kids' | 'worship'
  | 'education' | 'business' | 'tech' | 'lifestyle';

export const TEMPLATE_CATEGORIES: [TemplateCategory, string][] = [
  ['theology', 'Theology & doctrine'], ['history', 'Church history'], ['apologetics', 'Apologetics'], ['scripture', 'Scripture & verses'],
  ['devotional', 'Devotional & prayer'], ['sermon', 'Sermons & church'], ['kids', 'Bible stories & kids'], ['worship', 'Worship, youth & events'],
  ['education', 'Education'], ['business', 'Business'], ['tech', 'Tech & data'], ['lifestyle', 'Lifestyle'],
];

export const FAITH_CATEGORIES: TemplateCategory[] = ['theology', 'history', 'apologetics', 'scripture', 'devotional', 'sermon', 'kids', 'worship'];

export interface CarouselTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  styleId: string;
  paletteId: string;
  headingFont: string;
  bodyFont: string;
  modifiers?: DesignModifiers;
  /** Carousel types (engine/carouselTypes.ts) this template suits best. */
  types: string[];
}

/** [name, paletteId, "heading/body" fonts or '', modifiers] */
type V = [string, string, string?, DesignModifiers?];

interface Family { category: TemplateCategory; styleId: string; types: string[]; mods?: DesignModifiers; variants: V[] }

const FAMILIES: Family[] = [
  // ---------------- Theology & doctrine ----------------
  {
    category: 'theology', styleId: 'theology-editorial', types: ['doctrine-explainer', 'catechism-qa', 'word-study', 'myth-vs-truth', 'church-history'],
    variants: [
      ['Early Church · Ink & Crimson', 'codex-crimson'],
      ['Creed · Olive Press', 'codex-olive'],
      ['Councils · Navy Ledger', 'codex-navy'],
      ['Church Fathers · Vellum Gold', 'vellum-gold'],
      ['Doctrine · Oswald Cut', 'codex-crimson', 'oswald/eb-garamond'],
      ['Heresies · Type Only', 'codex-crimson', '', { illustrations: 'none' }],
      ['Trinity · Line Plates', 'codex-navy', '', { art: 'line' }],
      ['Christology · Duotone', 'codex-olive', '', { art: 'duotone' }],
      ['Theology · All Cream', 'codex-crimson', '', { rhythm: 'none' }],
      ['Systematics · Barlow', 'vellum-gold', 'barlow-condensed/cormorant-garamond'],
      ['Doctrine · Rich Plates', 'codex-crimson', '', { illustrations: 'rich' }],
    ],
  },
  {
    category: 'theology', styleId: 'doctrine-noir', types: ['doctrine-explainer', 'myth-vs-truth', 'catechism-qa'],
    variants: [
      ['Noir · Ember Word', 'codex-noir'],
      ['Noir · Wine Cellar', 'jewel-wine'],
      ['Noir · Furnace', 'ember-noir'],
      ['Noir · Anton Heavy', 'codex-noir', 'anton/eb-garamond'],
      ['Noir · Silhouettes', 'ember-noir', '', { art: 'silhouette' }],
      ['Noir · Story Plates', 'codex-noir', '', { illustrations: 'rich' }],
      ['Noir · Condensed Serif', 'jewel-wine', 'roboto-condensed/cormorant-garamond'],
    ],
  },
  {
    category: 'theology', styleId: 'catechism-qa', types: ['catechism-qa', 'doctrine-explainer', 'word-study'],
    variants: [
      ['Catechism · Navy Card', 'codex-navy'],
      ['Catechism · Ivory', 'scripture-ivory'],
      ['Catechism · Bone', 'bone-minimal'],
      ['Q&A · Newsreader', 'codex-navy', 'newsreader/inter'],
      ['Q&A · Crimson Ink', 'codex-crimson'],
      ['Q&A · Night Library', 'codex-noir'],
      ['Q&A · Baskerville', 'scripture-ivory', 'libre-baskerville/ibm-plex-sans'],
    ],
  },
  {
    category: 'theology', styleId: 'blueprint-study', types: ['framework', 'word-study', 'doctrine-explainer', 'how-to'],
    variants: [
      ['Bible Study · Blueprint', 'blueprint-ink'],
      ['Bible Study · Chalkboard', 'chalk-slate'],
      ['Bible Study · Navy Grid', 'codex-navy'],
      ['Bible Study · Plex', 'blueprint-ink', 'ibm-plex-sans/ibm-plex-mono'],
      ['Bible Study · Diagram Lab', 'chalk-slate', '', { illustrations: 'none' }],
    ],
  },
  // ---------------- Church history ----------------
  {
    category: 'history', styleId: 'history-timeline', types: ['church-history', 'timeline', 'character-study'],
    variants: [
      ['Chronicle · Kraft', 'codex-crimson'],
      ['Chronicle · Sepia', 'parchment-sepia'],
      ['Chronicle · Woodcut', 'woodcut-red'],
      ['Chronicle · League Gothic', 'parchment-sepia', 'league-gothic/libre-baskerville'],
      ['Chronicle · Big Shoulders', 'codex-crimson', 'big-shoulders-display/source-serif-4'],
      ['Chronicle · Night Archive', 'codex-noir'],
      ['Chronicle · Linen', 'codex-olive', '', { texture: 'linen' }],
      ['Chronicle · Alternating', 'codex-crimson', '', { rhythm: 'alternate' }],
    ],
  },
  {
    category: 'history', styleId: 'engraved-classic', types: ['church-history', 'character-study', 'bible-story', 'doctrine-explainer'],
    variants: [
      ['Engraving · Vellum', 'vellum-gold'],
      ['Engraving · Crimson Plate', 'codex-crimson'],
      ['Engraving · Sepia', 'parchment-sepia'],
      ['Engraving · Baskerville', 'vellum-gold', 'libre-baskerville/lora'],
      ['Engraving · Cormorant', 'parchment-sepia', 'cormorant-garamond/eb-garamond'],
      ['Engraving · Night Plate', 'codex-noir'],
      ['Engraving · Alternating', 'codex-crimson', '', { rhythm: 'alternate' }],
    ],
  },
  {
    category: 'history', styleId: 'manuscript-codex', types: ['verse-breakdown', 'church-history', 'quote-series', 'prayer-guide'],
    variants: [
      ['Manuscript · Vermilion', 'manuscript-red'],
      ['Manuscript · Gold Leaf', 'vellum-gold'],
      ['Manuscript · Sepia', 'parchment-sepia'],
      ['Manuscript · Marcellus', 'manuscript-red', 'marcellus/cormorant-garamond'],
      ['Manuscript · Engraved', 'vellum-gold', '', { art: 'engraving' }],
      ['Manuscript · Plain Vellum', 'vellum-gold', '', { illustrations: 'none' }],
    ],
  },
  // ---------------- Apologetics ----------------
  {
    category: 'apologetics', styleId: 'apologetics-verdict', types: ['myth-vs-truth', 'comparison', 'mistakes'],
    variants: [
      ['Verdict · Yellow Alert', 'verdict-yellow'],
      ['Verdict · Black Box', 'verdict-black'],
      ['Verdict · Red Ink', 'woodcut-red'],
      ['Verdict · Bebas', 'verdict-yellow', 'bebas-neue/inter'],
      ['Verdict · Gothic', 'verdict-black', 'league-gothic/work-sans'],
      ['Verdict · Concrete', 'brutal-concrete'],
      ['Verdict · Acid', 'brutal-acid'],
    ],
  },
  {
    category: 'apologetics', styleId: 'woodcut-poster', types: ['myth-vs-truth', 'doctrine-explainer', 'bible-story', 'event-promo'],
    variants: [
      ['Linocut · Red Ink', 'woodcut-red'],
      ['Linocut · Crimson Cream', 'codex-crimson'],
      ['Linocut · Black', 'verdict-black'],
      ['Linocut · Bebas', 'woodcut-red', 'bebas-neue/eb-garamond'],
      ['Linocut · Kraft', 'kraft-paper'],
      ['Linocut · Engraved', 'codex-crimson', '', { art: 'engraving' }],
    ],
  },
  {
    category: 'apologetics', styleId: 'brutalist', types: ['myth-vs-truth', 'mistakes', 'comparison'],
    variants: [
      ['Raw Truth · Concrete', 'brutal-concrete'],
      ['Raw Truth · Acid', 'brutal-acid'],
      ['Raw Truth · Yellow', 'neo-pop-yellow'],
    ],
  },
  // ---------------- Scripture & verses ----------------
  {
    category: 'scripture', styleId: 'scripture-serif', types: ['verse-breakdown', 'quote-series', 'devotional'],
    variants: [
      ['Verse · Ivory Frame', 'scripture-ivory'],
      ['Verse · Sage', 'scripture-sage'],
      ['Verse · Cream', 'editorial-cream'],
      ['Verse · Indigo Night', 'night-indigo'],
      ['Verse · Rose', 'hymn-rose'],
      ['Verse · Gold Leaf', 'vellum-gold'],
      ['Verse · Engraved', 'scripture-ivory', '', { art: 'engraving', illustrations: 'rich' }],
    ],
  },
  {
    category: 'scripture', styleId: 'minimal-verse', types: ['verse-breakdown', 'quote-series', 'prayer-guide', 'devotional'],
    variants: [
      ['Gallery · Bone', 'bone-minimal'],
      ['Gallery · Ivory', 'scripture-ivory'],
      ['Gallery · Noir', 'codex-noir'],
      ['Gallery · Cormorant', 'bone-minimal', 'cormorant-garamond/inter'],
      ['Gallery · Newsreader', 'scripture-ivory', 'newsreader/karla'],
      ['Gallery · Fog', 'nordic-fog'],
      ['Gallery · Stone', 'minimal-stone'],
      ['Gallery · Alternating', 'bone-minimal', '', { rhythm: 'alternate' }],
    ],
  },
  {
    category: 'scripture', styleId: 'quote-card', types: ['quote-series', 'verse-breakdown'],
    variants: [
      ['Verse Card · Charcoal', 'quote-charcoal'],
      ['Verse Card · Emerald', 'luxury-emerald'],
      ['Verse Card · Sepia', 'parchment-sepia'],
      ['Verse Card · Sage', 'scripture-sage'],
    ],
  },
  {
    category: 'scripture', styleId: 'parchment', types: ['verse-breakdown', 'bible-story', 'character-study'],
    variants: [
      ['Parchment · Sepia', 'parchment-sepia'],
      ['Parchment · Kraft', 'kraft-paper'],
      ['Parchment · Ivory', 'scripture-ivory'],
      ['Parchment · Vellum', 'vellum-gold'],
      ['Parchment · Engraved Plates', 'parchment-sepia', '', { art: 'engraving', illustrations: 'rich' }],
    ],
  },
  {
    category: 'scripture', styleId: 'stained-glass', types: ['verse-breakdown', 'quote-series', 'event-promo'],
    variants: [
      ['Stained Glass · Jewel Night', 'jewel-night'],
      ['Stained Glass · Wine', 'jewel-wine'],
      ['Stained Glass · Indigo', 'night-indigo'],
      ['Stained Glass · Violet', 'worship-violet'],
      ['Stained Glass · Cinzel Cormorant', 'jewel-night', 'cinzel/cormorant-garamond'],
    ],
  },
  // ---------------- Devotional & prayer ----------------
  {
    category: 'devotional', styleId: 'night-prayer', types: ['prayer-guide', 'devotional'],
    variants: [
      ['Vigil · Indigo', 'night-indigo'],
      ['Vigil · Ember', 'night-ember'],
      ['Vigil · Dusk', 'surreal-dusk'],
      ['Vigil · Teal Water', 'worship-teal'],
      ['Vigil · Noir', 'codex-noir'],
      ['Vigil · Line Drawings', 'night-indigo', '', { art: 'line', illustrations: 'some' }],
    ],
  },
  {
    category: 'devotional', styleId: 'sunday-light', types: ['devotional', 'sermon-recap', 'event-promo'],
    variants: [
      ['Morning · Warm', 'sunday-warm'],
      ['Morning · Sky', 'sunday-sky'],
      ['Morning · Sage', 'scripture-sage'],
      ['Morning · Peach', 'pastel-peach'],
      ['Morning · Mint', 'pastel-mint'],
    ],
  },
  {
    category: 'devotional', styleId: 'hymn-sheet', types: ['prayer-guide', 'devotional', 'quote-series'],
    variants: [
      ['Hymnal · Rose', 'hymn-rose'],
      ['Hymnal · Ivory', 'scripture-ivory'],
      ['Hymnal · Sepia', 'parchment-sepia'],
      ['Hymnal · Prata', 'hymn-rose', 'prata/lora'],
      ['Hymnal · Playfair', 'scripture-ivory', 'playfair-display/lora'],
    ],
  },
  {
    category: 'devotional', styleId: 'pastel-soft', types: ['devotional', 'listicle'],
    variants: [
      ['Gentle · Lilac', 'pastel-lilac'],
      ['Gentle · Sky', 'pastel-sky'],
      ['Gentle · Butter', 'butter-cream'],
    ],
  },
  {
    category: 'devotional', styleId: 'luxury-serif', types: ['devotional', 'quote-series'],
    variants: [
      ['Grace · Gold', 'luxury-gold'],
      ['Grace · Emerald', 'luxury-emerald'],
      ['Grace · Blush', 'blush-luxe'],
    ],
  },
  // ---------------- Sermons & church ----------------
  {
    category: 'sermon', styleId: 'sermon-notes', types: ['sermon-recap', 'reading-plan', 'checklist'],
    variants: [
      ['Notes · Ivory', 'scripture-ivory'],
      ['Notes · Warm', 'sunday-warm'],
      ['Notes · Sunny', 'kids-sun'],
      ['Notes · Patrick Hand', 'scripture-ivory', 'patrick-hand/karla'],
      ['Notes · Kraft', 'kraft-paper'],
    ],
  },
  {
    category: 'sermon', styleId: 'church-swiss', types: ['sermon-recap', 'event-promo', 'listicle', 'doctrine-explainer'],
    variants: [
      ['Swiss · Bone', 'bone-minimal'],
      ['Swiss · Red', 'woodcut-red'],
      ['Swiss · Navy', 'codex-navy'],
      ['Swiss · Inter', 'bone-minimal', 'inter/inter'],
      ['Swiss · Graphite', 'mono-graphite'],
      ['Swiss · Static', 'bone-minimal', '', { rhythm: 'none' }],
    ],
  },
  {
    category: 'sermon', styleId: 'editorial-bold', types: ['sermon-recap', 'doctrine-explainer', 'church-history'],
    variants: [
      ['Sermon Paper · Newsprint', 'editorial-newsprint'],
      ['Sermon Paper · Cream', 'editorial-cream'],
      ['Sermon Paper · Noir', 'editorial-noir'],
    ],
  },
  {
    category: 'sermon', styleId: 'bold-gradient', types: ['sermon-recap', 'event-promo'],
    variants: [
      ['Sermon Series · Sunset', 'sunset-gradient'],
      ['Sermon Series · Lagoon', 'gradient-lagoon'],
      ['Sermon Series · Candy', 'gradient-candy'],
    ],
  },
  // ---------------- Bible stories & kids ----------------
  {
    category: 'kids', styleId: 'sunday-school', types: ['bible-story', 'character-study', 'checklist'],
    variants: [
      ['Kids · Sky', 'kids-sky'],
      ['Kids · Sunshine', 'kids-sun'],
      ['Kids · Meadow', 'storybook-meadow'],
      ['Kids · Fredoka', 'kids-sky', 'fredoka/nunito'],
      ['Kids · Chewy', 'kids-sun', 'chewy/quicksand'],
    ],
  },
  {
    category: 'kids', styleId: 'bible-comic', types: ['bible-story', 'testimony'],
    variants: [
      ['Comic · Pop', 'comic-pop'],
      ['Comic · Sunset', 'storybook-sunset'],
      ['Comic · Meadow', 'storybook-meadow'],
      ['Comic · Luckiest', 'comic-pop', 'luckiest-guy/nunito'],
    ],
  },
  {
    category: 'kids', styleId: 'illustrated-story', types: ['bible-story', 'character-study', 'testimony'],
    variants: [
      ['Storybook · Meadow', 'storybook-meadow'],
      ['Storybook · Sunset', 'storybook-sunset'],
      ['Storybook · Sky', 'sunday-sky'],
      ['Storybook · Peach', 'pastel-peach'],
    ],
  },
  {
    category: 'kids', styleId: 'vector-art', types: ['bible-story', 'how-to', 'listicle'], mods: { illustrations: 'story' },
    variants: [
      ['Flat Story · Sky', 'vector-sky'],
      ['Flat Story · Forest', 'vector-forest'],
      ['Flat Story · Citrus', 'citrus-fresh'],
    ],
  },
  {
    category: 'kids', styleId: 'clay-3d', types: ['bible-story', 'listicle'],
    variants: [
      ['Clay Story · Lilac', 'clay-lilac'],
      ['Clay Story · Peach', 'clay-peach'],
    ],
  },
  {
    category: 'kids', styleId: 'paper-cut', types: ['bible-story', 'devotional'],
    variants: [
      ['Paper Story · Sunset', 'paper-sunset'],
      ['Paper Story · Ocean', 'paper-ocean'],
      ['Paper Story · Kraft', 'kraft-paper'],
    ],
  },
  // ---------------- Worship, youth & events ----------------
  {
    category: 'worship', styleId: 'worship-night', types: ['event-promo', 'devotional', 'quote-series'],
    variants: [
      ['Worship · Violet', 'worship-violet'],
      ['Worship · Teal', 'worship-teal'],
      ['Worship · Jewel', 'jewel-night'],
      ['Worship · Syne', 'worship-violet', 'syne/outfit'],
      ['Worship · Sora', 'worship-teal', 'sora/manrope'],
    ],
  },
  {
    category: 'worship', styleId: 'glassmorphism', types: ['event-promo', 'devotional'],
    variants: [
      ['Glass Night · Aurora', 'glass-aurora'],
      ['Glass Night · Frost', 'glass-frost'],
    ],
  },
  {
    category: 'worship', styleId: 'maximalism', types: ['event-promo', 'listicle'],
    variants: [
      ['Festival · Carnival', 'maximal-carnival'],
      ['Festival · Night', 'maximal-night'],
    ],
  },
  {
    category: 'worship', styleId: 'neo-pop', types: ['event-promo', 'listicle', 'catechism-qa'],
    variants: [
      ['Youth · Yellow', 'neo-pop-yellow'],
      ['Youth · Pink', 'neo-pop-pink'],
      ['Youth · Blue', 'neo-pop-blue'],
    ],
  },
  {
    category: 'worship', styleId: 'graffiti-street', types: ['event-promo', 'testimony'],
    variants: [
      ['Youth Street · Wall', 'graffiti-wall'],
      ['Youth Street · Concrete', 'graffiti-concrete'],
    ],
  },
  {
    category: 'worship', styleId: 'retro-print', types: ['event-promo', 'church-history'],
    variants: [
      ['Revival · Retro Print', 'retro-print'],
      ['Revival · 70s Sun', 'seventies-sun'],
      ['Revival · Diner', 'retro-diner'],
    ],
  },
  // ---------------- Education ----------------
  {
    category: 'education', styleId: 'step-tutorial', types: ['how-to', 'checklist', 'reading-plan'],
    variants: [
      ['Tutorial · Teal', 'tutorial-teal'],
      ['Tutorial · Orange', 'tutorial-orange'],
      ['Tutorial · Sky', 'pastel-sky'],
      ['Tutorial · Slate', 'corporate-slate'],
    ],
  },
  {
    category: 'education', styleId: 'hand-drawn-notes', types: ['how-to', 'listicle', 'framework'],
    variants: [
      ['Sketch Notes · Paper', 'notes-paper'],
      ['Sketch Notes · Kraft', 'kraft-paper'],
      ['Sketch Notes · Butter', 'butter-cream'],
    ],
  },
  {
    category: 'education', styleId: 'handwritten-journal', types: ['devotional', 'listicle', 'testimony'],
    variants: [
      ['Journal · Cream', 'journal-cream'],
      ['Journal · Notes', 'notes-paper'],
      ['Journal · Kraft', 'kraft-paper'],
    ],
  },
  {
    category: 'education', styleId: 'editorial-magazine', types: ['timeline', 'listicle', 'quote-series'],
    variants: [
      ['Magazine · Cream', 'editorial-cream'],
      ['Magazine · Noir', 'editorial-noir'],
      ['Magazine · Ink', 'paper-ink'],
      ['Magazine · Blush', 'blush-luxe'],
    ],
  },
  {
    category: 'education', styleId: 'minimalism', types: ['listicle', 'framework', 'quote-series'],
    variants: [
      ['Minimal · Stone', 'minimal-stone'],
      ['Minimal · Fog', 'nordic-fog'],
      ['Minimal · Graphite', 'mono-graphite'],
      ['Minimal · Ink', 'paper-ink'],
    ],
  },
  // ---------------- Business ----------------
  {
    category: 'business', styleId: 'corporate-clean', types: ['case-study', 'framework', 'data-story'],
    variants: [
      ['Corporate · Navy', 'corporate-navy'],
      ['Corporate · Slate', 'corporate-slate'],
      ['Corporate · Forest', 'forest-trust'],
      ['Corporate · Data', 'data-clean'],
    ],
  },
  {
    category: 'business', styleId: 'minimal-swiss', types: ['listicle', 'framework', 'case-study'],
    variants: [
      ['Swiss Grid · Red', 'swiss-red'],
      ['Swiss Grid · Ink', 'paper-ink'],
      ['Swiss Grid · Fog', 'nordic-fog'],
      ['Swiss Grid · Graphite', 'mono-graphite'],
    ],
  },
  {
    category: 'business', styleId: 'swiss-poster', types: ['listicle', 'event-promo'],
    variants: [
      ['Poster · Classic', 'swiss-poster'],
      ['Poster · Red', 'swiss-red'],
      ['Poster · Graphite', 'mono-graphite'],
    ],
  },
  {
    category: 'business', styleId: 'tweet-style', types: ['quote-series', 'mistakes', 'listicle'],
    variants: [
      ['Post · Light', 'tweet-light'],
      ['Post · Dim', 'tweet-dim'],
      ['Post · Graphite', 'mono-graphite'],
    ],
  },
  {
    category: 'business', styleId: 'panoramic-flow', types: ['timeline', 'how-to', 'case-study'],
    variants: [
      ['Panorama · Ocean', 'ocean-depth'],
      ['Panorama · Clay', 'earth-clay'],
      ['Panorama · Sunset', 'sunset-gradient'],
      ['Panorama · Citrus', 'citrus-fresh'],
    ],
  },
  // ---------------- Tech & data ----------------
  {
    category: 'tech', styleId: 'dark-tech', types: ['framework', 'how-to', 'data-story'],
    variants: [
      ['Dev · Electric', 'midnight-electric'],
      ['Dev · Terminal', 'terminal-green'],
      ['Dev · Violet', 'cyber-violet'],
      ['Dev · Data Dark', 'data-dark'],
    ],
  },
  {
    category: 'tech', styleId: 'data-infographic', types: ['data-story', 'case-study', 'comparison'],
    variants: [
      ['Infographic · Clean', 'data-clean'],
      ['Infographic · Dark', 'data-dark'],
      ['Infographic · Navy', 'corporate-navy'],
      ['Infographic · Teal', 'tutorial-teal'],
    ],
  },
  {
    category: 'tech', styleId: 'neo-retro-grid', types: ['event-promo', 'listicle'],
    variants: [
      ['Synthwave · Berry', 'berry-night'],
      ['Synthwave · Cyber', 'cyber-violet'],
      ['Synthwave · 70s', 'seventies-sun'],
    ],
  },
  // ---------------- Lifestyle ----------------
  {
    category: 'lifestyle', styleId: 'surreal', types: ['quote-series', 'devotional'],
    variants: [
      ['Dreamscape · Dream', 'surreal-dream'],
      ['Dreamscape · Dusk', 'surreal-dusk'],
      ['Dreamscape · Aurora', 'glass-aurora'],
      ['Dreamscape · Lilac', 'pastel-lilac'],
    ],
  },
  {
    category: 'lifestyle', styleId: 'pastel-soft', types: ['listicle', 'how-to'],
    variants: [
      ['Soft · Peach', 'pastel-peach'],
      ['Soft · Mint', 'pastel-mint'],
    ],
  },
  {
    category: 'lifestyle', styleId: 'clay-3d', types: ['listicle', 'how-to'],
    variants: [
      ['Clay · Mint', 'pastel-mint'],
      ['Clay · Sky', 'pastel-sky'],
    ],
  },
  {
    category: 'lifestyle', styleId: 'paper-cut', types: ['listicle', 'how-to'],
    variants: [
      ['Paper Cut · Peach', 'pastel-peach'],
      ['Paper Cut · Butter', 'butter-cream'],
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const TEMPLATES: CarouselTemplate[] = FAMILIES.flatMap((f) =>
  f.variants.map(([name, paletteId, fontPair, mods]): CarouselTemplate => {
    const style = getStyle(f.styleId);
    const [h, b] = fontPair ? fontPair.split('/') : [style.fonts.heading, style.fonts.body];
    const modifiers = f.mods || mods ? { ...f.mods, ...mods } : undefined;
    return {
      id: `${f.styleId}--${slug(name)}`,
      name, category: f.category, styleId: f.styleId, paletteId,
      headingFont: findFont(h!) ? h! : style.fonts.heading,
      bodyFont: findFont(b!) ? b! : style.fonts.body,
      modifiers, types: f.types,
    };
  }),
);

const templateMap = new Map(TEMPLATES.map((t) => [t.id, t]));
export const getTemplate = (id: string | undefined) => (id ? templateMap.get(id) : undefined);

/** The carousel theme a template starts from. */
export function themeFromTemplate(t: CarouselTemplate, extra: Partial<CarouselTheme> = {}): CarouselTheme {
  return {
    styleId: t.styleId, paletteId: t.paletteId, headingFont: t.headingFont, bodyFont: t.bodyFont,
    modifiers: t.modifiers ? { ...t.modifiers } : undefined,
    label: `${t.name}`, templateId: t.id, ...extra,
  };
}

/** A template's palette name, for subtitles. */
export const templatePaletteName = (t: CarouselTemplate) => getPalette(t.paletteId).name;

/** Simple search over name, category, style and suitable types. */
export function searchTemplates(query: string, list: CarouselTemplate[] = TEMPLATES): CarouselTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((t) => {
    const hay = `${t.name} ${t.category} ${getStyle(t.styleId).name} ${getStyle(t.styleId).description} ${t.types.join(' ')} ${getPalette(t.paletteId).name}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
