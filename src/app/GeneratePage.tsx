import { useEffect, useRef, useState } from 'react';
import {
  cycleEmphasis, defaultOptions, generatePlan, headlineOptions, makeItMore, nextLayoutId, pickProvider, pickVariations, rewriteSlide, setHeadline,
  type CarouselPlan, type MoreDirection,
} from '@/engine';
import { layoutCarousel } from '@/engine/layout';
import { DEFAULT_PRESET_ID, getPreset } from '@/styles';
import { newId } from '@/model/id';
import type { CarouselTheme, Project } from '@/model/types';
import { renderSlideToDataURL } from '@/export/render';
import { ExportDialog } from '@/export/ExportDialog';
import { importProjectFile, PROJECT_EXT } from '@/export/projectFile';
import { providers } from './runtime';
import { useDocument, useProjects, useRoute, useSettings } from './store';
import { InputPanel, type InputState } from './generate/InputPanel';
import { VariationsGrid, type VariationPreview } from './generate/VariationsGrid';
import { CarouselView } from './generate/CarouselView';

const PROVIDER_LABEL: Record<string, string> = { claude: 'Claude', ollama: 'Ollama', rules: 'Built-in rules' };

const initialInput: InputState = { text: '', presetId: DEFAULT_PRESET_ID, opts: defaultOptions, variationCount: 4, handle: '' };

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
  const openFile = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void pickProvider(settings.provider, providers).then((p) => alive && setAiAvailable(Boolean(p)));
    return () => {
      alive = false;
    };
  }, [settings.provider, settings.claudeModel, settings.ollamaUrl]);

  const plan = current?.plan as CarouselPlan | undefined;
  const genOpts = () => ({ ...input.opts, maxSlides: getPreset(input.presetId).maxSlides });

  /** Lays out a theme for the current plan, saves it as the project's carousel and refreshes the thumbnail. */
  async function commit(project: Project, nextPlan: CarouselPlan, theme: CarouselTheme, extra: Partial<Project> = {}) {
    const presetId = project.settings?.presetId ?? project.carousel.presetId;
    const next = await layoutCarousel({ plan: nextPlan, presetId, theme });
    const preset = getPreset(presetId);
    const thumbnail = next.slides[0] ? renderSlideToDataURL(next.slides[0], preset.width, preset.height, { pixelRatio: 240 / preset.width, mime: 'image/jpeg', quality: 0.8 }) : undefined;
    const saved = await save({ ...project, ...extra, plan: nextPlan, carousel: next, thumbnail });
    open(saved);
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

  async function onGenerate() {
    if (!input.text.trim()) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setNotice(null);
    await run(async () => {
      const result = await generatePlan(input.text, genOpts(), settings.provider, providers, abort.current!.signal);
      const variations = pickVariations(result.plan, { count: input.variationCount, tone: input.opts.tone, seed: 0, handle: input.handle });
      const project: Project = {
        id: newId('prj_'), name: result.plan.title || 'Untitled carousel', createdAt: Date.now(), updatedAt: Date.now(),
        sourceText: input.text, plan: result.plan, generatedBy: result.provider, variations: variations.map((v) => v.theme), variationSeed: 0,
        settings: { presetId: input.presetId, tone: input.opts.tone, audience: input.opts.audience, language: input.opts.language, slideCount: input.opts.slideCount, variationCount: input.variationCount },
        carousel: { id: '', presetId: input.presetId, theme: variations[0]!.theme, slides: [] },
      };
      const langNote = result.provider === 'rules' && input.opts.language !== 'auto' ? ' The built-in rules keep the original language; translation needs Claude or Ollama.' : '';
      setNotice(result.notice ? result.notice + langNote : langNote.trim() || null);
      await commit(project, result.plan, variations[0]!.theme);
    });
  }

  const selectedIndex = current?.variations?.findIndex((t) => t.styleId === carousel?.theme.styleId && t.paletteId === carousel?.theme.paletteId) ?? -1;

  /** Runs an action against the open project (no-op if none). */
  const act = (job: (p: Project, pl: CarouselPlan) => Promise<void>) => {
    if (!current || !plan) return;
    void run(() => job(current, plan));
  };

  const pickDesign = (i: number) => act(async (p, pl) => { await commit(p, pl, p.variations![i]!); });
  const newDesigns = () =>
    act(async (p, pl) => {
    const seed = (p.variationSeed ?? 0) + 1;
    const variations = pickVariations(pl, { count: p.settings?.variationCount ?? 4, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], seed, handle: p.carousel.theme.handle });
    await commit(p, pl, variations[0]!.theme, { variations: variations.map((v) => v.theme), variationSeed: seed });
  });
  const more = (dir: MoreDirection) => act(async (p, pl) => { await commit(p, pl, makeItMore(p.carousel.theme, dir)); });
  const togglePanoramic = () =>
    act(async (p, pl) => {
    const isOn = p.carousel.slides[0]?.background.span !== undefined;
    await commit(p, pl, { ...p.carousel.theme, modifiers: { ...p.carousel.theme.modifiers, panoramic: !isOn } });
  });
  const regenerateCopy = () =>
    act(async (p) => {
    const opts = { ...defaultOptions, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], audience: p.settings?.audience ?? '', language: p.settings?.language ?? 'auto', slideCount: p.settings?.slideCount ?? 'auto', maxSlides: getPreset(p.carousel.presetId).maxSlides };
    const result = await generatePlan(p.sourceText ?? '', opts, settings.provider, providers);
    setNotice(result.notice ?? (result.provider === 'rules' ? 'The built-in rules always produce the same copy; connect Claude or Ollama for fresh wording.' : null));
    const { layoutOverrides: _drop, ...theme } = p.carousel.theme;
    void _drop;
    await commit(p, result.plan, theme, { generatedBy: result.provider, name: result.plan.title || p.name });
  });

  const slideActions = {
    newLayout: (i: number) => act(async (p, pl) => {
      const id = nextLayoutId(pl.slides[i]!.role, p.carousel.slides[i]?.layoutId);
      await commit(p, pl, { ...p.carousel.theme, layoutOverrides: { ...p.carousel.theme.layoutOverrides, [i]: id } });
    }),
    newEmphasis: (i: number) => act(async (p, pl) => { await commit(p, cycleEmphasis(pl, i), p.carousel.theme); }),
    rewriteSlide: (i: number) => act(async (p, pl) => {
      const opts = { ...defaultOptions, tone: (p.settings?.tone ?? 'professional') as InputState['opts']['tone'], maxSlides: getPreset(p.carousel.presetId).maxSlides };
      const r = await rewriteSlide(pl, i, opts, settings.provider, providers);
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
    if (p.settings) setInput((v) => ({ ...v, presetId: p.settings!.presetId, variationCount: p.settings!.variationCount, opts: { ...v.opts, tone: p.settings!.tone as InputState['opts']['tone'], audience: p.settings!.audience, language: p.settings!.language, slideCount: p.settings!.slideCount } }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <InputPanel value={input} onChange={setInput} onGenerate={onGenerate} busy={busy} />
        <p className="px-1 text-xs text-zinc-500">
          AI: <strong>{settings.provider === 'auto' ? 'Auto (Claude → Ollama → rules)' : PROVIDER_LABEL[settings.provider]}</strong> · change in Settings
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
              {projects.slice(0, 8).map((p) => (
                <li key={p.id} className="group flex items-center gap-2">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-9 w-7 rounded object-cover ring-1 ring-black/10" /> : <div className="h-9 w-7 rounded bg-zinc-200 dark:bg-zinc-800" />}
                  <button className={`flex-1 truncate text-left text-sm hover:text-brand-600 ${current?.id === p.id ? 'font-semibold' : ''}`} onClick={() => openProject(p)}>{p.name}</button>
                  <button className="text-xs text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => remove(p.id)} aria-label={`Delete ${p.name}`}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-6">
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
              onTogglePanoramic={togglePanoramic}
              onRegenerateCopy={regenerateCopy}
              actions={slideActions}
            />
            <VariationsGrid previews={previews} selected={selectedIndex} onPick={pickDesign} onNewDesigns={newDesigns} busy={busy} />
            {exporting && <ExportDialog project={current} carousel={carousel} plan={plan} onClose={() => setExporting(false)} />}
            <button className="text-xs text-zinc-500 hover:underline" onClick={() => setShowJson((v) => !v)}>{showJson ? 'Hide' : 'Show'} generated plan (JSON)</button>
            {showJson && <pre className="card max-h-96 overflow-auto p-4 text-xs" data-testid="plan-json">{JSON.stringify(plan, null, 2)}</pre>}
          </>
        ) : (
          <div className="card flex h-80 flex-col items-center justify-center gap-2 p-8 text-center text-zinc-500">
            <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">Paste content, upload a file or import a URL — then Generate</p>
            <p className="text-sm">You'll get several distinct designs of the same content. Works offline: with no AI available, the built-in rules split your content into slides.</p>
          </div>
        )}
      </div>
    </div>
  );
}
