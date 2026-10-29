// Picks the illustration that tells a slide's story: a scene, a character pose or a prop, from the words on
// the slide (and the AI's icon keywords / layout hint). Christian topics are covered in depth (scripture
// imagery and common devotional themes); general topics fall back to everyday scenes and objects.
import type { SlidePlan } from '../schema';
import type { Pose, PropKind, SceneKind } from './types';

export type ArtChoice =
  | { kind: 'scene'; scene: SceneKind; pose?: Pose; people?: number; why: string }
  | { kind: 'character'; pose: Pose; prop?: PropKind; why: string }
  | { kind: 'prop'; prop: PropKind; why: string };

const SCENES: [RegExp, SceneKind][] = [
  [/\b(empty tomb|resurrect\w*|risen|he is alive|easter)\b/, 'empty-tomb'],
  [/\b(cross|calvary|golgotha|crucif\w*|salvation|saved|sacrifice|aton\w*|redeem\w*|redemption|gospel)\b/, 'hill-cross'],
  [/\b(christmas|nativity|bethlehem|manger|advent|born to us|emmanuel|immanuel)\b/, 'manger'],
  [/\b(storm|storms|trials?|anxi\w*|fear|afraid|worr\w*|trouble\w*|struggl\w*|waves?)\b/, 'storm-sea'],
  [/\b(shepherd|sheep|flock|lost sheep|psalm 23|green pastures)\b/, 'shepherd'],
  [/\b(living water|thirst\w*|well|samaritan)\b/, 'well'],
  [/\b(rainbow|covenant|noah|flood)\b/, 'rainbow'],
  [/\b(lighthouse|beacon|light of the world|shine|light)\b/, 'lighthouse'],
  [/\b(communion|lord'?s supper|bread|table|feast|meal|hospitality|breaking bread)\b/, 'table'],
  [/\b(door|knock\w*|prodigal|come home|welcome\w*|invit\w*|forgiv\w*)\b/, 'open-door'],
  [/\b(church|fellowship|gather\w*|community|congregation|body of christ|sunday)\b/, 'church'],
  [/\b(planted|roots?|abide|fruit\w*|streams?|psalm 1|flourish\w*|vine|branches)\b/, 'tree-river'],
  [/\b(seeds?|sow\w*|harvest|grow\w*|growth|mustard|parable of the sower)\b/, 'field-seeds'],
  [/\b(garden|eden|gethsemane|creation|bloom\w*|beauty|flowers?)\b/, 'garden'],
  [/\b(wilderness|desert|dry season|waiting|exodus|40 days|forty)\b/, 'desert'],
  [/\b(stars|night|promise\w*|abraham|evening|darkness|sleep)\b/, 'night-sky'],
  [/\b(mountains?|strength|refuge|rock|fortress|steadfast|move mountains|climb)\b/, 'mountains'],
  [/\b(peace|calm|still\w*|rest|be still|quiet)\b/, 'sea-boat'],
  [/\b(journey|path|road|way|walk\w*|pilgrim\w*|follow\w*|direction|next step)\b/, 'road'],
  [/\b(hope|new day|morning|dawn|new mercies|fresh start|sunrise|new beginning)\b/, 'sunrise'],
  [/\b(city|world|nations|mission\w*|neighbou?rs?|everyday life|work)\b/, 'city'],
];

const POSES: [RegExp, Pose][] = [
  [/\b(pray\w*|intercede|intercession|petition)\b/, 'pray'],
  [/\b(worship\w*|prais\w*|sing\w*|hallelujah|rejoic\w*|glorify)\b/, 'worship'],
  [/\b(kneel\w*|humble|humility|surrender\w*|repent\w*|confess\w*)\b/, 'kneel'],
  [/\b(read\w*|bible|scripture|study|word of god|devotion\w*|verse)\b/, 'read'],
  [/\b(love|hug\w*|embrac\w*|comfort\w*|friend\w*|kindness|forgive\w*|reconcil\w*)\b/, 'hug'],
  [/\b(serve|serving|servant|give|giving|generous|help\w*|carry|burdens?)\b/, 'carry'],
  [/\b(think\w*|reflect\w*|meditat\w*|question\w*|doubt\w*|wonder\w*|consider)\b/, 'think'],
  [/\b(rest\w*|sit\w*|listen\w*|wait\w*|sabbath)\b/, 'sit'],
  [/\b(go|going|journey|walk\w*|follow\w*|step out|move)\b/, 'walk'],
  [/\b(hello|welcome|join us|invite\w*|share|tell)\b/, 'wave'],
  [/\b(look|see|notice|this is|here's|point)\b/, 'point'],
];

const PROPS: [RegExp, PropKind][] = [
  [/\b(holy spirit|spirit|dove|baptism|baptized)\b/, 'dove'],
  [/\b(pentecost|fire|flame|on fire|passion)\b/, 'flame'],
  [/\b(candle|vigil)\b/, 'candle'],
  [/\b(lamp|lamp unto|light to my path)\b/, 'lamp'],
  [/\b(love|heart|beloved|compassion)\b/, 'heart'],
  [/\b(bread|loaves|daily bread)\b/, 'bread'],
  [/\b(cup|wine|blood)\b/, 'cup'],
  [/\b(king|kingdom|crown|reign|victory|royal)\b/, 'crown'],
  [/\b(sheep|lamb)\b/, 'sheep'],
  [/\b(star|wise men|magi)\b/, 'star'],
  [/\b(armou?r|shield|protect\w*|defen[cs]e)\b/, 'shield'],
  [/\b(anchor|anchored|hope)\b/, 'anchor'],
  [/\b(keys?|unlock\w*|open the door)\b/, 'key'],
  [/\b(seed|mustard)\b/, 'seed'],
  [/\b(fish\w*|fishers of men|nets?)\b/, 'fish'],
  [/\b(water|baptism|wash\w*|cleans\w*)\b/, 'water-drop'],
  [/\b(songs?|hymns?|music|psalms?)\b/, 'music'],
  [/\b(ideas?|wisdom|insight|understand\w*)\b/, 'lightbulb'],
  [/\b(calling|purpose|direction|guid\w*|compass)\b/, 'compass'],
  [/\b(law|prophec\w*|prophets?|old testament|scroll|torah|commandments?)\b/, 'scroll'],
  [/\b(peace|olive)\b/, 'olive-branch'],
  [/\b(bell|call to worship)\b/, 'bell'],
  [/\b(bible|scripture|word|verse|gospel of)\b/, 'bible'],
  [/\b(cross|jesus|christ|saviou?r)\b/, 'cross'],
  [/\b(pray\w*)\b/, 'hands-praying'],
  [/\b(church)\b/, 'church'],
  [/\b(mountain)\b/, 'mountain'],
  [/\b(sun|light|bright)\b/, 'sun'],
];

const textOf = (s: SlidePlan) =>
  ` ${[s.headline, s.body, ...s.bullets, s.quote?.text ?? '', s.quote?.attribution ?? '', s.layoutHint, ...s.iconKeywords].join(' ').toLowerCase()} `;

const first = <T,>(table: [RegExp, T][], text: string): [T, string] | null => {
  for (const [re, v] of table) {
    const m = re.exec(text);
    if (m) return [v, m[0].trim()];
  }
  return null;
};

/** Every scene that matches the slide, best first (callers skip ones already used in the carousel). */
export function scenesFor(s: SlidePlan): SceneKind[] {
  const t = textOf(s);
  return SCENES.filter(([re]) => re.test(t)).map(([, k]) => k);
}

/**
 * What to draw for a slide. `avoid` lists scenes already used in this carousel, so a deck doesn't repeat
 * the same picture. Returns null when nothing on the slide suggests a picture.
 */
export function artFor(s: SlidePlan, avoid: SceneKind[] = []): ArtChoice | null {
  const t = textOf(s);
  const hint = s.layoutHint.toLowerCase();
  const pose = first(POSES, t);
  const scene = scenesFor(s).find((k) => !avoid.includes(k));
  const prop = first(PROPS, t);
  // Story moments (hooks, quotes, CTAs, or a hint asking for a scene) get a whole scene; a person doing
  // something (praying, reading, worshipping) gets a character; otherwise a symbolic object.
  if (scene && (['hook', 'cta', 'quote', 'intro'].includes(s.role) || /scene|story|illustrat/.test(hint) || !pose)) {
    return { kind: 'scene', scene, pose: pose?.[0], people: pose ? 1 : 0, why: `“${first(SCENES, t)![1]}”` };
  }
  if (pose) return { kind: 'character', pose: pose[0], prop: prop?.[0], why: `“${pose[1]}”` };
  if (prop) return { kind: 'prop', prop: prop[0], why: `“${prop[1]}”` };
  return null;
}

/** Scenes that suit any slide when a style asks for a picture on every slide (story styles). */
export const FALLBACK_SCENES: SceneKind[] = ['sunrise', 'road', 'mountains', 'garden', 'tree-river', 'sea-boat', 'night-sky', 'city', 'field-seeds', 'rainbow'];

/** Bible references like "John 3:16", "1 Cor 13:4-7", "Psalm 23". */
export const SCRIPTURE_REF = /\b((?:[1-3]\s?)?(?:Gen(?:esis)?|Ex(?:odus)?|Lev(?:iticus)?|Num(?:bers)?|Deut(?:eronomy)?|Josh(?:ua)?|Judg(?:es)?|Ruth|Sam(?:uel)?|Kings|Chron(?:icles)?|Ezra|Neh(?:emiah)?|Esth(?:er)?|Job|Ps(?:alms?|a)?|Prov(?:erbs)?|Eccl(?:esiastes)?|Song(?: of (?:Songs|Solomon))?|Isa(?:iah)?|Jer(?:emiah)?|Lam(?:entations)?|Ezek(?:iel)?|Dan(?:iel)?|Hos(?:ea)?|Joel|Amos|Obad(?:iah)?|Jonah|Mic(?:ah)?|Nah(?:um)?|Hab(?:akkuk)?|Zeph(?:aniah)?|Hag(?:gai)?|Zech(?:ariah)?|Mal(?:achi)?|Matt?(?:hew)?|Mark|Luke|John|Acts|Rom(?:ans)?|Cor(?:inthians)?|Gal(?:atians)?|Eph(?:esians)?|Phil(?:ippians)?|Col(?:ossians)?|Thess(?:alonians)?|Tim(?:othy)?|Titus|Philem(?:on)?|Heb(?:rews)?|James|Jas|Pet(?:er)?|Jude|Rev(?:elation)?)\.?\s\d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?)\b/;
