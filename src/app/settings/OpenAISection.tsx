// Settings for the "free / local models" provider (OpenAI-compatible): pick a service or local app,
// paste a free key if it needs one, choose a model from the live list, and test it.
import { useEffect, useState } from 'react';
import { createOpenAIProvider, getOpenAIPreset, listOpenAIModels, OPENAI_PRESETS, type OpenAIModelInfo, type OpenAIPresetId } from '@/engine';
import { deleteSecret, getSecret, isTauri, setSecret } from '@/secrets';
import { useSettings } from '../store';

export function OpenAISection() {
  const { settings, update } = useSettings();
  const preset = getOpenAIPreset(settings.openaiPreset);
  const [models, setModels] = useState<OpenAIModelInfo[] | null | 'loading'>('loading');
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState('');
  const [test, setTest] = useState<string>('');
  const desktop = isTauri();
  const baseUrl = settings.openaiBaseUrl || preset.baseUrl;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const key = preset.keyName ? await getSecret(preset.keyName).catch(() => null) : null;
      if (!alive) return;
      setHasKey(Boolean(key));
      // Online services need a key before their model list loads; don't call them otherwise.
      if (preset.online && preset.id !== 'custom' && !key) return setModels(null);
      const m = await listOpenAIModels({ preset: preset.id, baseUrl: settings.openaiBaseUrl });
      if (alive) setModels(m);
    })();
    return () => {
      alive = false;
    };
  }, [preset.id, preset.keyName, preset.online, settings.openaiBaseUrl, hasKey]);

  const choosePreset = (id: OpenAIPresetId) => {
    const p = getOpenAIPreset(id);
    setModels('loading');
    setTest('');
    void update({ openaiPreset: id, openaiBaseUrl: '', openaiModel: p.suggested ?? '', openaiFastModel: '' });
  };

  const saveKey = async () => {
    if (!preset.keyName || !key.trim()) return;
    await setSecret(preset.keyName, key.trim(), true);
    setKey('');
    setHasKey(true);
  };

  const runTest = async () => {
    setTest('Testing…');
    try {
      const p = createOpenAIProvider(() => ({ preset: preset.id, baseUrl: settings.openaiBaseUrl, model: settings.openaiModel }));
      const out = await p.complete({ system: 'Return JSON.', messages: [{ role: 'user', content: 'Reply with {"ok": true}' }], jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } });
      setTest(/"ok"\s*:\s*true/.test(out) ? '✓ Works' : `Answered, but not as expected: ${out.slice(0, 80)}`);
    } catch (e) {
      setTest(`✗ ${(e as Error).message}`);
    }
  };

  const list = Array.isArray(models) ? models : [];
  const modelOptions = settings.openaiModel && !list.some((m) => m.id === settings.openaiModel) ? [{ id: settings.openaiModel, free: false }, ...list] : list;

  return (
    <section className="card space-y-3 p-5" aria-labelledby="openai-h">
      <h2 id="openai-h" className="font-semibold">Free online & local models</h2>
      <p className="text-xs text-zinc-500">Use free open models through a free account (OpenRouter, Groq, Google Gemini), or a model app on your own computer (LM Studio, llama.cpp, Jan). Anything that speaks the OpenAI-compatible API works.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="oa-preset">Service</label>
          <select id="oa-preset" className="field" value={preset.id} onChange={(e) => choosePreset(e.target.value as OpenAIPresetId)}>
            {OPENAI_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="oa-url">Server URL</label>
          <input id="oa-url" className="field" value={settings.openaiBaseUrl} placeholder={preset.baseUrl || 'https://…/v1'} onChange={(e) => update({ openaiBaseUrl: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{preset.hint}</p>

      {preset.keyName && (
        <div>
          <label className="label" htmlFor="oa-key">API key {hasKey && <span className="ml-1 text-emerald-600">● saved</span>} {preset.keyUrl && <a className="ml-1 text-brand-600 underline" href={preset.keyUrl} target="_blank" rel="noreferrer">get a free key</a>}</label>
          <div className="flex gap-2">
            <input id="oa-key" type="password" autoComplete="off" className="field" placeholder={hasKey ? '•••••••• (enter a new key to replace)' : 'Paste key'} value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn-primary" onClick={saveKey} disabled={!key.trim()}>Save</button>
            {hasKey && <button className="btn-ghost" onClick={async () => { await deleteSecret(preset.keyName!); setHasKey(false); }}>Remove</button>}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{desktop ? "Stored in your operating system's keychain." : 'Stored in this browser on this device. Use the desktop app for keychain storage.'}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="oa-model">Model</label>
          <select id="oa-model" className="field" value={settings.openaiModel} onChange={(e) => update({ openaiModel: e.target.value })}>
            <option value="">{models === 'loading' ? 'Loading…' : models === null ? (preset.online && preset.id !== 'custom' && !hasKey ? 'Save your key to load the list' : 'Could not load the list — type below') : 'Choose a model'}</option>
            {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.id}{m.free && preset.online ? ' (free)' : ''}</option>)}
          </select>
          {models === null && <input className="field mt-2" aria-label="Model id" placeholder={preset.suggested ?? 'model id'} value={settings.openaiModel} onChange={(e) => update({ openaiModel: e.target.value })} />}
        </div>
        <div>
          <label className="label" htmlFor="oa-fast">Model for quick tasks</label>
          <select id="oa-fast" className="field" value={settings.openaiFastModel} onChange={(e) => update({ openaiFastModel: e.target.value })}>
            <option value="">Same as main model</option>
            {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button className="btn-ghost" onClick={runTest} disabled={!settings.openaiModel || !baseUrl}>Test connection</button>
        <span role="status" className="text-xs">{test}</span>
      </div>
    </section>
  );
}
