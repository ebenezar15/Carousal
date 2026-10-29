import { useState } from 'react';
import type { Carousel, ContinuousStyle } from '@/model/types';
import type { MoreDirection } from '@/engine';
import { getPreset } from '@/styles';
import { LazyThumb } from '@/editor/SlideStrip';
import { renderSlide } from '@/export/render';
import { ANIMATION_PRESETS } from '@/editor/animation';

export interface SlideActions {
  newLayout(i: number): void;
  newEmphasis(i: number): void;
  rewriteSlide(i: number): void;
  headlineOptions(i: number): Promise<string[]>;
  setHeadline(i: number, text: string): void;
}

interface Props {
  carousel: Carousel;
  name: string;
  busy: boolean;
  aiAvailable: boolean;
  onMore(dir: MoreDirection): void;
  onContinuous(style: 'off' | ContinuousStyle): void;
  onMotion(motion: string | undefined): void;
  onRestyle(prompt: string): void;
  onRegenerateCopy(): void;
  actions: SlideActions;
}

export const CONTINUOUS_OPTIONS: ['off' | ContinuousStyle, string][] = [
  ['off', 'Off'], ['flow', 'Seamless flow'], ['ribbon', 'Ribbon'], ['path', 'Journey path'], ['blocks', 'Split shapes'], ['word', 'Giant word'],
];

const MORE: { dir: MoreDirection; label: string }[] = [
  { dir: 'bold', label: 'Bolder' },
  { dir: 'minimal', label: 'More minimal' },
  { dir: 'colorful', label: 'More colorful' },
  { dir: 'professional', label: 'More professional' },
  { dir: 'plain', label: 'Plain' },
  { dir: 'textured', label: 'Textured' },
];

export const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'carousel';

export function CarouselView({ carousel, name, busy, aiAvailable, onMore, onContinuous, onMotion, onRestyle, onRegenerateCopy, actions }: Props) {
  const [restyle, setRestyle] = useState('');
  const preset = getPreset(carousel.presetId);
  const displayWidth = preset.width > preset.height ? 380 : 290;
  const [options, setOptions] = useState<{ index: number; items: string[] | 'loading' | string } | null>(null);
  const panoramic = carousel.slides[0]?.background.span !== undefined;

  const download = async (i: number) => {
    const slide = carousel.slides[i];
    if (!slide) return;
    const a = document.createElement('a');
    a.href = await renderSlide(slide, preset.width, preset.height);
    a.download = `${slug(name)}_${String(i + 1).padStart(2, '0')}.png`;
    a.click();
  };

  const loadHeadlines = async (i: number) => {
    setOptions({ index: i, items: 'loading' });
    try {
      setOptions({ index: i, items: await actions.headlineOptions(i) });
    } catch (e) {
      setOptions({ index: i, items: (e as Error).message });
    }
  };

  return (
    <section aria-label="Selected carousel" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Design adjustments">
        <span className="text-xs font-medium text-zinc-500">Make it:</span>
        {MORE.map((m) => (
          <button key={m.dir} className="btn-ghost border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700" onClick={() => onMore(m.dir)} disabled={busy}>
            {m.label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          Continuous slides
          <select aria-label="Continuous slides" className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={panoramic ? carousel.theme.modifiers?.continuous ?? 'flow' : 'off'} onChange={(e) => onContinuous(e.target.value as 'off' | ContinuousStyle)} disabled={busy}>
            {CONTINUOUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          Motion
          <select aria-label="Motion" className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={carousel.theme.motion ?? 'style'} onChange={(e) => onMotion(e.target.value === 'style' ? undefined : e.target.value)} disabled={busy}>
            <option value="style">Style default</option>
            {carousel.theme.motion === 'custom' && <option value="custom">My own</option>}
            {ANIMATION_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={onRegenerateCopy} disabled={busy} title="Generate the copy again with the same settings and design">
          ↻ Regenerate copy
        </button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (restyle.trim()) onRestyle(restyle.trim());
        }}
      >
        <input aria-label="Restyle with a prompt" className="field min-w-0 flex-1 py-1 text-xs" placeholder="Restyle: e.g. “graffiti, dark wall, neon pink” or “make it clay with a ribbon across slides”" value={restyle} onChange={(e) => setRestyle(e.target.value)} />
        <button className="btn-ghost border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700" disabled={busy || !restyle.trim()}>Apply look</button>
      </form>

      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="slide-strip">
        {carousel.slides.map((slide, i) => (
          <figure key={slide.id} className="shrink-0" style={{ width: displayWidth }} data-testid="slide" data-role={slide.role} data-layout={slide.layoutId}>
            <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <LazyThumb slide={slide} w={preset.width} h={preset.height} width={displayWidth} />
            </div>
            <figcaption className="mt-2 space-y-1.5 text-xs text-zinc-500">
              <div className="flex items-center justify-between">
                <span>
                  {i + 1} · {slide.role}
                  {slide.notes && <span className="ml-1 text-amber-600" title={slide.notes}>⚠ too long</span>}
                </span>
                <button className="hover:text-brand-600" onClick={() => void download(i)} aria-label={`Download slide ${i + 1} as PNG`}>PNG ↓</button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button className="rounded border border-zinc-300 px-1.5 py-0.5 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700" onClick={() => actions.newLayout(i)} disabled={busy} aria-label={`New layout for slide ${i + 1}`}>↻ Layout</button>
                <button className="rounded border border-zinc-300 px-1.5 py-0.5 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700" onClick={() => actions.newEmphasis(i)} disabled={busy} aria-label={`New emphasis for slide ${i + 1}`}>Emphasis</button>
                <button className="rounded border border-zinc-300 px-1.5 py-0.5 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 dark:border-zinc-700" onClick={() => actions.rewriteSlide(i)} disabled={busy || !aiAvailable} title={aiAvailable ? 'Rewrite this slide with AI' : 'Needs an AI model (set one up in Settings)'} aria-label={`Rewrite slide ${i + 1}`}>✎ Rewrite</button>
                <button className="rounded border border-zinc-300 px-1.5 py-0.5 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 dark:border-zinc-700" onClick={() => void loadHeadlines(i)} disabled={busy || !aiAvailable || options?.items === 'loading'} title={aiAvailable ? 'Alternative headlines' : 'Needs an AI model (set one up in Settings)'} aria-label={`Alternative headlines for slide ${i + 1}`}>Headline</button>
              </div>
              {options?.index === i && (
                <div className="card space-y-1 p-2" role="listbox" aria-label="Headline options">
                  {options.items === 'loading' ? (
                    <p>Thinking…</p>
                  ) : typeof options.items === 'string' ? (
                    <p className="text-red-600">{options.items}</p>
                  ) : (
                    options.items.map((h) => (
                      <button key={h} role="option" aria-selected={false} className="block w-full rounded px-1.5 py-1 text-left text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800" onClick={() => { actions.setHeadline(i, h); setOptions(null); }}>
                        {h}
                      </button>
                    ))
                  )}
                  <button className="text-zinc-400 hover:underline" onClick={() => setOptions(null)}>Close</button>
                </div>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
