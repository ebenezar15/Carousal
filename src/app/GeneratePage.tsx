import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  cycleEmphasis, defaultOptions, generatePlan, headlineOptions, makeItMore, nextLayoutId, pickProvider, pickVariations, rewriteSlide, setHeadline,
  variationsFromBrief, themeFromBrief, applyBriefExtras, type CarouselPlan, type Interpretation, type MoreDirection, type Tone,
} from '@/engine';
import { layoutCarousel, prepareLayout } from '@/engine/layout';
import { cacheGet, cachePut, hashKey } from '@/engine/aiCache';
import type { GenerateResult } from '@/engine/types';
import { applyTheme } from '@/editor/ops';
import { DEFAULT_PRESET_ID, getPreset } from '@/styles';
import { newId } from '@/model/id';
import type { CarouselTheme, Project, ContinuousStyle } from '@/model/types';
import { renderSlideToDataURL } from '@/export/render';
const ExportDialog = lazy(() => import('@/export/ExportDialog').then((m) => ({ default: m.ExportDialog })));
const TranslateDialog = lazy(() => import('./TranslateDialog').then((m) => ({ default: m.TranslateDialog })));
import { importProjectFile, PROJECT_EXT } from '@/export/projectFile';
import { providers } from './runtime';
import { readLookPrompt } from './lookPrompt';
import { useDocument, useProjects, useRoute, useSettings } from './store';
import { InputPanel, type InputState } from './generate/InputPanel';
import { VariationsGrid, type VariationPreview } from './generate/VariationsGrid';
import { CarouselView } from './generate/CarouselView';
import { CaptionPanel } from './CaptionPanel';
import { SAMPLES } from './sample';

const PROVIDER_LABEL: Record<string, string> = { claude: 'Claude', ollama: 'Ollama', openai: 'Free / local model', rules: 'Built-in rules' };

const initialInput: InputState = { text: '', designPrompt: '', presetId: DEFAULT_PRESET_ID, opts: defaultOptions, variationCount: 4, handle: '' };

