// Ollama settings + model manager: see installed models, download free recommended ones with progress,
// delete ones you no longer need, and pick a separate (smaller) model for quick tasks.
import { useEffect, useRef, useState } from 'react';
import { deleteOllamaModel, listOllamaModels, pullOllamaModel, RECOMMENDED_OLLAMA_MODELS, type OllamaModel, type PullProgress } from '@/engine';
import { isTauri } from '@/secrets';
import { useSettings } from '../store';

const gb = (bytes?: number) => (bytes ? `${(bytes / 1e9).toFixed(1)} GB` : '');

export function OllamaSection() {
  const { settings, update } = useSettings();
  const [models, setModels] = useState<OllamaModel[] | null | 'checking'>('checking');
  const [pulling, setPulling] = useState<{ name: string; p: PullProgress } | null>(null);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState('');
  const abort = useRef<AbortController | null>(null);
  const desktop = isTauri();

  const refresh = async () => {
    setModels('checking');
    setModels(await listOllamaModels(settings.ollamaUrl));
  };
  useEffect(() => {
    let alive = true;
    void listOllamaModels(settings.ollamaUrl).then((m) => alive && setModels(m));
    return () => {
      alive = false;
    };
  }, [settings.ollamaUrl]);

  const installed = Array.isArray(models) ? models : [];
  const has = (name: string) => installed.some((m) => m.name === name || m.name === `${name}:latest`);

  const pull = async (name: string) => {
    setError('');
    abort.current = new AbortController();
    setPulling({ name, p: { status: 'starting' } });
    try {
      await pullOllamaModel(settings.ollamaUrl, name, (p) => setPulling({ name, p }), abort.current.signal);
      if (!settings.ollamaModel) await update({ ollamaModel: name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setPulling(null);
      await refresh();
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete ${name} from this computer?`)) return;
    try {
      await deleteOllamaModel(settings.ollamaUrl, name);
      if (settings.ollamaModel === name) await update({ ollamaModel: '' });
      if (settings.ollamaFastModel === name) await update({ ollamaFastModel: '' });
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  };

  const pct = pulling?.p.total ? Math.round(((pulling.p.completed ?? 0) / pulling.p.total) * 100) : null;

  return (
    <section className="card space-y-3 p-5" aria-labelledby="ollama-h">
      <h2 id="ollama-h" className="font-semibold">Ollama (offline AI)</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ollama-url">Server URL</label>
          <input id="ollama-url" className="field" value={settings.ollamaUrl} onChange={(e) => update({ ollamaUrl: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ollama-model">Model</label>
          <select id="ollama-model" className="field" value={settings.ollamaModel} onChange={(e) => update({ ollamaModel: e.target.value })} disabled={installed.length === 0}>
            <option value="">First available</option>
            {installed.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ollama-fast">Model for quick tasks</label>
          <select id="ollama-fast" className="field" value={settings.ollamaFastModel} onChange={(e) => update({ ollamaFastModel: e.target.value })} disabled={installed.length === 0}>
            <option value="">Same as above</option>
            {installed.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm" role="status">
        {models === 'checking' ? (
          <span className="text-zinc-500">Checking…</span>
        ) : models === null ? (
          <span className="text-amber-700 dark:text-amber-400">Not detected.</span>
        ) : models.length === 0 ? (
          <span className="text-amber-700 dark:text-amber-400">Running, but no models installed — download one below.</span>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-400">Connected · {models.length} model{models.length > 1 ? 's' : ''}</span>
        )}
        <button className="btn-ghost px-2 py-1 text-xs" onClick={refresh}>Re-check</button>
      </div>

      {models === null && (
        <div className="rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <p>1. Install Ollama (free) from <strong>ollama.com/download</strong> — Windows, macOS and Linux. It runs in the background after installing.</p>
          <p className="mt-1">2. Come back here and press Re-check; then download a model below (or run <code>ollama pull gemma3:4b</code>).</p>
          {!desktop && (
            <p className="mt-1">
              3. The browser version also needs Ollama to accept requests from this page. Start it with <code>OLLAMA_ORIGINS={location.origin} ollama serve</code>. The desktop app does not need this.
            </p>
          )}
        </div>
      )}

      {Array.isArray(models) && (
        <>
          {installed.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Installed</h3>
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800" data-testid="ollama-installed">
                {installed.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-medium">{m.name}</span> <span className="text-xs text-zinc-500">{[m.details?.parameter_size, gb(m.size)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => remove(m.name)} aria-label={`Delete ${m.name}`}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Free models to download</h3>
            <ul className="space-y-2">
              {RECOMMENDED_OLLAMA_MODELS.map((m) => (
                <li key={m.name} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <span>
                    <span className="font-medium">{m.name}</span> <span className="text-xs text-zinc-500">{m.size} download · needs ~{m.ram} RAM · {m.license}</span>
                    <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{m.note}</span>
                  </span>
                  {has(m.name) ? (
                    <span className="shrink-0 text-xs text-emerald-700 dark:text-emerald-400">Installed</span>
                  ) : (
                    <button className="btn-primary shrink-0 px-3 py-1 text-xs" disabled={Boolean(pulling)} onClick={() => pull(m.name)}>Download</button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input className="field" placeholder="Any model from ollama.com/library, e.g. qwen2.5:14b" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Model name to download" />
              <button className="btn-ghost shrink-0" disabled={!custom.trim() || Boolean(pulling)} onClick={() => pull(custom.trim())}>Download</button>
            </div>
          </div>
        </>
      )}

      {pulling && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="flex justify-between text-xs">
            <span>Downloading {pulling.name} — {pulling.p.status}</span>
            <button className="text-zinc-500 underline" onClick={() => abort.current?.abort()}>Cancel</button>
          </div>
          <div className="h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct ?? 5}%` }} />
          </div>
          {pct !== null && <p className="text-xs text-zinc-500">{pct}% · {gb(pulling.p.completed)} of {gb(pulling.p.total)}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </section>
  );
}
