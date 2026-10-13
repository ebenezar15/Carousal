import { useEffect, useState } from 'react';
import { CLAUDE_MODELS, listOllamaModels, type OllamaModel, type ProviderPreference } from '@/engine';
import { CLAUDE_KEY, deleteSecret, getSecret, isTauri, setSecret } from '@/secrets';
import { useSettings } from './store';

const PROVIDERS: { id: ProviderPreference; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Claude if a key is set and you are online, else local Ollama, else built-in rules.' },
  { id: 'claude', label: 'Claude (online)', hint: 'Best quality. Needs your Anthropic API key and internet.' },
  { id: 'ollama', label: 'Ollama (offline)', hint: 'Runs a local model on your machine. Needs Ollama installed.' },
  { id: 'rules', label: 'No AI', hint: 'Deterministic rule-based splitter. Always works, fully offline.' },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [remember, setRemember] = useState(false);
  const [ollama, setOllama] = useState<OllamaModel[] | null | 'checking'>('checking');
  const desktop = isTauri();

  useEffect(() => {
    void getSecret(CLAUDE_KEY).then((k) => setHasKey(Boolean(k)));
  }, []);

  const checkOllama = async () => {
    setOllama('checking');
    setOllama(await listOllamaModels(settings.ollamaUrl));
  };
  useEffect(() => {
    let alive = true;
    void listOllamaModels(settings.ollamaUrl).then((m) => alive && setOllama(m));
    return () => {
      alive = false;
    };
  }, [settings.ollamaUrl]);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    await setSecret(CLAUDE_KEY, keyInput.trim(), remember);
    setKeyInput('');
    setHasKey(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">AI provider</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded-lg border p-3 text-sm ${settings.provider === p.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
              <input type="radio" name="provider" className="sr-only" checked={settings.provider === p.id} onChange={() => update({ provider: p.id })} />
              <span className="font-medium">{p.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{p.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Claude</h2>
        <div>
          <label className="label" htmlFor="model">Model</label>
          <select id="model" className="field" value={settings.claudeModel} onChange={(e) => update({ claudeModel: e.target.value })}>
            {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="key">API key {hasKey && <span className="ml-1 text-emerald-600">● saved</span>}</label>
          <div className="flex gap-2">
            <input id="key" type="password" autoComplete="off" className="field" placeholder={hasKey ? '•••••••• (enter a new key to replace)' : 'sk-ant-…'} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
            <button className="btn-primary" onClick={saveKey} disabled={!keyInput.trim()}>Save</button>
            {hasKey && <button className="btn-ghost" onClick={async () => { await deleteSecret(CLAUDE_KEY); setHasKey(false); }}>Remove</button>}
          </div>
          {desktop ? (
            <p className="mt-1 text-xs text-zinc-500">Stored in your operating system's keychain.</p>
          ) : (
            <>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember on this device
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                In the browser, a remembered key is stored unencrypted in this site's local database. Leave this off on shared computers, or use the desktop app, which uses the OS keychain.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Ollama (offline AI)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ollama-url">Server URL</label>
            <input id="ollama-url" className="field" value={settings.ollamaUrl} onChange={(e) => update({ ollamaUrl: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ollama-model">Model</label>
            <select id="ollama-model" className="field" value={settings.ollamaModel} onChange={(e) => update({ ollamaModel: e.target.value })} disabled={!Array.isArray(ollama) || ollama.length === 0}>
              <option value="">First available</option>
              {Array.isArray(ollama) && ollama.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm" role="status">
          {ollama === 'checking' ? (
            <span className="text-zinc-500">Checking…</span>
          ) : ollama === null ? (
            <span className="text-amber-700 dark:text-amber-400">Not detected.</span>
          ) : ollama.length === 0 ? (
            <span className="text-amber-700 dark:text-amber-400">Running, but no models installed.</span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400">Connected · {ollama.length} model{ollama.length > 1 ? 's' : ''}</span>
          )}
          <button className="btn-ghost px-2 py-1 text-xs" onClick={checkOllama}>Re-check</button>
        </div>
        {ollama !== 'checking' && (ollama === null || ollama.length === 0) && (
          <div className="rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <p>1. Install Ollama from ollama.com, then pull a model: <code>ollama pull qwen2.5:7b</code> (or <code>llama3.2</code>, <code>mistral</code>).</p>
            {!desktop && (
              <p className="mt-1">
                2. The browser version also needs Ollama to accept requests from this page. Start it with <code>OLLAMA_ORIGINS={location.origin} ollama serve</code>. The desktop app does not need this.
              </p>
            )}
          </div>
        )}
      </section>

      <StockKeys />

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Appearance</h2>
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={settings.theme === t ? 'btn-primary' : 'btn-ghost'} onClick={() => update({ theme: t })}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StockKeys() {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const keys = [
    { name: 'unsplash_access_key', label: 'Unsplash access key', help: 'Free at unsplash.com/developers. Photos are credited to the photographer automatically.' },
    { name: 'pexels_api_key', label: 'Pexels API key', help: 'Free at pexels.com/api.' },
  ];
  useEffect(() => {
    void Promise.all(keys.map(async (k) => [k.name, Boolean(await getSecret(k.name))] as const)).then((r) => setState(Object.fromEntries(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Stock photos (online)</h2>
      {keys.map((k) => (
        <div key={k.name}>
          <label className="label" htmlFor={k.name}>{k.label} {state[k.name] && <span className="ml-1 text-emerald-600">● saved</span>}</label>
          <div className="flex gap-2">
            <input id={k.name} type="password" autoComplete="off" className="field" value={values[k.name] ?? ''} onChange={(e) => setValues({ ...values, [k.name]: e.target.value })} />
            <button className="btn-primary" disabled={!values[k.name]?.trim()} onClick={async () => { await setSecret(k.name, values[k.name]!.trim(), true); setValues({ ...values, [k.name]: '' }); setState({ ...state, [k.name]: true }); }}>Save</button>
            {state[k.name] && <button className="btn-ghost" onClick={async () => { await deleteSecret(k.name); setState({ ...state, [k.name]: false }); }}>Remove</button>}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{k.help}</p>
        </div>
      ))}
    </section>
  );
}
