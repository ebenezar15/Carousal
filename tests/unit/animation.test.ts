import { beforeAll, describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import { autoAnimate, frameOf, introDuration, needsLiveHold, poseAt, slideHasAnimation } from '@/editor/animation';
import { applyTheme } from '@/editor/ops';
import { loadIcons } from '@/styles/icons';
import { ARTICLE } from './fixtures';

beforeAll(() => loadIcons());

const plan = planFromText(ARTICLE, defaultOptions);
const carousel = () => buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('bold-gradient') });

describe('animation poses', () => {
  it('fades and slides in over the duration after the delay', () => {
    const a = { enter: 'slide-up' as const, delay: 0.5, duration: 1 };
    expect(poseAt(a, 0.2, 1)).toMatchObject({ opacity: 0, dy: 90 });
    const mid = poseAt(a, 1, 1);
    expect(mid.dy).toBeGreaterThan(0);
    expect(mid.dy).toBeLessThan(90);
    expect(poseAt(a, 2, 1)).toMatchObject({ opacity: 1, dy: 0, scale: 1 });
  });
  it('pops with overshoot, wipes, and reports word-animation progress', () => {
    const pop = [0.3, 0.5, 0.7].map((t) => poseAt({ enter: 'pop', delay: 0, duration: 1 }, t, 1).scale);
    expect(Math.max(...pop)).toBeGreaterThan(1); // easeOutBack overshoots before settling
    expect(poseAt({ enter: 'wipe', delay: 0, duration: 1 }, 0.5, 1).clip).toBeCloseTo(0.875, 2);
    expect(poseAt({ enter: 'none', delay: 0, duration: 2, text: 'typewriter' }, 1, 1).text).toEqual({ kind: 'typewriter', progress: 0.5 });
  });
  it('loops only after the entrance', () => {
    const a = { enter: 'fade' as const, delay: 0, duration: 1, loop: 'spin' as const };
    expect(poseAt(a, 0.5, 1).rotate).toBe(0);
    expect(poseAt(a, 3, 1).rotate).toBeCloseTo(90, 5);
  });
});

describe('slide timeline', () => {
  it('auto-animates every element by role and computes the intro length', () => {
    const slide = autoAnimate(carousel().slides[0]!, 'kinetic');
    expect(slideHasAnimation(slide)).toBe(true);
    expect(slide.elements.every((e) => e.anim)).toBe(true);
    const headline = slide.elements.find((e) => e.slot === 'headline')!;
    expect(headline.anim?.text).toBe('word-pop');
    expect(introDuration(slide)).toBeGreaterThan(0.5);
    expect(needsLiveHold(slide)).toBe(false);
    expect(slideHasAnimation(autoAnimate(slide, 'none'))).toBe(false);
  });
  it('frames carry poses but never change the saved elements', () => {
    const slide = autoAnimate(carousel().slides[0]!, 'subtle');
    const f0 = frameOf(slide, 0);
    expect(f0.elements.every((e) => e.pose)).toBe(true);
    expect(slide.elements.some((e) => e.pose)).toBe(false);
    const end = frameOf(slide, introDuration(slide) + 1);
    expect(end.elements.every((e) => e.pose!.opacity === 1 && e.pose!.dy === 0)).toBe(true);
    const still = carousel().slides[0]!;
    expect(frameOf(still, 0.3)).toBe(still);
  });
  it('keeps animations when the theme changes', () => {
    const c = carousel();
    const animated = { ...c, slides: c.slides.map((s) => autoAnimate(s, 'lively')) };
    const doc = applyTheme({ carousel: animated, plan }, themeFor('minimal-swiss'));
    const headline = doc.carousel.slides[0]!.elements.find((e) => e.slot === 'headline')!;
    expect(headline.anim?.text).toBe('word-rise');
  });
});
