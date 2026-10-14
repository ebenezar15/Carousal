import type { Background, BackgroundPattern, Slide } from '@/model/types';
import { getPalette } from '@/styles';
import { useDocument } from '@/app/store';
import { nextLayoutId } from '@/engine/regenerate';
import { rebuildSlide } from '@/engine/layout/engine';
import { IMAGE_ACCEPT, storeImage } from '../assets';
import { useEditor } from '../store';
import type { Doc } from '../ops';
import { ColorField, IconButton, Row, Section, Select, Slider, Toggle } from './fields';
import { PATTERN_OPTIONS, TEXTURE_OPTIONS } from './bgOptions';
import { DEFAULT_TEXTURE_AMOUNT } from '@/engine/layout/backgrounds';
import type { TextureKind } from '@/model/types';

type Kind = 'solid' | 'linear' | 'radial' | 'mesh' | 'image';

const baseColor = (bg: Background) => (bg.type === 'solid' || bg.type === 'image' ? bg.color : bg.type === 'mesh' ? bg.base : bg.stops[0]?.color ?? '#FFFFFF');

function convert(bg: Background, kind: Kind, accent: string): Background {
  const extras = { pattern: bg.pattern, noise: bg.noise, texture: bg.texture, span: bg.span };
  const c = baseColor(bg);
  switch (kind) {
    case 'solid':
      return { ...extras, type: 'solid', color: c };
    case 'linear':
      return { ...extras, type: 'linear', angle: 135, stops: [{ offset: 0, color: c }, { offset: 1, color: accent }] };
    case 'radial':
      return { ...extras, type: 'radial', cx: 0.3, cy: 0.25, radius: 1.1, stops: [{ offset: 0, color: accent }, { offset: 1, color: c }] };
    case 'mesh':
      return { ...extras, type: 'mesh', base: c, points: [{ x: 0.85, y: 0.15, r: 0.65, color: accent }, { x: 0.1, y: 0.85, r: 0.6, color: '#F9A8D4' }, { x: 0.2, y: 0.2, r: 0.4, color: '#A5F3FC' }] };
    case 'image':
      return { ...extras, type: 'image', src: '', color: c, overlay: { color: '#000000', opacity: 0.25 } };
  }
}