export function GeneratePage() {
  const { settings } = useSettings();
  const { current, projects, save, open, remove } = useProjects();
  const carousel = useDocument((s) => s.carousel);
  const [input, setInput] = useState<InputState>(initialInput);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ key: string; items: VariationPreview[] }>({ key: '', items: [] });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const openFile = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void pickProvider(settings.provider, providers).then((p) => alive && setAiAvailable(Boolean(p)));
    return () => {
      alive = false;
    };
    // Any provider setting (keys, models, the free/local model preset) can change what's available.
  }, [settings]);

  const plan = current?.plan as CarouselPlan | undefined;

  /**
   * Applies a design (and/or new copy) to a project, saves it and shows it. Design-only changes re-theme
   * the open document, so edits made in the editor (moved elements, added images, changed words) are kept;
   * `fresh` lays everything out from scratch (new copy from the AI, a new project).
   */
  async function commit(project: Project, nextPlan: CarouselPlan, theme: CarouselTheme, extra: Partial<Project> = {}, fresh = false) {
    const presetId = project.settings?.presetId ?? project.carousel.presetId;
    const doc = useDocument.getState();
    const isOpen = useProjects.getState().current?.id === project.id;
    const base = isOpen && doc.carousel ? doc.carousel : project.carousel;
    let next;
    if (!fresh && base.slides.length && base.slides.length === nextPlan.slides.length) {
      await prepareLayout(theme, nextPlan);
      next = applyTheme({ carousel: base, plan: nextPlan }, theme, presetId).carousel;
    } else {
      next = await layoutCarousel({ plan: nextPlan, presetId, theme });
    }
    const preset = getPreset(presetId);
    const thumbnail = next.slides[0] ? renderSlideToDataURL(next.slides[0], preset.width, preset.height, { pixelRatio: 240 / preset.width, mime: 'image/jpeg', quality: 0.8 }) : undefined;
    const brandNew = !project.carousel.slides.length;
    const before = useProjects.getState().current;
    const saved = await save({ ...project, ...extra, plan: nextPlan, carousel: next, thumbnail });
    // If another project was opened while this one was working, save quietly and stay where the user is.
    if (brandNew || before?.id === project.id) open(saved);
    else useProjects.setState({ current: before });
    return saved;
  }

  // Variation previews are derived from the project's plan + variation themes (not persisted).
  const previewKey = current ? `${current.id}|${current.variationSeed ?? 0}|${current.carousel.presetId}|${JSON.stringify(current.plan)}` : '';
  const previews = previewState.key === previewKey ? previewState.items : [];
  useEffect(() => {
    if (!current?.plan || !current.variations?.length) return;
    let alive = true;
    const themes = current.variations;
    void Promise.all(themes.map((t) => layoutCarousel({ plan: current.plan as CarouselPlan, presetId: current.carousel.presetId, theme: t }))).then((built) => {
      if (alive) setPreviewState({ key: previewKey, items: built.map((c, i) => ({ label: themes[i]!.label ?? c.theme.styleId, carousel: c })) });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const readPrompt = readLookPrompt;

  const designsFor = (pl: CarouselPlan, it: Interpretation | null, o: { count: number; tone: Tone; seed: number; handle?: string }) =>
    it ? variationsFromBrief(pl, it.brief, o) : pickVariations(pl, o);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      if (!abort.current?.signal.aborted) setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  async function onGenerate(override?: Partial<InputState>) {
    const inp = { ...input, ...override };
    if (override) setInput(inp);
    if (!inp.text.trim()) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setNotice(null);
    await run(async () => {
      const genOpts = { ...inp.opts, maxSlides: getPreset(inp.presetId).maxSlides };
      // The same text with the same settings and model reuses the copy already written (no credits);
      // "Regenerate copy" asks the AI for a new version.
      const cacheKey = hashKey(JSON.stringify([inp.text.trim(), genOpts, settings.provider, settings.claudeModel, settings.ollamaModel, settings.openaiPreset, settings.openaiModel]));
      const cached = settings.provider === 'rules' ? undefined : cacheGet<GenerateResult>('plans', cacheKey);
      const result = cached ? { ...cached, notice: 'Reused the copy written earlier for this exact text and settings (no AI credits used). Use “↻ Regenerate copy” for a fresh version.' } : await generatePlan(inp.text, genOpts, settings.provider, providers, abort.current!.signal);
      if (!cached && result.provider !== 'rules') cachePut('plans', cacheKey, { ...result, notice: undefined });
      const look = await readPrompt(inp.designPrompt, abort.current!.signal);
      const variations = designsFor(result.plan, look, { count: inp.variationCount, tone: inp.opts.tone, seed: 0, handle: inp.handle });
      const project: Project = {
        id: newId('prj_'), name: result.plan.title || 'Untitled carousel', createdAt: Date.now(), updatedAt: Date.now(),
        sourceText: inp.text, plan: result.plan, generatedBy: result.provider, variations: variations.map((v) => v.theme), variationSeed: 0, designPrompt: inp.designPrompt.trim() || undefined,
        settings: { presetId: inp.presetId, tone: inp.opts.tone, audience: inp.opts.audience, language: inp.opts.language, slideCount: inp.opts.slideCount, variationCount: inp.variationCount },
        carousel: { id: '', presetId: inp.presetId, theme: variations[0]!.theme, slides: [] },
      };
      const langNote = result.provider === 'rules' && inp.opts.language !== 'auto' ? ' The built-in rules keep the original language; translating needs an AI model (or use Translate…).' : '';
      const lookNote = look?.understood.length ? ` Design: ${look.understood.join(', ')}.` : '';
      const maxSlides = getPreset(inp.presetId).maxSlides;
      const fitNote = maxSlides < 5 ? ` ${getPreset(inp.presetId).label} allows ${maxSlides} slide${maxSlides > 1 ? 's' : ''}, so the content was condensed.` : '';
      setNotice(`${result.notice ?? ''}${langNote}${fitNote}${lookNote}`.trim() || null);
      await commit(project, result.plan, variations[0]!.theme, {}, true);
    });
  }

  // "Selected" only when the carousel still looks exactly like that design (not after Bolder, Plain…).
  const designKey = (t: CarouselTheme) => JSON.stringify([t.styleId, t.paletteId, t.headingFont, t.bodyFont, t.modifiers ?? {}, t.customPalette ?? null, t.motion ?? null]);
  const selectedIndex = carousel ? (current?.variations?.findIndex((t) => designKey(t) === designKey(carousel.theme)) ?? -1) : -1;

  /** Runs an action against the open project (no-op if none). */
  const act = (job: (p: Project, pl: CarouselPlan) => Promise<void>) => {
    if (!current || !plan) return;
    // The open document is the freshest version (editor and caption edits may not be saved yet).
    const docPlan = useDocument.getState().plan;
    void run(() => job(current, docPlan && docPlan.slides.length === plan.slides.length ? docPlan : plan));
  };

  const pickDesign = (i: number) => act(async (p, pl) => { await commit(p, pl, p.variations![i]!); });
  const newDesigns = () =>
    act(async (p, pl) => {
    const seed = (p.variationSeed ?? 0) + 1;
    const look = await readPrompt(p.designPrompt ?? '');
    const variations = designsFor(pl, look, { count: p.settings?.variationCount ?? 4, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], seed, handle: p.carousel.theme.handle });
    await commit(p, pl, variations[0]!.theme, { variations: variations.map((v) => v.theme), variationSeed: seed });
  });
  const more = (dir: MoreDirection) => act(async (p, pl) => { await commit(p, pl, makeItMore(p.carousel.theme, dir)); });
  const setContinuous = (style: 'off' | ContinuousStyle) =>
    act(async (p, pl) => {
    await commit(p, pl, { ...p.carousel.theme, modifiers: { ...p.carousel.theme.modifiers, panoramic: style !== 'off', continuous: style === 'off' ? undefined : style } });
  });
  const setMotion = (motion: string | undefined) =>
    act(async (p, pl) => {
      if (motion === 'custom') return;
      await commit(p, pl, { ...p.carousel.theme, motion });
    });
  const restyle = (prompt: string) =>
    act(async (p, pl) => {
      const look = await readPrompt(prompt);
      if (!look) return;
      const theme = look.brief.styleId ? themeFromBrief(look.brief, look.brief.styleId, p.carousel.theme.handle) : applyBriefExtras(p.carousel.theme, look.brief);
      setNotice(look.understood.length ? `Design: ${look.understood.join(', ')}.` : 'No design words recognised — try style, color, texture or motion words (e.g. “clay, pastel, bouncy”).');
      await commit(p, pl, theme, { designPrompt: prompt });
    });
  const regenerateCopy = () =>
    act(async (p) => {
    const opts = { ...defaultOptions, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], audience: p.settings?.audience ?? '', language: p.settings?.language ?? 'auto', slideCount: p.settings?.slideCount ?? 'auto', maxSlides: getPreset(p.carousel.presetId).maxSlides };
    abort.current?.abort();
    abort.current = new AbortController();
    const result = await generatePlan(p.sourceText ?? '', opts, settings.provider, providers, abort.current.signal);
    setNotice(result.notice ?? (result.provider === 'rules' ? 'The built-in rules always produce the same copy; connect Claude or Ollama for fresh wording.' : null));
    const { layoutOverrides: _drop, ...theme } = p.carousel.theme;
    void _drop;
    await commit(p, result.plan, theme, { generatedBy: result.provider, name: result.plan.title || p.name }, true);
  });

  const slideActions = {
    newLayout: (i: number) => act(async (p, pl) => {
      const id = nextLayoutId(pl.slides[i]!.role, p.carousel.slides[i]?.layoutId);
      await commit(p, pl, { ...p.carousel.theme, layoutOverrides: { ...p.carousel.theme.layoutOverrides, [i]: id } });
    }),
    newEmphasis: (i: number) => act(async (p, pl) => { await commit(p, cycleEmphasis(pl, i), p.carousel.theme); }),
    rewriteSlide: (i: number) => act(async (p, pl) => {
      const opts = { ...defaultOptions, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], maxSlides: getPreset(p.carousel.presetId).maxSlides };
      abort.current?.abort();
      abort.current = new AbortController();
      const r = await rewriteSlide(pl, i, opts, settings.provider, providers, '', abort.current.signal);
      await commit(p, r.plan, p.carousel.theme);
    }),
    headlineOptions: async (i: number) => {
      if (!plan) return [];
      return headlineOptions(plan, i, { ...defaultOptions, tone: (current?.settings?.tone ?? 'professional') as InputState['opts']['tone'] }, settings.provider, providers);
    },
    setHeadline: (i: number, text: string) => act(async (p, pl) => { await commit(p, setHeadline(pl, i, text), p.carousel.theme); }),
  };

  const openProject = (p: Project) => {
    open(p);
    setNotice(null);
    if (p.settings) setInput((v) => ({ ...v, designPrompt: p.designPrompt ?? v.designPrompt, presetId: p.settings!.presetId, variationCount: p.settings!.variationCount, opts: { ...v.opts, tone: p.settings!.tone as InputState['opts']['tone'], audience: p.settings!.audience, language: p.settings!.language, slideCount: p.settings!.slideCount } }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <InputPanel value={input} onChange={setInput} onGenerate={() => void onGenerate()} busy={busy} />
        <p className="px-1 text-xs text-zinc-500">
          AI: <strong>{settings.provider === 'auto' ? 'Auto (Claude → free model → Ollama → rules)' : PROVIDER_LABEL[settings.provider]}</strong> · change in Settings
        </p>
        <div className="px-1">
          <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openFile.current?.click()}>Open project file (.{PROJECT_EXT})…</button>
          <input
            ref={openFile}
            type="file"
            accept={`.${PROJECT_EXT},application/zip`}
            className="hidden"
            aria-label="Open project file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const p = await importProjectFile(f);
                openProject(await save(p));
                setNotice(`Opened “${p.name}”.`);
              } catch (err) {
                setNotice((err as Error).message);
              }
            }}
          />
        </div>
        {projects.length > 0 && (
          <div className="card p-4">
            <h2 className="label">Recent projects</h2>
            <ul className="space-y-1" data-testid="project-list">
              {(showAll ? projects : projects.slice(0, 8)).map((p) => (
                <li key={p.id} className="group flex items-center gap-2">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-9 w-7 rounded object-cover ring-1 ring-black/10" /> : <div className="h-9 w-7 rounded bg-zinc-200 dark:bg-zinc-800" />}
                  <button className={`min-w-0 flex-1 truncate text-left text-sm hover:text-brand-600 ${current?.id === p.id ? 'font-semibold' : ''}`} onClick={() => openProject(p)}>{p.name}</button>
                  <button className="text-xs text-zinc-400 opacity-60 hover:text-red-600 group-hover:opacity-100" onClick={() => window.confirm(`Delete “${p.name}”? This can't be undone.`) && void remove(p.id)} aria-label={`Delete ${p.name}`}>Delete</button>
                </li>
              ))}
            </ul>
            {projects.length > 8 && (
              <button className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${projects.length} projects`}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`min-w-0 space-y-6 ${current ? '' : 'order-first lg:order-none'}`}>
        {notice && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            {notice}
          </div>
        )}
        {current && carousel && plan ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-semibold">{current.name}</h1>
              <div className="flex gap-2">
                <button className="btn-ghost border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" onClick={() => setTranslating(true)}>Translate…</button>
                <button className="btn-ghost border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" onClick={() => setExporting(true)}>Export…</button>
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => useRoute.getState().go('editor')}>Open in editor →</button>
              </div>
              <span className="text-xs text-zinc-500" data-testid="generated-by">
                {carousel.slides.length} slides · {getPreset(carousel.presetId).width}×{getPreset(carousel.presetId).height} · copy by {PROVIDER_LABEL[current.generatedBy ?? 'rules']}
              </span>
            </div>
            <CarouselView
              carousel={carousel}
              name={current.name}
              busy={busy}
              aiAvailable={aiAvailable}
              onMore={more}
              onContinuous={setContinuous}
              onMotion={setMotion}
              onRestyle={restyle}
              onRegenerateCopy={regenerateCopy}
              actions={slideActions}
            />
            <VariationsGrid previews={previews} selected={selectedIndex} onPick={pickDesign} onNewDesigns={newDesigns} busy={busy} />
            <section className="card p-4" aria-label="Caption and hashtags">
              <h2 className="mb-2 text-sm font-semibold">Caption, hashtags & alt text</h2>
              <CaptionPanel compact key={current.id} />
            </section>
            {exporting && <Suspense fallback={null}><ExportDialog project={current} carousel={carousel} plan={plan} onClose={() => setExporting(false)} /></Suspense>}
            {translating && (
              <Suspense fallback={null}>
                <TranslateDialog
                  project={{ ...current, carousel }}
                  onClose={() => setTranslating(false)}
                  onCreated={async (copy) => {
                    setTranslating(false);
                    open(await useProjects.getState().save(copy));
                    useRoute.getState().go('editor');
                  }}
                />
              </Suspense>
            )}
            <button className="text-xs text-zinc-500 hover:underline" onClick={() => setShowJson((v) => !v)}>{showJson ? 'Hide' : 'Show'} generated plan (JSON)</button>
            {showJson && <pre className="card max-h-96 overflow-auto p-4 text-xs" data-testid="plan-json">{JSON.stringify(plan, null, 2)}</pre>}
          </>
        ) : (
          <Welcome
            busy={busy}
            first={projects.length === 0}
            onSample={(sm) => void onGenerate({ text: sm.text, presetId: sm.preset, opts: { ...input.opts, tone: sm.tone } })}
          />
        )}
      </div>
    </div>
  );
}

/** First-run / empty state: what the app does, three steps, and one-click samples that work offline. */
function Welcome({ busy, first, onSample }: { busy: boolean; first: boolean; onSample(s: (typeof SAMPLES)[number]): void }) {
  return (
    <div className="card p-8" data-testid="welcome">
      <h1 className="text-2xl font-semibold tracking-tight">{first ? 'Welcome to CarouselForge' : 'Start a new carousel'}</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Turn notes, articles or bullet points into polished social carousels. You get several distinct designs, a full editor and exact-size exports for every platform — even offline.
      </p>
      <ol className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ['1', 'Add content', 'Paste text, drop a .docx/.pdf, or import a URL.'],
          ['2', 'Pick a design', 'Compare 3–6 designs side by side; tweak with “make it bolder”.'],
          ['3', 'Edit & export', 'Fine-tune anything, check readability, export PNG, PDF or video.'],
        ].map(([n, t, d]) => (
          <li key={n} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800/60">
            <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">{n}</span>
            <p className="font-medium">{t}</p>
            <p className="text-xs text-zinc-500">{d}</p>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 text-sm font-semibold">Try a sample — one click, no setup</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button key={s.id} className="btn-ghost border border-zinc-300 dark:border-zinc-700" disabled={busy} onClick={() => onSample(s)}>
            <span aria-hidden>{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>
      <p className="mt-6 text-xs text-zinc-500">No AI key? No problem: the built-in rules work offline. Add Claude or a local Ollama model in Settings for smarter copy.</p>
    </div>
  );
}
