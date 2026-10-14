// Plays the current slide's (or the whole carousel's) animation timeline in a dialog, frame by frame,
// with the same renderer the exports use.
import { useEffect, useRef, useState } from 'react';
import { useDocument } from '@/app/store';
import { getPreset } from '@/styles';
import { SlideStage } from './SlideStage';
import { frameOf, introDuration } from './animation';
import { useEditor } from './store';

const HOLD = 1.5;

export function AnimationPreview({ onClose }: { onClose(): void }) {
  const carousel = useDocument((s) => s.carousel)!;
  const startIndex = useEditor((s) => s.slideIndex);
  const preset = getPreset(carousel.presetId);
  const [all, setAll] = useState(false);
  const [index, setIndex] = useState(startIndex);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef(0);
  const slide = carousel.slides[index]!;
  const length = introDuration(slide) + HOLD;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next < length) return next;
        if (all) setIndex((i) => (i + 1) % carousel.slides.length);
        return 0;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, length, all, carousel.slides.length]);

  const displayWidth = Math.min(520, typeof window === 'undefined' ? 520 : window.innerWidth - 64);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Animation preview">
      <div className="card flex flex-col gap-3 p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">Animation preview · slide {index + 1}</h2>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Close preview">✕</button>
        </div>
        <div data-testid="animation-stage">
          <SlideStage slide={frameOf(slide, t, preset.width / 1080)} width={preset.width} height={preset.height} displayWidth={displayWidth} />
        </div>
        <input aria-label="Timeline" type="range" min={0} max={length} step={0.01} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="w-full accent-brand-500" />
        <div className="flex items-center gap-2 text-xs">
          <button className="btn-primary px-3 py-1 text-xs" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setT(0); setPlaying(true); }}>Restart</button>
          <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Play all slides</label>
          <span className="tabular-nums text-zinc-500">{t.toFixed(1)}s / {length.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
