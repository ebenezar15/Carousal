import { useEffect, useState } from 'react';
import { CLAUDE_MODELS, type ProviderPreference } from '@/engine';
import { CLAUDE_KEY, deleteSecret, getSecret, isTauri, setSecret } from '@/secrets';
import { translationMemory } from '@/storage/translationMemory';
import { useSettings } from './store';
import { OllamaSection } from './settings/OllamaSection';
import { OpenAISection } from './settings/OpenAISection';
import { ScriptFontsSection } from './settings/ScriptFontsSection';

const PROVIDERS: { id: ProviderPreference; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Claude if a key is set and you are online, else your free/local model, else Ollama, else built-in rules.' },
  { id: 'claude', label: 'Claude (online)', hint: 'Best quality. Needs your Anthropic API key and internet.' },
  { id: 'openai', label: 'Free / local models', hint: 'OpenRouter, Groq or Gemini free tiers, or LM Studio / llama.cpp / Jan on this computer.' },
  { id: 'ollama', label: 'Ollama (offline)', hint: 'Runs a free local model on your machine. Download models below.' },
  { id: 'rules', label: 'No AI', hint: 'Deterministic rule-based splitter. Always works, fully offline.' },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [remember, setRemember] = useState(false);
  const desktop = isTauri();

  useEffect(() => {
    void getSecret(CLAUDE_KEY).then((k) => setHasKey(Boolean(k)));
  }, []);

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

      <section className="card space-y-3 p-5" aria-label="Saving AI credits">
        <h2 className="font-semibold">Saving AI credits</h2>
        <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
          <li>Designs, layouts, textures, motion, “Make it …” buttons and offline translation never use AI.</li>
          <li>The same text with the same settings reuses the copy already written; translations and headline ideas are remembered.</li>
          <li>Small jobs (translation, captions, headline ideas, slide rewrites, reading design prompts) use the cheaper quick-task model.</li>
        </ul>
        <div>
          <label className="label" htmlFor="design-ai">Reading “Describe the look” prompts</label>
          <select id="design-ai" className="field" value={settings.designAI} onChange={(e) => update({ designAI: e.target.value as typeof settings.designAI })}>
            <option value="auto">Built-in first; AI only for words it doesn't know (recommended)</option>
            <option value="always">Always ask the AI (cached per prompt)</option>
            <option value="never">Never use AI (fully offline)</option>
          </select>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Claude</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="model">Model</label>
            <select id="model" className="field" value={settings.claudeModel} onChange={(e) => update({ claudeModel: e.target.value })}>
              {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fast-model">Model for quick tasks</label>
            <select id="fast-model" className="field" value={settings.claudeFastModel} onChange={(e) => update({ claudeFastModel: e.target.value })}>
              {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500">Quick tasks are translation, captions, headline ideas, slide rewrites and design prompts. Haiku is about 40× cheaper than Opus and handles these well.</p>
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

      <OpenAISection />

      <OllamaSection />

      <ScriptFontsSection />

      <TranslationMemorySection />

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

function TranslationMemorySection() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void translationMemory.count!().then(setCount);
  }, []);
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-semibold">Translation memory</h2>
      <p className="text-xs text-zinc-500">Every translation you accept is remembered on this device, so the same text is never sent to an AI model twice — re-translating or reusing lines is instant and free.</p>
      <div className="flex items-center gap-3 text-sm">
        <span data-testid="tm-count">{count === null ? '…' : `${count} saved translation${count === 1 ? '' : 's'}`}</span>
        <button className="btn-ghost px-2 py-1 text-xs" disabled={!count} onClick={async () => { if (confirm('Forget all saved translations?')) { await translationMemory.clear!(); setCount(0); } }}>Clear</button>
      </div>
    </section>
  );
}
