// Translate a carousel into another language with its exact design. Steps: pick a language and engine →
// translate (memory first, then one batched AI call per few dozen strings) → review/edit every line →
// create a translated copy that opens in the editor. The original project is never changed.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/model/types';
import type { CarouselPlan } from '@/engine/schema';
import { pickProvider } from '@/engine';
import {
  aiTranslator, applyTranslation, browserTranslator, collectUnits, LANGUAGES, languageLabel, memoryPairs, nativeLabel, stripTags, translateUnits,
  type Accepted, type Translator, type TranslateRun,
} from '@/engine/translate';
import { translationMemory } from '@/storage/translationMemory';
import { providers } from './runtime';
import { useSettings } from './store';

type Engine = 'ai' | 'browser' | 'manual';
type Step = { kind: 'setup' } | { kind: 'working'; done: number; total: number } | { kind: 'review'; run: TranslateRun } | { kind: 'saving' };

const ENGINE_LABEL: Record<Engine, string> = { ai: 'AI model', browser: 'On-device (browser)', manual: 'Type it myself' };

export function TranslateDialog({ project, onClose, onCreated }: { project: Project; onClose(): void; onCreated(p: Project): void }) {
  const settings = useSettings((s) => s.settings);
  const plan = project.plan as CarouselPlan | undefined;
  const sourceLang = project.settings?.language && project.settings.language !== 'auto' ? project.settings.language : plan?.language || 'en';
  const units = useMemo(() => collectUnits(project), [project]);
  const [target, setTarget] = useState(sourceLang.startsWith('ta') ? 'hi' : 'ta');
  const [customCode, setCustomCode] = useState('');
  const [engine, setEngine] = useState<Engine>('manual');
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [browserOk, setBrowserOk] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const lang = customCode.trim() || target;

  // Which engines can run right now (AI provider per Settings; the browser's built-in translator).
  useEffect(() => {
    let alive = true;
    void pickProvider(settings.provider, providers).then((p) => {
      if (!alive) return;
      setAiLabel(p ? p.label : null);
      setEngine((e) => (e === 'manual' && p ? 'ai' : e));
    });
    return () => {
      alive = false;
    };
  }, [settings.provider]);
  useEffect(() => {
    let alive = true;
    void browserTranslator.available(sourceLang, lang).then((ok) => {
      if (!alive) return;
      setBrowserOk(ok);
      setEngine((e) => (e === 'manual' && ok ? 'browser' : e === 'browser' && !ok ? 'manual' : e));
    });
    return () => {
      alive = false;
    };
  }, [sourceLang, lang]);

  const start = async () => {
    setError('');
    abort.current = new AbortController();
    setStep({ kind: 'working', done: 0, total: units.length });
    try {
      let translator: Translator | null = null;
      if (engine === 'ai') {
        const p = await pickProvider(settings.provider, providers);
        if (!p) throw new Error('No AI model is available. Set one up in Settings, or choose another engine.');
        translator = aiTranslator(p);
      } else if (engine === 'browser') translator = browserTranslator.create();
      const run = await translateUnits(units, lang, translator, translationMemory, {
        sourceLang,
        signal: abort.current.signal,
        onProgress: (done, total) => setStep({ kind: 'working', done, total }),
      });
      setEdits(Object.fromEntries(units.map((u) => [u.id, stripTags(run.results.get(u.id)?.tagged ?? u.source)])));
      setOnlyFailed(run.failed > 0);
      setStep({ kind: 'review', run });
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStep({ kind: 'setup' });
      else {
        setError((e as Error).message);
        setStep({ kind: 'setup' });
      }
    }
  };

  const create = async () => {
    if (step.kind !== 'review') return;
    const { run } = step;
    setStep({ kind: 'saving' });
    try {
      const accepted: Accepted = new Map(units.map((u) => [u.id, { tagged: run.results.get(u.id)?.tagged ?? u.source, text: edits[u.id] ?? u.plain }]));
      const engineName = engine === 'ai' ? aiLabel ?? 'AI' : ENGINE_LABEL[engine];
      const copy = await applyTranslation(project, units, accepted, lang, engineName);
      await translationMemory.store(lang, memoryPairs(units, accepted));
      onCreated(copy);
    } catch (e) {
      setError((e as Error).message);
      setStep({ kind: 'review', run });
    }
  };

  const review = step.kind === 'review' ? step.run : null;
  const visible = review ? units.filter((u) => !onlyFailed || review.results.get(u.id)?.origin === 'failed' || review.results.get(u.id)?.origin === 'manual') : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Translate carousel">
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="font-semibold">Translate carousel</h2>
          <button className="btn-ghost px-2 py-1" onClick={() => { abort.current?.abort(); onClose(); }} aria-label="Close">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {(step.kind === 'setup' || step.kind === 'working') && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Creates a copy in another language with the same design — fonts, colors, effects and layout stay; emphasized words stay emphasized. {units.length} text{units.length === 1 ? '' : 's'} to translate from {languageLabel(sourceLang)}.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="tr-lang">Language</label>
                  <select id="tr-lang" className="field" value={target} onChange={(e) => { setTarget(e.target.value); setCustomCode(''); }} disabled={step.kind === 'working'}>
                    {LANGUAGES.filter((l) => l.code !== sourceLang).map((l) => <option key={l.code} value={l.code}>{l.name} — {l.native}</option>)}
                  </select>
                  <input className="field mt-2" aria-label="Other language code" placeholder="Other language: code like sw, yo, km…" value={customCode} onChange={(e) => setCustomCode(e.target.value)} disabled={step.kind === 'working'} />
                </div>
                <fieldset>
                  <legend className="label">Translate with</legend>
                  <div className="space-y-1.5 text-sm">
                    <label className="flex items-start gap-2">
                      <input type="radio" name="tr-engine" checked={engine === 'ai'} disabled={!aiLabel || step.kind === 'working'} onChange={() => setEngine('ai')} />
                      <span>AI model <span className="block text-xs text-zinc-500">{aiLabel ? `${aiLabel} · quick-task model, batched` : 'None set up — see Settings'}</span></span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="tr-engine" checked={engine === 'browser'} disabled={!browserOk || step.kind === 'working'} onChange={() => setEngine('browser')} />
                      <span>On-device (browser) <span className="block text-xs text-zinc-500">{browserOk ? 'Free, private; downloads the language once' : 'Not available for this language in this browser'}</span></span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="tr-engine" checked={engine === 'manual'} disabled={step.kind === 'working'} onChange={() => setEngine('manual')} />
                      <span>Type it myself <span className="block text-xs text-zinc-500">Fill in each line; nothing leaves this device</span></span>
                    </label>
                  </div>
                </fieldset>
              </div>
              <p className="text-xs text-zinc-500">Lines translated before are reused from this device's translation memory, so only new text goes to the model.</p>
              {step.kind === 'working' && (
                <div role="status" aria-live="polite" className="space-y-1">
                  <div className="text-xs">Translating into {languageLabel(lang)}… {step.done}/{step.total}</div>
                  <div className="h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                    <div className="h-full bg-brand-500 transition-all" style={{ width: `${step.total ? Math.max(4, (step.done / step.total) * 100) : 4}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {review && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="tr-summary">
                <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{languageLabel(lang)} · {nativeLabel(lang)}</span>
                {review.translated > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{review.translated} translated</span>}
                {review.fromMemory > 0 && <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">{review.fromMemory} from memory</span>}
                {review.failed > 0 && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{review.failed} need attention</span>}
                <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Only lines that need attention</label>
              </div>
              {review.error && <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">The translator stopped: {review.error}. Untranslated lines are marked; edit them or go back and try another engine.</p>}
              <ol className="space-y-2" aria-label="Review translations">
                {visible.map((u) => {
                  const origin = review.results.get(u.id)?.origin;
                  return (
                    <li key={u.id} className="grid gap-2 rounded-lg border border-zinc-200 p-2 sm:grid-cols-2 dark:border-zinc-800">
                      <div className="text-xs">
                        <span className="text-zinc-400">{u.where}{u.uses > 1 ? ` · used ${u.uses}×` : ''}{origin === 'memory' ? ' · memory' : origin === 'failed' ? ' · not translated' : ''}</span>
                        <p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{u.plain}</p>
                      </div>
                      <textarea
                        dir="auto"
                        aria-label={`Translation of: ${u.plain.slice(0, 60)}`}
                        className={`field min-h-[2.5rem] text-sm ${origin === 'failed' || origin === 'manual' ? 'border-amber-400' : ''}`}
                        rows={Math.min(6, Math.max(1, (edits[u.id] ?? '').split('\n').length))}
                        value={edits[u.id] ?? ''}
                        onChange={(e) => setEdits({ ...edits, [u.id]: e.target.value })}
                      />
                    </li>
                  );
                })}
                {visible.length === 0 && <li className="text-sm text-zinc-500">Nothing needs attention.</li>}
              </ol>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          {step.kind === 'working' && <button className="btn-ghost" onClick={() => abort.current?.abort()}>Cancel</button>}
          {step.kind === 'setup' && <button className="btn-primary" onClick={start} disabled={!lang || units.length === 0}>{engine === 'manual' ? 'Start' : 'Translate'}</button>}
          {review && (
            <>
              <button className="btn-ghost" onClick={() => setStep({ kind: 'setup' })}>Back</button>
              <button className="btn-primary" onClick={create}>Create {languageLabel(lang)} copy</button>
            </>
          )}
          {step.kind === 'saving' && <span className="text-sm text-zinc-500" role="status">Fitting text and saving…</span>}
        </div>
      </div>
    </div>
  );
}
