import { useState } from 'react';
import { CAPTION_RULES, captionText, generateCaption, type CaptionLength } from '@/engine/caption';
import type { Tone } from '@/engine';
import type { CarouselPlan } from '@/engine/schema';
import { getPreset } from '@/styles';
import { providers } from './runtime';
import { useDocument, useProjects, useSettings } from './store';

/** Caption + hashtags + alt text for the open project (AI when available, offline rules otherwise). */
export function CaptionPanel({ compact }: { compact?: boolean }) {
  const { settings } = useSettings();
  const plan = useDocument((s) => s.plan);
  const carousel = useDocument((s) => s.carousel);
  const apply = useDocument((s) => s.apply);
  const { current, save } = useProjects();
  const defaultPlatform = carousel ? getPreset(carousel.presetId).platform : 'instagram';
  const [platform, setPlatform] = useState(current?.captionPlatform ?? (CAPTION_RULES[defaultPlatform] ? defaultPlatform : 'instagram'));
  const [length, setLength] = useState<CaptionLength>('medium');
  const [emoji, setEmoji] = useState(true);
  const [cta, setCta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  if (!plan || !current) return null;
  const rule = CAPTION_RULES[platform]!;
  const full = captionText(plan.caption, plan.hashtags, platform);
  const over = (plan.caption.length + plan.hashtags.join(' ').length + 2) > rule.maxChars;

  const setPlan = (patch: Partial<CarouselPlan>) => apply((d) => ({ ...d, plan: { ...d.plan, ...patch } }));

  const generate = async () => {
    setBusy(true);
    setNotice('');
    try {
      const r = await generateCaption(plan, { platform, tone: (current.settings?.tone ?? 'professional') as Tone, length, emoji, cta, language: current.settings?.language ?? 'auto' }, settings.provider, providers);
      setPlan({ caption: r.caption, hashtags: r.hashtags });
      await save({ ...useProjects.getState().current!, plan: { ...useDocument.getState().plan!, caption: r.caption, hashtags: r.hashtags }, altText: r.altText, captionPlatform: platform });
      setNotice(r.notice ?? (r.provider === 'rules' ? 'Written offline from your slides. Connect Claude or Ollama for more natural copy.' : `Written by ${r.provider === 'claude' ? 'Claude' : 'Ollama'}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3 p-3'} data-testid="caption-panel">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label>
          <span className="label">Platform</span>
          <select aria-label="Caption platform" className="field py-1 text-xs" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {Object.keys(CAPTION_RULES).map((p) => <option key={p} value={p}>{p === 'x' ? 'X' : p[0]!.toUpperCase() + p.slice(1)}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Length</span>
          <select aria-label="Caption length" className="field py-1 text-xs" value={length} onChange={(e) => setLength(e.target.value as CaptionLength)}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
      </div>
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" checked={emoji} onChange={(e) => setEmoji(e.target.checked)} /> Emoji</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={cta} onChange={(e) => setCta(e.target.checked)} /> Call to action</label>
      </div>
      <button className="btn-primary w-full px-2.5 py-1.5 text-xs" onClick={() => void generate()} disabled={busy}>{busy ? 'Writing…' : plan.caption ? '↻ Rewrite caption' : 'Write caption'}</button>
      {notice && <p role="status" className="text-[11px] text-zinc-500">{notice}</p>}
      <label className="block">
        <span className="label">Caption</span>
        <textarea aria-label="Caption" className="field h-36 resize-y text-xs" value={plan.caption} onChange={(e) => setPlan({ caption: e.target.value })} />
      </label>
      <label className="block">
        <span className="label">Hashtags</span>
        <input aria-label="Hashtags" className="field py-1 text-xs" value={plan.hashtags.join(' ')} onChange={(e) => setPlan({ hashtags: e.target.value.split(/[\s,]+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)) })} />
      </label>
      <div className="flex items-center justify-between text-[11px]">
        <span className={over ? 'text-red-600' : 'text-zinc-500'}>{full.length} / {rule.maxChars} characters · {plan.hashtags.length} hashtags (aim for {rule.hashtags[0]}–{rule.hashtags[1]})</span>
        <button
          className="text-brand-600 hover:underline"
          onClick={async () => {
            await navigator.clipboard.writeText(full).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied ✓' : 'Copy all'}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">{rule.note}</p>
      {current.altText?.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Alt text for each slide ({current.altText.length})</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] text-zinc-600 dark:text-zinc-400">
            {current.altText.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
