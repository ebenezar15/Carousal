import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useDocument, useProjects, useRoute } from '@/app/store';
import { getPreset } from '@/styles';
import { renderSlide } from '@/export/render';
import { ExportDialog } from '@/export/ExportDialog';
import { EditorCanvas } from './EditorCanvas';
import { Inspector } from './Inspector';
import { SlideStrip } from './SlideStrip';
import { LayersPanel } from './LayersPanel';
import { InsertPanel } from './panels/InsertPanel';
import { DesignPanel } from './panels/DesignPanel';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { useEditor, type LeftTab } from './store';
import { useShortcuts } from './useShortcuts';
import * as A from './actions';
import { imageElement, storeImage } from './assets';

const TABS: [LeftTab, string][] = [['slides', 'Slides'], ['layers', 'Layers'], ['insert', 'Insert'], ['design', 'Design'], ['templates', 'Templates']];

/** Debounced autosave of the open document back into its project. */
function useAutosave() {
  const timer = useRef<number | undefined>(undefined);
  const [saved, setSaved] = useState<'saved' | 'saving'>('saved');
  useEffect(
    () =>
      useDocument.subscribe((s, prev) => {
        if (s.carousel === prev.carousel && s.plan === prev.plan) return;
        setSaved('saving');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(async () => {
          const { current, save } = useProjects.getState();
          const { carousel, plan } = useDocument.getState();
          if (!current || !carousel) return;
          let thumbnail = current.thumbnail;
          try {
            const p = getPreset(carousel.presetId);
            if (carousel.slides[0]) thumbnail = await renderSlide(carousel.slides[0], p.width, p.height, { pixelRatio: 240 / p.width, mime: 'image/jpeg', quality: 0.8 });
          } catch {
            /* keep old thumbnail */
          }
          await save({ ...current, carousel, plan: plan ?? current.plan, thumbnail });
          setSaved('saved');
        }, 700);
      }),
    [],
  );
  return saved;
}

export function EditorPage() {
  const carousel = useDocument((s) => s.carousel);
  const current = useProjects((s) => s.current);
  const save = useProjects((s) => s.save);
  const go = useRoute((s) => s.go);
  const ed = useEditor();
  const canUndo = useStore(useDocument.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(useDocument.temporal, (t) => t.futureStates.length > 0);
  const saved = useAutosave();
  const plan = useDocument((s) => s.plan);
  const [exporting, setExporting] = useState(false);
  useShortcuts();

  useEffect(() => {
    if (carousel && ed.slideIndex >= carousel.slides.length) ed.setSlide(carousel.slides.length - 1);
  }, [carousel, ed]);

  if (!carousel || !current) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Open or generate a carousel first.</p>
        <button className="btn-primary" onClick={() => go('generate')}>Go to Generate</button>
      </div>
    );
  }
  const preset = getPreset(carousel.presetId);

  const onDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    for (const f of files) A.addElement(await imageElement(await storeImage(f, f.name), preset, { name: f.name }));
  };


  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col" data-testid="editor">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950" role="toolbar" aria-label="Editor">
        <input aria-label="Project name" className="w-56 rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 focus:bg-white focus:outline-brand-500 dark:hover:bg-zinc-800 dark:focus:bg-zinc-900" value={current.name} onChange={(e) => void save({ ...current, name: e.target.value })} />
        <span className="mr-2 text-[11px] text-zinc-400" role="status">{saved === 'saving' ? 'Saving…' : 'Saved'}</span>
        <button className="btn-ghost px-2 py-1" onClick={A.undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
        <button className="btn-ghost px-2 py-1" onClick={A.redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
        <span className="mx-2 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button className="btn-ghost px-2 py-1" onClick={() => ed.setZoom(ed.zoom / 1.2)} aria-label="Zoom out">−</button>
        <button className="btn-ghost w-14 px-1 py-1 text-xs" onClick={ed.setFit} title="Fit (Ctrl+0)" aria-label="Zoom to fit">{Math.round(ed.zoom * 100)}%</button>
        <button className="btn-ghost px-2 py-1" onClick={() => ed.setZoom(ed.zoom * 1.2)} aria-label="Zoom in">+</button>
        <span className="mx-2 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
        {(
          [
            ['showGrid', 'Grid'],
            ['showRulers', 'Rulers'],
            ['showSafe', 'Safe zone'],
            ['snap', 'Snap'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`rounded px-2 py-1 text-xs ${ed[k] ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} aria-pressed={ed[k]} onClick={() => ed.toggle(k)}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-400">{preset.label} · {preset.width}×{preset.height}</span>
        <button className="btn-primary px-3 py-1 text-xs" onClick={() => setExporting(true)}>Export…</button>
      </div>
      {exporting && <ExportDialog project={current} carousel={carousel} plan={plan} initialSlide={ed.slideIndex} onClose={() => setExporting(false)} />}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="Editor panels">
            {TABS.map(([t, l]) => (
              <button key={t} role="tab" aria-selected={ed.leftTab === t} className={`flex-1 px-1 py-2 text-[11px] font-medium ${ed.leftTab === t ? 'border-b-2 border-brand-500 text-brand-600' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`} onClick={() => ed.setLeftTab(t)}>
                {l}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {ed.leftTab === 'slides' && <SlideStrip />}
            {ed.leftTab === 'layers' && <LayersPanel />}
            {ed.leftTab === 'insert' && <InsertPanel />}
            {ed.leftTab === 'design' && <DesignPanel />}
            {ed.leftTab === 'templates' && <TemplatesPanel />}
          </div>
        </aside>
        <main className="min-w-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void onDrop(e)}>
          <EditorCanvas />
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" aria-label="Properties">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
