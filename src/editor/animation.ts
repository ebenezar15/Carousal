// Animation timeline: a pure function from (slide, time) to the slide as it looks at that moment.
// Elements carry an `anim` (entrance, delay, duration, optional word/letter animation and loop);
// frameOf() turns that into a render-only `pose` per element. The editor preview, the video/GIF
// export and the per-slide animated export all render frames through it, so they match exactly.
import type { ElementAnimation, EnterAnimation, LoopAnimation, Pose, Slide, SlideElement, TextAnimation } from '@/model/types';

export const ENTER_OPTIONS: [EnterAnimation, string][] = [
  ['none', 'None'], ['fade', 'Fade in'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide in from right'], ['slide-right', 'Slide in from left'],
  ['zoom', 'Zoom in'], ['zoom-out', 'Zoom out / spray on'], ['pop', 'Pop'], ['drop', 'Drop & bounce'], ['rotate', 'Spin in'], ['wipe', 'Wipe / draw on'],
  ['unfold', 'Unfold (paper)'], ['squash', 'Squash & stretch (clay)'],
];
export const TEXT_ANIM_OPTIONS: [TextAnimation, string][] = [
  ['none', 'None'], ['typewriter', 'Typewriter'], ['word-fade', 'Word by word (fade)'], ['word-rise', 'Word by word (rise)'], ['word-pop', 'Word by word (pop)'], ['word-slide', 'Word by word (slide)'], ['word-drop', 'Word by word (drop)'], ['word-spin', 'Word by word (spin)'], ['highlight-sweep', 'Highlight sweep'],
];
export const LOOP_OPTIONS: [LoopAnimation, string][] = [['none', 'None'], ['float', 'Float'], ['pulse', 'Pulse'], ['wiggle', 'Wiggle'], ['spin', 'Spin'], ['blink', 'Blink']];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const bounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

const IDENTITY: Pose = { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1 };

/** Pose of one animation at time t (seconds on the slide's timeline); `unit` = slide size / 1080. */
export function poseAt(a: ElementAnimation, t: number, unit: number): Pose {
  const p = clamp01((t - a.delay) / Math.max(0.01, a.duration));
  const e = easeOutCubic(p);
  const travel = 90 * unit;
  let pose: Pose = { ...IDENTITY };
  switch (a.enter) {
    case 'fade': pose.opacity = e; break;
    case 'slide-up': pose = { ...pose, dy: (1 - e) * travel, opacity: clamp01(p * 2) }; break;
    case 'slide-down': pose = { ...pose, dy: -(1 - e) * travel, opacity: clamp01(p * 2) }; break;
    case 'slide-left': pose = { ...pose, dx: (1 - e) * travel * 2, opacity: clamp01(p * 2) }; break;
    case 'slide-right': pose = { ...pose, dx: -(1 - e) * travel * 2, opacity: clamp01(p * 2) }; break;
    case 'zoom': pose = { ...pose, scale: 0.8 + 0.2 * e, opacity: e }; break;
    case 'zoom-out': pose = { ...pose, scale: 1.25 - 0.25 * e, opacity: clamp01(p * 2.5) }; break;
    case 'unfold': pose = { ...pose, sy: p === 0 ? 0 : 0.05 + 0.95 * easeOutBack(p), opacity: clamp01(p * 4) }; break;
    case 'squash': {
      // Clay-like squash and stretch: lands wide and flat, overshoots tall, settles.
      const w = p >= 1 ? 0 : Math.sin(p * Math.PI * 2.5) * (1 - p) * 0.35;
      pose = { ...pose, scale: p === 0 ? 0 : 0.4 + 0.6 * easeOutBack(p), sx: 1 + w, sy: 1 - w, opacity: clamp01(p * 3) };
      break;
    }
    case 'pop': pose = { ...pose, scale: p === 0 ? 0 : 0.3 + 0.7 * easeOutBack(p), opacity: clamp01(p * 3) }; break;
    case 'drop': pose = { ...pose, dy: -(1 - bounce(p)) * travel * 2.5, opacity: clamp01(p * 4) }; break;
    case 'rotate': pose = { ...pose, rotate: (1 - e) * -25, scale: 0.85 + 0.15 * e, opacity: e }; break;
    case 'wipe': pose.clip = e; break;
    default: break;
  }
  if (a.text && a.text !== 'none') {
    // Word animations run over the element's duration (scaled up a little for long texts by the caller).
    pose.text = { kind: a.text, progress: p };
    if (a.enter === 'none') pose.opacity = p > 0 || a.text === 'highlight-sweep' ? 1 : 0;
  }
  if (a.loop && a.loop !== 'none' && t >= a.delay + a.duration) {
    const lt = t - a.delay - a.duration;
    if (a.loop === 'float') pose.dy += Math.sin((lt / 2.4) * Math.PI * 2) * 12 * unit;
    if (a.loop === 'pulse') pose.scale *= 1 + Math.sin((lt / 1.2) * Math.PI * 2) * 0.04;
    if (a.loop === 'wiggle') pose.rotate += Math.sin((lt / 0.9) * Math.PI * 2) * 4;
    if (a.loop === 'spin') pose.rotate += (lt * 45) % 360;
    if (a.loop === 'blink') pose.opacity *= Math.sin((lt / 1.4) * Math.PI * 2) > -0.6 ? 1 : 0.15;
  }
  return pose;
}

/** The slide at time t: animated elements get a pose; others are unchanged. */
export function frameOf(slide: Slide, t: number, unit = 1): Slide {
  if (!slideHasAnimation(slide)) return slide;
  return { ...slide, elements: slide.elements.map((el) => (el.anim && isAnimated(el.anim) ? { ...el, pose: poseAt(el.anim, t, unit) } : el)) };
}

const isAnimated = (a: ElementAnimation) => a.enter !== 'none' || (a.text && a.text !== 'none') || (a.loop && a.loop !== 'none');
export const slideHasAnimation = (slide: Slide) => slide.elements.some((e) => e.anim && isAnimated(e.anim));
const hasLoop = (slide: Slide) => slide.elements.some((e) => e.anim?.loop && e.anim.loop !== 'none');

/** Seconds until every entrance on the slide has finished. */
export function introDuration(slide: Slide): number {
  return slide.elements.reduce((m, e) => (e.anim && isAnimated(e.anim) ? Math.max(m, e.anim.delay + e.anim.duration) : m), 0);
}

/** Whether frames after the intro still change (loops), i.e. the hold must be rendered frame by frame. */
export const needsLiveHold = hasLoop;

// ---- auto-animate presets ----------------------------------------------------------------------

export type AnimationPreset =
  | 'none' | 'subtle' | 'lively' | 'typewriter' | 'kinetic'
  | 'minimal' | 'maximal' | 'dreamy' | 'swiss' | 'editorial' | 'paper' | 'clay' | 'vector' | 'handwritten' | 'graffiti';

export const ANIMATION_PRESETS: [AnimationPreset, string][] = [
  ['none', 'No animation'],
  ['subtle', 'Subtle (fades, gentle rise)'],
  ['lively', 'Lively (pop, slide, float)'],
  ['typewriter', 'Typewriter headlines'],
  ['kinetic', 'Kinetic type (word by word)'],
  ['minimal', 'Minimal (slow, quiet fades)'],
  ['maximal', 'Maximal (drops, spins, wiggles)'],
  ['dreamy', 'Surreal / dreamy (drift and float)'],
  ['swiss', 'Swiss (sharp slides, ruled wipes)'],
  ['editorial', 'Editorial (word rise, ruled wipes)'],
  ['paper', 'Paper cut (layers unfold)'],
  ['clay', 'Clay (squash and bounce)'],
  ['vector', 'Vector (draw on, pop)'],
  ['handwritten', 'Handwritten (written on, doodles drawn)'],
  ['graffiti', 'Graffiti (spray on, drips, wiggle)'],
];

/** Slide furniture: appears last, quietly. */
const CHROME = /^(slide-number|swipe|handle|progress|watermark|follow-button|avatar|verified|action-icon|window-dot|step-tracker|barcode)/;
/** Large surfaces behind content: fade only (popping them would look jumpy). */
const PANELS = /^(card|compare-panel|split-block|border|frame|rule|recap-rule|divider|metrics-divider|bar-track|seam-shape|scanline|column-rule|row-separator|brand-bar|sun-stripe|timeline-rail|panorama-line|sticker-bg|masthead|swiss-grid|margin-line|clay-card)/;
/** Small accents: pop in (and float when lively). */
const DECOR = /^(sparkle|blob|starburst|stamp|tape|quote-mark|doodle|scribble|squiggle|icon|glow-orb|sun|accent-bar|bullet-check|bullet-marker|timeline-node|bar-fill|metric-icon|icon-chip|decor|shape|confetti|orb|arch|clay|paper|vector|drip|spray|splat|paper-clip|giant-circle)/;

type Part = 'head' | 'text' | 'decor' | 'line' | 'image' | 'panel';
type Recipe = Record<Part, (el: SlideElement, d: number) => ElementAnimation>;
const words = (el: SlideElement) => (el.kind === 'text' ? el.text.split(/\s+/).length : 1);

/** Design-style motion recipes (one per carousel style family). */
const STYLE_MOTION: Partial<Record<AnimationPreset, Recipe>> = {
  minimal: {
    head: () => ({ enter: 'fade', delay: 0.2, duration: 1.1 }),
    text: (_e, d) => ({ enter: 'fade', delay: d + 0.45, duration: 1 }),
    decor: (_e, d) => ({ enter: 'fade', delay: d, duration: 1.2 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 1.1 }),
    image: (_e, d) => ({ enter: 'fade', delay: d, duration: 1.4 }),
    panel: () => ({ enter: 'fade', delay: 0, duration: 0.9 }),
  },
  maximal: {
    head: (el) => ({ enter: 'none', delay: 0.1, duration: Math.min(1.8, 0.16 * words(el) + 0.3), text: 'word-drop' }),
    text: (_e, d) => ({ enter: 'slide-left', delay: d + 0.2, duration: 0.5 }),
    decor: (el, d) => ({ enter: 'pop', delay: d * 0.5, duration: 0.5, loop: (el.slot ?? '').startsWith('starburst') ? 'spin' : el.kind === 'path' ? 'wiggle' : 'pulse' }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.4 }),
    image: (_e, d) => ({ enter: 'rotate', delay: d, duration: 0.6 }),
    panel: () => ({ enter: 'zoom', delay: 0, duration: 0.4 }),
  },
  dreamy: {
    head: (el) => ({ enter: 'none', delay: 0.3, duration: Math.min(2.6, 0.22 * words(el) + 0.6), text: 'word-fade' }),
    text: (_e, d) => ({ enter: 'fade', delay: d + 0.6, duration: 1.2 }),
    decor: (_e, d) => ({ enter: 'zoom-out', delay: d * 0.6, duration: 1.6, loop: 'float' }),
    line: (_e, d) => ({ enter: 'fade', delay: d, duration: 1.2 }),
    image: (_e, d) => ({ enter: 'zoom-out', delay: d, duration: 2 }),
    panel: () => ({ enter: 'fade', delay: 0, duration: 1.2 }),
  },
  swiss: {
    head: () => ({ enter: 'slide-right', delay: 0.1, duration: 0.5 }),
    text: (_e, d) => ({ enter: 'slide-right', delay: d + 0.15, duration: 0.45 }),
    decor: (_e, d) => ({ enter: 'wipe', delay: d * 0.5, duration: 0.5 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d * 0.5, duration: 0.4 }),
    image: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.6 }),
    panel: () => ({ enter: 'wipe', delay: 0, duration: 0.5 }),
  },
  editorial: {
    head: (el) => ({ enter: 'none', delay: 0.2, duration: Math.min(2, 0.14 * words(el) + 0.4), text: 'word-rise' }),
    text: (_e, d) => ({ enter: 'fade', delay: d + 0.4, duration: 0.8 }),
    decor: (_e, d) => ({ enter: 'fade', delay: d, duration: 0.8 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d * 0.4, duration: 0.8 }),
    image: (_e, d) => ({ enter: 'fade', delay: d, duration: 1.2 }),
    panel: () => ({ enter: 'fade', delay: 0, duration: 0.6 }),
  },
  paper: {
    head: (el) => ({ enter: 'none', delay: 0.5, duration: Math.min(1.8, 0.14 * words(el) + 0.4), text: 'word-rise' }),
    text: (_e, d) => ({ enter: 'slide-up', delay: d + 0.5, duration: 0.6 }),
    decor: (_e, d) => ({ enter: 'slide-up', delay: d * 0.7, duration: 0.7 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.6 }),
    image: (_e, d) => ({ enter: 'unfold', delay: d, duration: 0.7 }),
    panel: () => ({ enter: 'unfold', delay: 0.1, duration: 0.6 }),
  },
  clay: {
    head: () => ({ enter: 'squash', delay: 0.15, duration: 0.9 }),
    text: (_e, d) => ({ enter: 'pop', delay: d + 0.3, duration: 0.6 }),
    decor: (el, d) => ({ enter: 'squash', delay: d * 0.6, duration: 0.9, loop: el.kind === 'ellipse' || el.kind === 'path' ? 'float' : undefined }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.6 }),
    image: (_e, d) => ({ enter: 'squash', delay: d, duration: 0.9 }),
    panel: () => ({ enter: 'squash', delay: 0, duration: 0.8 }),
  },
  vector: {
    head: (el) => ({ enter: 'none', delay: 0.15, duration: Math.min(1.6, 0.14 * words(el) + 0.3), text: 'word-slide' }),
    text: (_e, d) => ({ enter: 'slide-left', delay: d + 0.25, duration: 0.55 }),
    decor: (el, d) => (el.kind === 'path' && !(el as { fill?: string }).fill ? { enter: 'wipe', delay: d * 0.5, duration: 0.8 } : { enter: 'pop', delay: d * 0.5, duration: 0.55 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d * 0.5, duration: 0.6 }),
    image: (_e, d) => ({ enter: 'pop', delay: d, duration: 0.6 }),
    panel: () => ({ enter: 'zoom', delay: 0, duration: 0.5 }),
  },
  handwritten: {
    head: (el) => ({ enter: 'none', delay: 0.2, duration: Math.min(2.6, 0.05 * (el.kind === 'text' ? el.text.length : 10) + 0.4), text: 'typewriter' }),
    text: (_e, d) => ({ enter: 'wipe', delay: d + 0.6, duration: 0.9 }),
    decor: (_e, d) => ({ enter: 'wipe', delay: 0.8 + d * 0.5, duration: 0.7 }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.7 }),
    image: (_e, d) => ({ enter: 'drop', delay: d, duration: 0.8 }),
    panel: () => ({ enter: 'fade', delay: 0, duration: 0.5 }),
  },
  graffiti: {
    head: () => ({ enter: 'zoom-out', delay: 0.1, duration: 0.45 }),
    text: (_e, d) => ({ enter: 'slide-up', delay: d + 0.25, duration: 0.5 }),
    decor: (el, d) => ((el.slot ?? '').startsWith('drip') ? { enter: 'unfold', delay: 0.35 + d * 0.3, duration: 0.9 } : { enter: 'zoom-out', delay: d * 0.4, duration: 0.4, loop: el.kind === 'path' ? 'wiggle' : undefined }),
    line: (_e, d) => ({ enter: 'wipe', delay: d, duration: 0.4 }),
    image: (_e, d) => ({ enter: 'zoom-out', delay: d, duration: 0.5 }),
    panel: () => ({ enter: 'fade', delay: 0, duration: 0.3 }),
  },
};