export function SlideProps() {
  const carousel = useDocument((s) => s.carousel)!;
  const plan = useDocument((s) => s.plan);
  const apply = useDocument((s) => s.apply);
  const slideIndex = useEditor((s) => s.slideIndex);
  const slide = carousel.slides[slideIndex]!;
  const bg = slide.background;
  const pal = carousel.theme.customPalette ?? getPalette(carousel.theme.paletteId).colors;

  const setSlides = (fn: (s: Slide, i: number) => Slide) => apply((d: Doc) => ({ ...d, carousel: { ...d.carousel, slides: d.carousel.slides.map(fn) } }));
  const setBg = (next: Background) => setSlides((s, i) => (i === slideIndex ? { ...s, background: next } : s));
  const patch = (p: Partial<Background>) => setBg({ ...bg, ...p } as Background);
  const pattern = bg.pattern;
  const setPattern = (p: Partial<BackgroundPattern> | null) => patch({ pattern: p === null ? undefined : { kind: 'dots', color: pal.text, opacity: 0.12, size: 40, ...pattern, ...p } });

  const newLayout = () => {
    if (!plan || slide.manual) return;
    const id = nextLayoutId(plan.slides[slideIndex]!.role, slide.layoutId);
    apply((d) => {
      const theme = { ...d.carousel.theme, layoutOverrides: { ...d.carousel.theme.layoutOverrides, [slideIndex]: id } };
      const fresh = rebuildSlide(d.plan, d.carousel.presetId, theme, slideIndex);
      const userEls = d.carousel.slides[slideIndex]!.elements.filter((e) => !e.slot);
      return { ...d, carousel: { ...d.carousel, theme, slides: d.carousel.slides.map((s, i) => (i === slideIndex ? { ...fresh, id: s.id, background: s.background, elements: [...fresh.elements, ...userEls] } : s)) } };
    });
  };

  const spanning = Boolean(bg.span);
  return (
    <>
      <Section title={`Slide ${slideIndex + 1}${slide.role ? ` · ${slide.role}` : ''}`}>
        {slide.layoutId && !slide.manual && <p className="text-[11px] text-zinc-500">Layout: {slide.layoutId}</p>}
        <div className="flex flex-wrap gap-1">
          {!slide.manual && plan && <IconButton label="New layout for this slide" onClick={newLayout}>↻ New layout</IconButton>}
        </div>
        {slide.notes && <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">⚠ {slide.notes}</p>}
      </Section>
      <Section title="Background">
        <Select<Kind> label="Type" value={bg.type} options={[['solid', 'Solid color'], ['linear', 'Linear gradient'], ['radial', 'Radial gradient'], ['mesh', 'Mesh gradient'], ['image', 'Image']]} onChange={(k) => setBg(convert(bg, k, pal.primary))} />
        {bg.type === 'solid' && <ColorField label="Color" value={bg.color} onChange={(c) => patch({ color: c ?? '#FFFFFF' })} />}
        {(bg.type === 'linear' || bg.type === 'radial') && (
          <>
            <Row>
              {bg.stops.map((st, i) => (
                <ColorField key={i} label={i === 0 ? (bg.type === 'radial' ? 'Center' : 'Start') : bg.type === 'radial' ? 'Edge' : 'End'} value={st.color} onChange={(c) => patch({ stops: bg.stops.map((x, j) => (j === i ? { ...x, color: c ?? '#FFFFFF' } : x)) })} />
              ))}
            </Row>
            {bg.type === 'linear' && <Slider label="Angle" value={bg.angle} min={0} max={360} onChange={(a) => patch({ angle: a })} format={(v) => `${v}°`} />}
            {bg.type === 'radial' && (
              <>
                <Slider label="Center X" value={bg.cx} min={0} max={1} step={0.01} onChange={(v) => patch({ cx: v })} />
                <Slider label="Center Y" value={bg.cy} min={0} max={1} step={0.01} onChange={(v) => patch({ cy: v })} />
                <Slider label="Spread" value={bg.radius} min={0.2} max={2} step={0.05} onChange={(v) => patch({ radius: v })} />
              </>
            )}
          </>
        )}
        {bg.type === 'mesh' && (
          <>
            <ColorField label="Base" value={bg.base} onChange={(c) => patch({ base: c ?? '#FFFFFF' })} />
            <Row>
              {bg.points.map((p, i) => (
                <ColorField key={i} label={`Blob ${i + 1}`} value={p.color} onChange={(c) => patch({ points: bg.points.map((x, j) => (j === i ? { ...x, color: c ?? '#FFFFFF' } : x)) })} />
              ))}
            </Row>
          </>
        )}
        {bg.type === 'image' && (
          <>
            <label className="block cursor-pointer rounded-md border border-dashed border-zinc-300 p-2 text-center text-xs hover:border-brand-500 dark:border-zinc-700">
              {bg.src ? 'Replace background image…' : 'Upload background image…'}
              <input type="file" accept={IMAGE_ACCEPT} className="hidden" aria-label="Background image" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) patch({ src: await storeImage(f, f.name) }); }} />
            </label>
            <Row>
              <ColorField label="Overlay" value={bg.overlay?.color} onChange={(c) => patch({ overlay: c ? { color: c, opacity: bg.overlay?.opacity ?? 0.3 } : undefined })} allowNone />
              <ColorField label="Fallback color" value={bg.color} onChange={(c) => patch({ color: c ?? '#FFFFFF' })} />
            </Row>
            {bg.overlay && <Slider label="Overlay opacity" value={bg.overlay.opacity} min={0} max={0.95} step={0.05} onChange={(o) => patch({ overlay: { ...bg.overlay!, opacity: o } })} />}
            <Slider label="Blur" value={bg.filters?.blur ?? 0} min={0} max={40} onChange={(v) => patch({ filters: { ...bg.filters, blur: v } })} />
          </>
        )}
      </Section>
      <Section title="Texture & pattern">
        <IconButton label="Plain background: one flat color, no texture or pattern" onClick={() => setBg({ type: 'solid', color: baseColor(bg), span: bg.span })}>Plain background</IconButton>
        <Select label="Texture" value={bg.texture?.kind ?? 'none'} options={[['none', 'None'], ...TEXTURE_OPTIONS]} onChange={(k) => patch({ texture: k === 'none' ? undefined : { kind: k as TextureKind, amount: bg.texture?.amount ?? DEFAULT_TEXTURE_AMOUNT[k as TextureKind] ?? 0.5, scale: bg.texture?.scale } })} />
        {bg.texture && (
          <Row>
            <Slider label="Texture strength" value={bg.texture.amount} min={0.05} max={1} step={0.05} onChange={(v) => patch({ texture: { ...bg.texture!, amount: v } })} />
            <Slider label="Texture scale" value={bg.texture.scale ?? 1} min={0.25} max={3} step={0.25} onChange={(v) => patch({ texture: { ...bg.texture!, scale: v } })} />
          </Row>
        )}
        <Select label="Pattern" value={pattern?.kind ?? 'none'} options={[['none', 'None'], ...PATTERN_OPTIONS]} onChange={(k) => setPattern(k === 'none' ? null : { kind: k as BackgroundPattern['kind'] })} />
        {pattern && (
          <>
            <ColorField label="Pattern color" value={pattern.color} onChange={(c) => setPattern({ color: c ?? '#000000' })} />
            <Slider label="Pattern opacity" value={pattern.opacity} min={0.02} max={0.6} step={0.01} onChange={(v) => setPattern({ opacity: v })} />
            <Slider label="Pattern size" value={pattern.size} min={8} max={160} onChange={(v) => setPattern({ size: v })} />
          </>
        )}
        <Slider label="Grain" value={bg.noise ?? 0} min={0} max={0.3} step={0.01} onChange={(v) => patch({ noise: v || undefined })} />
      </Section>
      <Section title="All slides">
        <Toggle
          label="Span background across all slides (seamless)"
          checked={spanning}
          onChange={(on) => setSlides((s, i) => ({ ...s, background: { ...bg, span: on ? { index: i, count: carousel.slides.length } : undefined } as Background }))}
        />
        <label className="block cursor-pointer rounded-md border border-dashed border-zinc-300 p-2 text-center text-xs hover:border-brand-500 dark:border-zinc-700">
          Panoramic photo across all slides…
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            aria-label="Panoramic photo"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const src = await storeImage(f, f.name);
              setSlides((s, i) => ({ ...s, background: { type: 'image', src, color: baseColor(bg), overlay: { color: '#000000', opacity: 0.2 }, span: { index: i, count: carousel.slides.length } } }));
            }}
          />
        </label>
        <IconButton label="Apply this background to all slides" onClick={() => setSlides((s, i) => ({ ...s, background: { ...bg, span: bg.span ? { index: i, count: carousel.slides.length } : undefined } as Background }))}>Apply background to all slides</IconButton>
      </Section>
    </>
  );
}
