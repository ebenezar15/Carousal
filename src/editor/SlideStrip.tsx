import { useEffect, useRef, useState } from 'react';
import type { Slide } from '@/model/types';
import { getPreset } from '@/styles';
import { useDocument } from '@/app/store';
import { SlideStage } from './SlideStage';
import { useEditor } from './store';
import * as A from './actions';

/** Renders a thumbnail only while it is on screen (virtualized strip for long carousels). */
function LazyThumb({ slide, w, h, width }: { slide: Slide; w: number; h: number; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width, height: Math.round((width * h) / w) }} className="bg-zinc-100 dark:bg-zinc-800">
      {visible && <SlideStage slide={slide} width={w} height={h} displayWidth={width} />}
    </div>
  );
}

export function SlideStrip() {
  const carousel = useDocument((s) => s.carousel)!;
  const { slideIndex, setSlide } = useEditor();
  const preset = getPreset(carousel.presetId);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const width = preset.width > preset.height ? 180 : 132;

  return (
    <div className="space-y-2 p-3" data-testid="editor-slides">
      <div className="flex gap-1">
        <button className="btn-ghost flex-1 border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700" onClick={() => A.addSlideAfter()}>+ Slide</button>
        <button className="btn-ghost border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700" onClick={() => A.duplicateSlideAt()} title="Duplicate slide">Duplicate</button>
        <button className="btn-ghost border border-zinc-300 px-2 py-1 text-xs text-red-600 dark:border-zinc-700" onClick={() => A.deleteSlideAt()} disabled={carousel.slides.length <= 1} title="Delete slide">Delete</button>
      </div>
      <ol className="space-y-2">
        {carousel.slides.map((s, i) => (
          <li
            key={s.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== i) A.moveSlide(dragFrom, i);
              setDragFrom(null);
              setOver(null);
            }}
            className={`flex cursor-pointer items-start gap-2 rounded-lg p-1 ${i === slideIndex ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'} ${over === i && dragFrom !== null && dragFrom !== i ? 'border-t-4 border-brand-500' : ''}`}
            onClick={() => setSlide(i)}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === slideIndex}
            data-testid="editor-slide-thumb"
          >
            <span className="w-4 pt-1 text-right text-[11px] text-zinc-500">{i + 1}</span>
            <div className="overflow-hidden rounded ring-1 ring-black/10">
              <LazyThumb slide={s} w={preset.width} h={preset.height} width={width} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