function animFor(el: SlideElement, preset: AnimationPreset, order: number): ElementAnimation | undefined {
  if (preset === 'none') return undefined;
  const slot = el.slot ?? el.name ?? '';
  const isText = el.kind === 'text';
  const headline = /headline|title|hook|stat-value|tweet-text/.test(slot);
  const d = 0.15 + order * 0.12;
  if (CHROME.test(slot)) return { enter: 'fade', delay: 0.9, duration: 0.5 };
  const recipe = STYLE_MOTION[preset];
  if (recipe) {
    if (PANELS.test(slot)) return recipe.panel(el, d);
    if (isText) return headline ? recipe.head(el, d) : recipe.text(el, d);
    if (el.kind === 'line') return recipe.line(el, d);
    if (el.kind === 'image') return recipe.image(el, d);
    return recipe.decor(el, d);
  }
  if (PANELS.test(slot)) return { enter: 'fade', delay: 0, duration: 0.5 };
  if (DECOR.test(slot) || el.kind === 'path' || el.kind === 'ellipse' || el.kind === 'rect') {
    return preset === 'lively' ? { enter: 'pop', delay: d * 0.6, duration: 0.6, loop: el.kind === 'path' ? 'float' : undefined } : { enter: 'fade', delay: d * 0.5, duration: 0.6 };
  }
  if (el.kind === 'line') return { enter: 'wipe', delay: d, duration: 0.6 };
  if (el.kind === 'image') return { enter: preset === 'lively' ? 'zoom' : 'fade', delay: d, duration: 0.8 };
  if (isText && headline) {
    if (preset === 'typewriter') return { enter: 'none', delay: 0.2, duration: Math.min(2.4, 0.04 * el.text.length + 0.4), text: 'typewriter' };
    if (preset === 'kinetic') return { enter: 'none', delay: 0.15, duration: Math.min(2.2, 0.18 * el.text.split(/\s+/).length + 0.3), text: 'word-pop' };
    if (preset === 'lively') return { enter: 'none', delay: 0.15, duration: Math.min(1.8, 0.15 * el.text.split(/\s+/).length + 0.3), text: 'word-rise' };
    return { enter: 'slide-up', delay: 0.15, duration: 0.7 };
  }
  if (isText) {
    if (preset === 'kinetic') return { enter: 'none', delay: d + 0.3, duration: Math.min(2, 0.1 * el.text.split(/\s+/).length + 0.3), text: 'word-fade' };
    return { enter: preset === 'lively' ? 'slide-left' : 'fade', delay: d + 0.25, duration: 0.6 };
  }
  return { enter: 'fade', delay: d, duration: 0.6 };
}

/** Gives every element on a slide an animation that suits its role (headline, body, decoration…). */
export function autoAnimate(slide: Slide, preset: AnimationPreset): Slide {
  let order = 0;
  return {
    ...slide,
    elements: slide.elements.map((el) => {
      const anim = animFor(el, preset, el.kind === 'text' ? order++ : order);
      const { anim: _old, ...rest } = el;
      void _old;
      return (anim ? { ...rest, anim } : rest) as SlideElement;
    }),
  };
}
