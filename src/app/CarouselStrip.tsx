import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { Carousel } from '@/model/types';
import { getPreset } from '@/styles';
import { ensureFonts } from '@/styles/fontLoader';
import { SlideStage } from '@/editor/SlideStage';
import { renderSlideToDataURL } from '@/export/render';

interface Props {
  carousel: Carousel;
  name: string;
  onThumbnail?: (dataUrl: string) => void;
}

/** Horizontal strip of rendered slides. Waits for the theme's fonts so text is measured correctly. */
export function CarouselStrip({ carousel, name, onThumbnail }: Props) {
  const preset = getPreset(carousel.presetId);
  const stages = useRef<(Konva.Stage | null)[]>([]);
  const fontsKey = `${carousel.id}|${carousel.theme.headingFont}|${carousel.theme.bodyFont}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const ready = loadedKey === fontsKey;

  useEffect(() => {
    let alive = true;
    const ids = new Set<string>([carousel.theme.headingFont, carousel.theme.bodyFont]);
    carousel.slides.forEach((s) => s.elements.forEach((e) => e.kind === 'text' && ids.add(e.fontId)));
    void ensureFonts(ids).then(() => alive && setLoadedKey(fontsKey));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsKey]);

  useEffect(() => {
    if (!ready || !onThumbnail) return;
    const first = stages.current[0];
    if (first) onThumbnail(first.toDataURL({ pixelRatio: 240 / first.width() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, carousel.id]);

  const displayWidth = preset.width >= preset.height ? 360 : 280;

  const download = (i: number) => {
    const slide = carousel.slides[i];
    if (!slide) return;
    const a = document.createElement('a');
    a.href = renderSlideToDataURL(slide, preset.width, preset.height);
    a.download = `${slug(name)}_${String(i + 1).padStart(2, '0')}.png`;
    a.click();
  };

  if (!ready) return <div className="p-8 text-sm text-zinc-500">Loading fonts…</div>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="slide-strip">
      {carousel.slides.map((slide, i) => (
        <figure key={slide.id} className="shrink-0" data-testid="slide" data-role={slide.role}>
          <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <SlideStage ref={(s) => { stages.current[i] = s; }} slide={slide} width={preset.width} height={preset.height} displayWidth={displayWidth} />
          </div>
          <figcaption className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>
              {i + 1} · {slide.role}
              {slide.notes && <span className="ml-1 text-amber-600" title={slide.notes}>⚠</span>}
            </span>
            <button className="hover:text-brand-600" onClick={() => download(i)} aria-label={`Download slide ${i + 1} as PNG`}>
              PNG ↓
            </button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'carousel';
