// Animation controls: per element (entrance, timing, word animation, loop) and per slide (presets,
// preview). Animations play in the preview and in video/GIF/clip exports; still images are unaffected.
import { lazy, Suspense, useState } from 'react';
import type { ElementAnimation, SlideElement } from '@/model/types';
import { beginGesture, endGesture, useDocument } from '@/app/store';
import { themeMotion } from '@/engine/layout';
import { ANIMATION_PRESETS, ENTER_OPTIONS, LOOP_OPTIONS, TEXT_ANIM_OPTIONS, autoAnimate, slideHasAnimation, type AnimationPreset } from '../animation';
import { useEditor } from '../store';
import { IconButton, Row, Section, Select, Slider } from './fields';

const AnimationPreview = lazy(() => import('../AnimationPreview').then((m) => ({ default: m.AnimationPreview })));

const DEFAULT: ElementAnimation = { enter: 'fade', delay: 0, duration: 0.6 };

/** Hand-tuned animations are kept when the theme changes (theme.motion = 'custom'); one undo step. */
function setCustom(set: (patch: Partial<SlideElement>) => void, patch: Partial<SlideElement>) {
  beginGesture();
  set(patch);
  useDocument.getState().apply((d) => (d.carousel.theme.motion === 'custom' ? d : { ...d, carousel: { ...d.carousel, theme: { ...d.carousel.theme, motion: 'custom' } } }));
  endGesture();
}

export function ElementAnimationProps({ el, set: setEl }: { el: SlideElement; set(patch: Partial<SlideElement>): void }) {
  const a = el.anim;
  const set = (patch: Partial<SlideElement>) => setCustom(setEl, patch);
  const update = (patch: Partial<ElementAnimation>) => set({ anim: { ...DEFAULT, ...a, ...patch } });
  return (
    <Section title="Animation" defaultOpen={Boolean(a)}>
      <Select label="Entrance" value={a?.enter ?? 'none'} options={ENTER_OPTIONS} onChange={(v) => (v === 'none' && !a?.text && !a?.loop ? set({ anim: undefined }) : update({ enter: v }))} />
      {el.kind === 'text' && <Select label="Word animation" value={a?.text ?? 'none'} options={TEXT_ANIM_OPTIONS} onChange={(v) => update({ text: v === 'none' ? undefined : v, enter: a?.enter ?? 'none' })} />}
      {a && (
        <Row>
          <Slider label="Delay" value={a.delay} min={0} max={5} step={0.05} onChange={(v) => update({ delay: v })} format={(v) => `${v.toFixed(2)}s`} />
          <Slider label="Duration" value={a.duration} min={0.1} max={5} step={0.05} onChange={(v) => update({ duration: v })} format={(v) => `${v.toFixed(2)}s`} />
        </Row>
      )}
      <Select label="Loop after entrance" value={a?.loop ?? 'none'} options={LOOP_OPTIONS} onChange={(v) => update({ loop: v === 'none' ? undefined : v, enter: a?.enter ?? 'none' })} />
      <PreviewButton />
    </Section>
  );
}

/** Slide-level: apply an animation preset to this slide or all slides, and preview. */
export function SlideAnimationProps() {
  const carousel = useDocument((s) => s.carousel)!;
  const apply = useDocument((s) => s.apply);
  const slideIndex = useEditor((s) => s.slideIndex);
  const [preset, setPreset] = useState<AnimationPreset>(() => themeMotion(carousel.theme) ?? 'subtle');
  const animated = slideHasAnimation(carousel.slides[slideIndex]!);
  // All slides → the preset becomes the carousel's motion (kept on theme changes); one slide → custom.
  const run = (all: boolean) =>
    apply((d) => ({
      ...d,
      carousel: { ...d.carousel, theme: { ...d.carousel.theme, motion: all ? preset : 'custom' }, slides: d.carousel.slides.map((s, i) => (all || i === slideIndex ? autoAnimate(s, preset) : s)) },
    }));
  return (
    <Section title="Animation" defaultOpen={animated}>
      <Select label="Animation style" value={preset} options={ANIMATION_PRESETS} onChange={(v) => setPreset(v as AnimationPreset)} />
      <div className="flex flex-wrap gap-1">
        <IconButton label="Animate this slide" onClick={() => run(false)}>This slide</IconButton>
        <IconButton label="Animate all slides" onClick={() => run(true)}>All slides</IconButton>
      </div>
      <p className="text-[11px] text-zinc-500">Animations play in video, GIF and per-slide clip exports. Select an element to fine-tune its entrance, word animation and loop.</p>
      <PreviewButton />
    </Section>
  );
}

function PreviewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="Preview animation" onClick={() => setOpen(true)}>▶ Preview</IconButton>
      {open && (
        <Suspense fallback={null}>
          <AnimationPreview onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
