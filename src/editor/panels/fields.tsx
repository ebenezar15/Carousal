import { useState, type ReactNode } from 'react';
import { beginGesture, endGesture } from '@/app/store';

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-zinc-200 py-3 dark:border-zinc-800">
      <button className="mb-2 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {title}
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-2 px-3">{children}</div>}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

/**
 * Number input that keeps what you type until it makes sense: values are applied live only when they're
 * valid and in range (so typing "12" into a field with min 8 doesn't jump to 82), clamped on blur/Enter,
 * and a whole editing session is one undo step.
 */
export function NumberField({ label, value, onChange, step = 1, min, max, suffix }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number; max?: number; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
  const inRange = (v: number) => (min === undefined || v >= min) && (max === undefined || v <= max);
  const commit = () => {
    if (draft !== null) {
      const v = Number(draft);
      if (draft.trim() !== '' && Number.isFinite(v)) {
        const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
        if (c !== value) onChange(c);
      }
    }
    setDraft(null);
  };
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-zinc-500">{label}</span>
      <div className="flex items-center rounded-md border border-zinc-300 bg-white focus-within:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          type="number"
          aria-label={label}
          className="w-full min-w-0 bg-transparent px-2 py-1 text-xs outline-none"
          value={draft ?? shown}
          step={step}
          min={min}
          max={max}
          onFocus={() => beginGesture()}
          onBlur={() => {
            commit();
            endGesture();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setDraft(null);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isFinite(v) && inRange(v) && v !== value) onChange(v);
          }}
        />
        {suffix && <span className="pr-2 text-[10px] text-zinc-400">{suffix}</span>}
      </div>
    </label>
  );
}

/** Range slider; a whole drag is one undo step. */
export function Slider({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange(v: number): void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-0.5 flex justify-between text-[11px] text-zinc-500">
        {label}
        <span>{format ? format(value) : Math.round(value * 100) / 100}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        className="w-full accent-brand-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={beginGesture}
        onPointerUp={endGesture}
        onKeyUp={endGesture}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ColorField({ label, value, onChange, allowNone }: { label: string; value: string | undefined; onChange(v: string | undefined): void; allowNone?: boolean }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          type="color"
          aria-label={label}
          className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          value={hex}
          onPointerDown={beginGesture}
          onBlur={endGesture}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input className="w-full min-w-0 bg-transparent text-xs uppercase outline-none" aria-label={`${label} hex`} value={value && value !== 'transparent' ? value : ''} placeholder={allowNone ? 'none' : ''} onChange={(e) => onChange(e.target.value || (allowNone ? undefined : hex))} />
        {allowNone && value && (
          <button className="text-[10px] text-zinc-400 hover:text-red-500" onClick={() => onChange(undefined)} aria-label={`Clear ${label}`}>✕</button>
        )}
      </div>
    </label>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-zinc-500">{label}</span>
      <select aria-label={label} className="w-full rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" className="accent-brand-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string, string?][]; onChange(v: T): void }) {
  return (
    <div>
      <span className="mb-0.5 block text-[11px] text-zinc-500">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700" role="radiogroup" aria-label={label}>
        {options.map(([v, l, title]) => (
          <button key={v} role="radio" aria-checked={value === v} title={title ?? l} className={`flex-1 px-1 py-1 text-xs ${value === v ? 'bg-brand-500 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconButton({ label, onClick, children, active, disabled }: { label: string; onClick(): void; children: ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button className={`rounded-md border px-2 py-1 text-xs ${active ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'border-zinc-300 hover:border-brand-500 dark:border-zinc-700'} disabled:opacity-40`} onClick={onClick} title={label} aria-label={label} aria-pressed={active} disabled={disabled}>
      {children}
    </button>
  );
}
