import { useEffect, useState } from 'react';
import { GeneratePage } from './GeneratePage';
import { SettingsPage } from './SettingsPage';
import { useProjects, useSettings } from './store';

type Route = 'generate' | 'settings';

export function App() {
  const [route, setRoute] = useState<Route>('generate');
  const { loaded, settings, load } = useSettings();
  const refresh = useProjects((s) => s.refresh);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    void load();
    void refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
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
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
          <div className="flex items-center gap-2 font-semibold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            CarouselForge
          </div>
          <nav className="flex gap-1" aria-label="Main">
            {(['generate', 'settings'] as const).map((r) => (
              <button key={r} className={`btn-ghost ${route === r ? 'bg-zinc-200/70 dark:bg-zinc-800' : ''}`} aria-current={route === r ? 'page' : undefined} onClick={() => setRoute(r)}>
                {r === 'generate' ? 'Generate' : 'Settings'}
              </button>
            ))}
          </nav>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${online ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6">{route === 'generate' ? <GeneratePage /> : <SettingsPage />}</main>
    </div>
  );
}
