// Animation timeline: a pure function from (slide, time) to the slide as it looks at that moment.
// Elements carry an `anim` (entrance, delay, duration, optional word/letter animation and loop);
// frameOf() turns that into a render-only `pose` per element. The editor preview, the video/GIF
// export and the per-slide animated export all render frames through it, so they match exactly.
import type { ElementAnimation, EnterAnimation, LoopAnimation, Pose, Slide, SlideElement, TextAnimation } from '@/model/types';

export const ENTER_OPTIONS: [EnterAnimation, string][] = [
  ['none', 'None'], ['fade', 'Fade in'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide in from right'], ['slide-right', 'Slide in from left'],
  ['zoom', 'Zoom in'], ['pop', 'Pop'], ['drop', 'Drop & bounce'], ['rotate', 'Spin in'], ['wipe', 'Wipe / draw on'],
];
export const TEXT_ANIM_OPTIONS: [TextAnimation, string][] = [
  ['none', 'None'], ['typewriter', 'Typewriter'], ['word-fade', 'Word by word (fade)'], ['word-rise', 'Word by word (rise)'], ['word-pop', 'Word by word (pop)'], ['word-slide', 'Word by word (slide)'], ['highlight-sweep', 'Highlight sweep'],
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

export type AnimationPreset = 'none' | 'subtle' | 'lively' | 'typewriter' | 'kinetic';

export const ANIMATION_PRESETS: [AnimationPreset, string][] = [
  ['none', 'No animation'],
  ['subtle', 'Subtle (fades, gentle rise)'],
  ['lively', 'Lively (pop, slide, float)'],
  ['typewriter', 'Typewriter headlines'],
  ['kinetic', 'Kinetic type (word by word)'],
];

/** Slide furniture: appears last, quietly. */
const CHROME = /^(slide-number|swipe|handle|progress|watermark|follow-button|avatar|verified|action-icon|window-dot|step-tracker|barcode)/;
/** Large surfaces behind content: fade only (popping them would look jumpy). */
const PANELS = /^(card|compare-panel|split-block|border|frame|rule|recap-rule|divider|metrics-divider|bar-track|seam-shape|scanline|column-rule|row-separator|brand-bar|sun-stripe|timeline-rail|panorama-line|sticker-bg)/;
/** Small accents: pop in (and float when lively). */
const DECOR = /^(sparkle|blob|starburst|stamp|tape|quote-mark|doodle|scribble|squiggle|icon|glow-orb|sun|accent-bar|bullet-check|bullet-marker|timeline-node|bar-fill|metric-icon|icon-chip|decor|shape)/;

function animFor(el: SlideElement, preset: AnimationPreset, order: number): ElementAnimation | undefined {
  if (preset === 'none') return undefined;
  const slot = el.slot ?? el.name ?? '';
  const isText = el.kind === 'text';
  const headline = /headline|title|hook|stat-value|tweet-text/.test(slot);
  const d = 0.15 + order * 0.12;
  if (CHROME.test(slot)) return { enter: 'fade', delay: 0.9, duration: 0.5 };
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
