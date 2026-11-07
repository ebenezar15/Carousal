import { useRef, useState } from 'react';
import type { GenerateOptions, Tone } from '@/engine';
import { ACCEPTED_FILE_TYPES, ImportError, importFile, importUrl } from '@/engine/import';
import { presets } from '@/styles';
import { SAMPLE_CONTENT } from '../sample';
import { getTemplate, TEMPLATES } from '@/styles/templates';
import { TemplateGallery } from './TemplateGallery';
import { useEscape } from '../useEscape';
import { AUTO_TYPE, CAROUSEL_TYPES, FAITH_PROMPTS, interpretPrompt, readCarouselBrief, STYLE_PROMPTS } from '@/engine';


const TONES: Tone[] = ['professional', 'playful', 'bold', 'educational'];
export const LANGUAGES: [string, string][] = [
  ['auto', 'Same as content'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'],
  ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'],
];

export interface InputState {
  text: string;
  /** Optional free-text description of the look ("dreamy clay shapes, pastel, bouncy motion"). */
  designPrompt: string;
  presetId: string;
  opts: GenerateOptions;
  variationCount: number;
  handle: string;
  /** Built-in template to start from ('' = let the app choose designs). */
  templateId: string;
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

      <CarouselTypeField
        type={value.opts.carouselType ?? AUTO_TYPE}
        brief={value.opts.carouselBrief ?? ''}
        onChange={(carouselType, carouselBrief) => setOpts({ carouselType, carouselBrief })}
      />

      <TemplateField presetId={value.presetId} templateId={value.templateId} typeId={value.opts.carouselType} onChange={(templateId) => set({ templateId })} />

      <DesignPromptField value={value.designPrompt} onChange={(designPrompt) => set({ designPrompt })} />

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

/** "Describe the look": free text plus one-click starting points; shows what was understood (offline). */
export function DesignPromptField({ value, onChange, id = 'design-prompt' }: { value: string; onChange(v: string): void; id?: string }) {
  const understood = value.trim() ? interpretPrompt(value).understood : [];
  return (
    <div>
      <label className="label" htmlFor={id}>Describe the look <span className="font-normal text-zinc-400">(optional)</span></label>
      <textarea
        id={id}
        className="field h-16 resize-y text-sm"
        placeholder="e.g. dreamy pastel clay shapes, rounded type, bouncy motion, continuous ribbon"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex flex-wrap gap-1" aria-label="Design styles">
        {[...STYLE_PROMPTS, ...FAITH_PROMPTS].map((sp) => (
          <button
            key={sp.label}
            type="button"
            className={`rounded-full border px-2 py-0.5 text-[11px] ${value === sp.prompt ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'border-zinc-300 text-zinc-600 hover:border-brand-500 dark:border-zinc-700 dark:text-zinc-400'}`}
            onClick={() => onChange(value === sp.prompt ? '' : sp.prompt)}
            aria-pressed={value === sp.prompt}
          >
            {sp.label}
          </button>
        ))}
      </div>
      {understood.length > 0 && <p className="mt-1 text-[11px] text-zinc-500" data-testid="design-understood">Understood: {understood.join(' · ')}</p>}
    </div>
  );
}

const GROUPS: [string, string][] = [['faith', 'Faith'], ['story', 'Stories'], ['teach', 'Teaching'], ['business', 'Business']];

/** "What kind of carousel?": a type (or Auto) plus the author's own description of the carousel they want. */
export function CarouselTypeField({ type, brief, onChange }: { type: string; brief: string; onChange(type: string, brief: string): void }) {
  const read = brief.trim() || type !== AUTO_TYPE ? readCarouselBrief(brief, type) : null;
  const chosen = CAROUSEL_TYPES.find((t) => t.id === type);
  return (
    <div data-testid="carousel-type">
      <label className="label" htmlFor="carousel-type">What kind of carousel? <span className="font-normal text-zinc-400">(optional)</span></label>
      <select id="carousel-type" className="field" value={type} onChange={(e) => onChange(e.target.value, brief)}>
        <option value={AUTO_TYPE}>Auto — decide from the content and my description</option>
        {GROUPS.map(([g, name]) => (
          <optgroup key={g} label={name}>
            {CAROUSEL_TYPES.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </optgroup>
        ))}
      </select>
      {chosen && <p className="mt-1 text-[11px] text-zinc-500">{chosen.description}</p>}
      <textarea
        id="carousel-brief"
        aria-label="Describe the carousel you want"
        className="field mt-1.5 h-16 resize-y text-sm"
        placeholder="e.g. a 10-slide doctrine explainer on the Trinity: one heresy per slide with the verse that answers it, series: Theology / Early Church"
        value={brief}
        onChange={(e) => onChange(type, e.target.value)}
      />
      {read && read.understood.length > 0 && <p className="mt-1 text-[11px] text-zinc-500" data-testid="type-understood">Building: {read.understood.join(' · ')}</p>}
    </div>
  );
}

/** "Start from a template": the chosen template (first design) and a gallery to browse all of them. */
function TemplateField({ presetId, templateId, typeId, onChange }: { presetId: string; templateId: string; typeId?: string; onChange(id: string): void }) {
  const [open, setOpen] = useState(false);
  const chosen = getTemplate(templateId);
  return (
    <div data-testid="template-field">
      <span className="label">Template <span className="font-normal text-zinc-400">(optional)</span></span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost flex-1 border border-zinc-300 px-2.5 py-1.5 text-left text-xs dark:border-zinc-700" onClick={() => setOpen(true)}>
          {chosen ? <>Using <strong>{chosen.name}</strong></> : `Browse ${TEMPLATES.length} templates…`}
        </button>
        {chosen && <button type="button" className="text-xs text-zinc-500 hover:text-red-600" onClick={() => onChange('')} aria-label="Clear template">Clear</button>}
      </div>
      {open && <TemplateDialog presetId={presetId} templateId={templateId} typeId={typeId} onPick={(id) => { onChange(id); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function TemplateDialog({ presetId, templateId, typeId, onPick, onClose, plan, pickLabel }: { presetId: string; templateId?: string; typeId?: string; onPick(id: string): void; onClose(): void; plan?: import('@/engine').CarouselPlan; pickLabel?: string }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Templates" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-4xl p-4">
        <h2 className="mb-3 text-sm font-semibold">Templates</h2>
        <TemplateGallery presetId={presetId} selectedId={templateId} typeId={typeId} plan={plan} onPick={(t) => onPick(t.id)} onClose={onClose} pickLabel={pickLabel} />
      </div>
    </div>
  );
}
