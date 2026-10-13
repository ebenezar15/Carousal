import { useRef, useState } from 'react';
import type { GenerateOptions, Tone } from '@/engine';
import { ACCEPTED_FILE_TYPES, ImportError, importFile, importUrl } from '@/engine/import';
import { presets } from '@/styles';
import { SAMPLE_CONTENT } from '../sample';

const TONES: Tone[] = ['professional', 'playful', 'bold', 'educational'];
export const LANGUAGES: [string, string][] = [
  ['auto', 'Same as content'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'],
  ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'],
];

export interface InputState {
  text: string;
  presetId: string;
  opts: GenerateOptions;
  variationCount: number;
  handle: string;
}

interface Props {
  value: InputState;
  onChange(v: InputState): void;
  onGenerate(): void;
  busy: boolean;
}

type Tab = 'paste' | 'file' | 'url';

export function InputPanel({ value, onChange, onGenerate, busy }: Props) {
  const [tab, setTab] = useState<Tab>('paste');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<InputState>) => onChange({ ...value, ...patch });
  const setOpts = (patch: Partial<GenerateOptions>) => set({ opts: { ...value.opts, ...patch } });
  const platforms = [...new Set(presets.map((p) => p.platform))];

  async function runImport(job: () => Promise<{ text: string; title?: string; warnings: string[] }>) {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await job();
      set({ text: r.text });
      setTab('paste');
      setImportMsg({ kind: 'ok', text: `Imported ${r.title ? `“${r.title}”` : 'content'} (${r.text.split(/\s+/).length} words).${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}` });
    } catch (e) {
      setImportMsg({ kind: 'error', text: e instanceof ImportError ? e.userMessage : `Import failed: ${(e as Error).message}` });
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="card space-y-4 p-5" aria-label="Content and options">
      <div>
        <div className="mb-2 flex items-center gap-1" role="tablist" aria-label="Content source">
          {(['paste', 'file', 'url'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === t ? 'bg-brand-500 text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`} onClick={() => setTab(t)}>
              {t === 'paste' ? 'Paste' : t === 'file' ? 'File' : 'URL'}
            </button>
          ))}
          <button className="ml-auto text-xs font-medium text-brand-600 hover:underline" onClick={() => { set({ text: SAMPLE_CONTENT }); setTab('paste'); }}>
            Use sample
          </button>
        </div>
        {tab === 'paste' && (
          <textarea
            aria-label="Your content"
            className="field h-52 resize-y font-mono text-[13px] leading-relaxed"
            placeholder="Paste notes, a blog post or bullet points. Markdown headings and lists help."
            value={value.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        )}
        {tab === 'file' && (
          <div
            className="flex h-52 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void runImport(() => importFile(f));
            }}
          >
            <p>Drop a .txt, .md, .docx or .pdf file</p>
            <button className="btn-ghost border border-zinc-300 dark:border-zinc-700" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? 'Reading…' : 'Choose file'}
            </button>
            <input ref={fileRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" aria-label="Upload file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void runImport(() => importFile(f)); e.target.value = ''; }} />
          </div>
        )}
        {tab === 'url' && (
          <form className="flex h-52 flex-col justify-center gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) void runImport(() => importUrl(url.trim())); }}>
            <label className="label" htmlFor="import-url">Article URL</label>
            <input id="import-url" className="field" type="url" placeholder="https://example.com/blog/post" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-ghost border border-zinc-300 dark:border-zinc-700" disabled={importing || !url.trim()}>{importing ? 'Fetching…' : 'Import article'}</button>
            <p className="text-xs text-zinc-500">Needs an internet connection. Some sites block the browser version; the desktop app can import from any site.</p>
          </form>
        )}
        {importMsg && <p role="status" className={`mt-2 text-xs ${importMsg.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{importMsg.text}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label" htmlFor="preset">Platform</label>
          <select id="preset" className="field" value={value.presetId} onChange={(e) => set({ presetId: e.target.value })}>
            {platforms.map((pl) => (
              <optgroup key={pl} label={pl}>
                {presets.filter((p) => p.platform === pl).map((p) => <option key={p.id} value={p.id}>{p.label} · {p.width}×{p.height}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="count">Slides</label>
          <select id="count" className="field" value={String(value.opts.slideCount)} onChange={(e) => setOpts({ slideCount: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
            <option value="auto">Auto</option>
            {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="variations">Designs</label>
          <select id="variations" className="field" value={value.variationCount} onChange={(e) => set({ variationCount: Number(e.target.value) })}>
            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} variations</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tone">Tone</label>
          <select id="tone" className="field" value={value.opts.tone} onChange={(e) => setOpts({ tone: e.target.value as Tone })}>
            {TONES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="language">Language</label>
          <select id="language" className="field" value={value.opts.language} onChange={(e) => setOpts({ language: e.target.value })}>
            {LANGUAGES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="audience">Audience</label>
          <input id="audience" className="field" placeholder="e.g. founders" value={value.opts.audience} onChange={(e) => setOpts({ audience: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="handle">Your handle</label>
          <input id="handle" className="field" placeholder="@yourname" value={value.handle} onChange={(e) => set({ handle: e.target.value })} />
        </div>
      </div>

      <button className="btn-primary w-full" onClick={onGenerate} disabled={busy || !value.text.trim()}>
        {busy ? 'Generating…' : 'Generate carousel'}
      </button>
    </section>
  );
}
