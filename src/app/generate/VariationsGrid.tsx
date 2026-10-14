import type { Carousel } from '@/model/types';
import { getPreset } from '@/styles';
import { LazyThumb } from '@/editor/SlideStrip';

export interface VariationPreview { label: string; carousel: Carousel }

interface Props {
  previews: VariationPreview[];
  selected: number;
  onPick(i: number): void;
  onNewDesigns(): void;
  busy: boolean;
}

/** Side-by-side design variations of the same content. */
export function VariationsGrid({ previews, selected, onPick, onNewDesigns, busy }: Props) {
  if (!previews.length) return null;
  const preset = getPreset(previews[0]!.carousel.presetId);
  const thumbW = preset.width > preset.height ? 200 : 132;
  return (
    <section aria-label="Design variations" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pick a design <span className="font-normal text-zinc-500">· same content, {previews.length} different designs</span></h2>
        <button className="btn-ghost text-xs" onClick={onNewDesigns} disabled={busy}>↻ New designs</button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2" data-testid="variations">
        {previews.map((v, i) => (
          <article key={i} data-testid="variation" className={`card p-3 transition ${i === selected ? 'ring-2 ring-brand-500' : 'hover:ring-1 hover:ring-zinc-300 dark:hover:ring-zinc-700'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">{v.label}</h3>
              <button className={i === selected ? 'btn-primary px-2.5 py-1 text-xs' : 'btn-ghost border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700'} onClick={() => onPick(i)}>
                {i === selected ? 'Selected' : 'Use this design'}
              </button>
            </div>
            <button className="flex w-full gap-2 overflow-hidden text-left" onClick={() => onPick(i)} aria-label={`Use design ${v.label}`}>
              {v.carousel.slides.slice(0, 4).map((s) => (
                <div key={s.id} className="shrink-0 overflow-hidden rounded ring-1 ring-black/5 dark:ring-white/10">
                  <LazyThumb slide={s} w={preset.width} h={preset.height} width={thumbW} />
                </div>
              ))}
              {v.carousel.slides.length > 4 && <div className="flex shrink-0 items-center px-1 text-xs text-zinc-500">+{v.carousel.slides.length - 4}</div>}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
