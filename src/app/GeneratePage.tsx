import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultOptions, generatePlan, type CarouselPlan, type GenerateOptions, type Tone } from '@/engine';
import { layoutCarousel } from '@/engine/layout';
import { DEFAULT_PRESET_ID, DEFAULT_STYLE_ID, getPalette, getPreset, getStyle, presets, styles } from '@/styles';
import { newId } from '@/model/id';
import type { Project } from '@/model/types';
import { providers } from './runtime';
import { useDocument, useProjects, useSettings } from './store';
import { CarouselStrip } from './CarouselStrip';
import { SAMPLE_CONTENT } from './sample';

const TONES: Tone[] = ['professional', 'playful', 'bold', 'educational'];
const PROVIDER_LABEL = { claude: 'Claude', ollama: 'Ollama', rules: 'Built-in rules' } as const;

export function GeneratePage() {
  const { settings } = useSettings();
  const { current, projects, save, open, remove } = useProjects();
  const carousel = useDocument((s) => s.carousel);
  const [text, setText] = useState('');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [paletteId, setPaletteId] = useState(getStyle(DEFAULT_STYLE_ID).palettes[0]!);
  const [opts, setOpts] = useState<GenerateOptions>(defaultOptions);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const style = getStyle(styleId);
  const preset = getPreset(presetId);
  const platforms = useMemo(() => [...new Set(presets.map((p) => p.platform))], []);

  // Re-layout the open project when the theme changes ("swap theme, keep content").
  useEffect(() => {
    if (!current?.plan || busy) return;
    const t = current.carousel.theme;
    if (t.styleId === styleId && t.paletteId === paletteId && current.carousel.presetId === presetId) return;
    let alive = true;
    void layoutCarousel({ plan: current.plan as CarouselPlan, presetId, styleId, paletteId }).then((next) => {
      if (!alive) return;
      void save({ ...current, carousel: next });
      useDocument.getState().setCarousel(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId, paletteId, presetId]);

  const onStyle = (id: string) => {
    setStyleId(id);
    setPaletteId(getStyle(id).palettes[0]!);
  };

  async function onGenerate() {
    if (!text.trim()) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setNotice(null);
    try {
      const o = { ...opts, maxSlides: preset.maxSlides };
      const result = await generatePlan(text, o, settings.provider, providers, abort.current.signal);
      const next = await layoutCarousel({ plan: result.plan, presetId, styleId, paletteId });
      const project: Project = {
        id: newId('prj_'), name: result.plan.title || 'Untitled carousel', createdAt: Date.now(), updatedAt: Date.now(),
        sourceText: text, plan: result.plan, generatedBy: result.provider, carousel: next,
      };
      open(await save(project));
      setNotice(result.notice ?? null);
    } catch (e) {
      if (!abort.current.signal.aborted) setNotice(`Generation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const openProject = (p: Project) => {
    open(p);
    setPresetId(p.carousel.presetId);
    setStyleId(p.carousel.theme.styleId);
    setPaletteId(p.carousel.theme.paletteId);
    setNotice(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="card space-y-4 p-5" aria-label="Content and options">
        <div>
          <div className="mb-1 flex items-end justify-between">
            <label className="label" htmlFor="content">Your content</label>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setText(SAMPLE_CONTENT)}>
              Use sample
            </button>
          </div>
          <textarea
            id="content"
            className="field h-56 resize-y font-mono text-[13px] leading-relaxed"
            placeholder="Paste notes, a blog post or bullet points. Markdown headings and lists help."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label" htmlFor="preset">Platform</label>
            <select id="preset" className="field" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              {platforms.map((pl) => (
                <optgroup key={pl} label={pl}>
                  {presets.filter((p) => p.platform === pl).map((p) => (
                    <option key={p.id} value={p.id}>{p.label} · {p.width}×{p.height}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="style">Style</label>
            <select id="style" className="field" value={styleId} onChange={(e) => onStyle(e.target.value)}>
              {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="palette">Palette</label>
            <select id="palette" className="field" value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
              {style.palettes.map((id) => <option key={id} value={id}>{getPalette(id).name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="count">Slides</label>
            <select id="count" className="field" value={String(opts.slideCount)} onChange={(e) => setOpts({ ...opts, slideCount: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
              <option value="auto">Auto</option>
              {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tone">Tone</label>
            <select id="tone" className="field" value={opts.tone} onChange={(e) => setOpts({ ...opts, tone: e.target.value as Tone })}>
              {TONES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="audience">Audience (optional)</label>
            <input id="audience" className="field" placeholder="e.g. startup founders" value={opts.audience} onChange={(e) => setOpts({ ...opts, audience: e.target.value })} />
          </div>
        </div>

        <button className="btn-primary w-full" onClick={onGenerate} disabled={busy || !text.trim()}>
          {busy ? 'Generating…' : 'Generate carousel'}
        </button>
        <p className="text-xs text-zinc-500">
          AI: <strong>{settings.provider === 'auto' ? 'Auto (Claude → Ollama → rules)' : PROVIDER_LABEL[settings.provider]}</strong> · change in Settings
        </p>

        {projects.length > 0 && (
          <div>
            <h2 className="label mt-2">Recent projects</h2>
            <ul className="space-y-1" data-testid="project-list">
              {projects.slice(0, 8).map((p) => (
                <li key={p.id} className="group flex items-center gap-2">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-9 w-7 rounded object-cover ring-1 ring-black/10" /> : <div className="h-9 w-7 rounded bg-zinc-200 dark:bg-zinc-800" />}
                  <button className={`flex-1 truncate text-left text-sm hover:text-brand-600 ${current?.id === p.id ? 'font-semibold' : ''}`} onClick={() => openProject(p)}>
                    {p.name}
                  </button>
                  <button className="text-xs text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => remove(p.id)} aria-label={`Delete ${p.name}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-4" aria-label="Result">
        {notice && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            {notice}
          </div>
        )}
        {current && carousel ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-semibold">{current.name}</h1>
              <span className="text-xs text-zinc-500" data-testid="generated-by">
                {carousel.slides.length} slides · {getPreset(carousel.presetId).width}×{getPreset(carousel.presetId).height} · made with {PROVIDER_LABEL[(current.generatedBy ?? 'rules') as keyof typeof PROVIDER_LABEL]}
              </span>
            </div>
            <CarouselStrip
              carousel={carousel}
              name={current.name}
              onThumbnail={(thumb) => { if (current.thumbnail !== thumb) void save({ ...current, carousel, thumbnail: thumb }); }}
            />
            <button className="text-xs text-zinc-500 hover:underline" onClick={() => setShowJson((v) => !v)}>
              {showJson ? 'Hide' : 'Show'} generated plan (JSON)
            </button>
            {showJson && <pre className="card max-h-96 overflow-auto p-4 text-xs" data-testid="plan-json">{JSON.stringify(current.plan, null, 2)}</pre>}
          </>
        ) : (
          <div className="card flex h-80 flex-col items-center justify-center gap-2 p-8 text-center text-zinc-500">
            <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">Paste content and hit Generate</p>
            <p className="text-sm">Works offline: with no AI available, the built-in rules split your content into slides.</p>
          </div>
        )}
      </section>
    </div>
  );
}
