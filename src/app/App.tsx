import { lazy, Suspense, useEffect, useState } from 'react';
import { GeneratePage } from './GeneratePage';

// Heavy screens load on demand (keeps the first paint fast).
const EditorPage = lazy(() => import('@/editor/EditorPage').then((m) => ({ default: m.EditorPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
const Loading = () => <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>;
import { endGesture, useDocument, useProjects, useRoute, useSettings } from './store';
import { ensureSlideFonts, useSlideFonts } from '@/editor/render/fonts';
import { setScriptFontOverrides } from '@/styles/scriptFonts';

export function App() {
  const { route, go: setRoute } = useRoute();
  const hasProject = useProjects((s) => Boolean(s.current));
  const { loaded, settings, load } = useSettings();
  const refresh = useProjects((s) => s.refresh);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  // Whatever carousel is open, load its fonts and script subsets (e.g. Tamil) so it renders correctly.
  useSlideFonts(useDocument((s) => s.carousel?.slides));
  useSlideFonts(useProjects((s) => s.current?.carousel.slides));
  // A chosen font for a script (e.g. Mukta Malar for all Tamil) re-registers the fallbacks; reload what's open.
  useEffect(() => {
    if (!setScriptFontOverrides(settings.scriptFonts ?? {})) return;
    const slides = useDocument.getState().carousel?.slides ?? useProjects.getState().current?.carousel.slides;
    if (slides) void ensureSlideFonts(slides);
  }, [settings.scriptFonts]);

  useEffect(() => {
    void load();
    void refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    // Safety net: a slider drag that ends outside its control still closes the undo gesture.
    const up = (e: PointerEvent) => !(e.target instanceof HTMLInputElement && e.target.type === 'color') && endGesture();
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [load, refresh]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:gap-6 sm:px-4">
          <div className="flex shrink-0 items-center gap-2 font-semibold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">CarouselForge</span>
          </div>
          <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Main">
            {(['generate', 'editor', 'settings'] as const).map((r) => (
              <button key={r} className={`btn-ghost ${route === r ? 'bg-zinc-200/70 dark:bg-zinc-800' : ''}`} aria-current={route === r ? 'page' : undefined} onClick={() => setRoute(r)} disabled={r === 'editor' && !hasProject}>
                {r === 'generate' ? 'Generate' : r === 'editor' ? 'Editor' : 'Settings'}
              </button>
            ))}
          </nav>
          <span className={`ml-auto hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs sm:inline ${online ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>
      <Suspense fallback={<Loading />}>
        {route === 'editor' ? (
          <EditorPage />
        ) : (
          <main className="mx-auto max-w-[1400px] px-4 py-6">{route === 'generate' ? <GeneratePage /> : <SettingsPage />}</main>
        )}
      </Suspense>
    </div>
  );
}
