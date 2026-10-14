import { useEffect, useMemo, useRef, useState } from 'react';
import type { TextElement } from '@/model/types';
import { bundledChoices, customFonts, addCustomFont, FONT_ACCEPT, fontLabel, querySystemFonts, weightsFor, type FontChoice } from '@/styles/fontCatalog';
import { ensureFonts } from '@/styles/fontLoader';
import { refitText } from '@/engine/layout/textLayout';
import { ColorField, NumberField, Row, Section, Segmented, Select, Slider, Toggle } from './fields';
import { TEXT_EFFECTS, currentEffect } from '../textEffects';
import { useDocument } from '@/app/store';
import { getPalette } from '@/styles';

export function FontPicker({ value, onChange }: { value: string; onChange(id: string): void }) {
  const [system, setSystem] = useState<string[] | null>(null);
  const [custom, setCustom] = useState<FontChoice[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const bundled = useMemo(() => bundledChoices(), []);
  const groups = useMemo(() => [...new Set(bundled.map((b) => b.group))], [bundled]);
  useEffect(() => {
    void customFonts().then(setCustom);
  }, []);
  const pick = async (id: string) => {
    await ensureFonts([id]);
    onChange(id);
  };
  return (
    <div className="space-y-1">
      <label className="block">
        <span className="mb-0.5 block text-[11px] text-zinc-500">Font</span>
        <select aria-label="Font" className="w-full rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={value} onChange={(e) => void pick(e.target.value)}>
          {!bundled.some((b) => b.id === value) && !custom.some((c) => c.id === value) && !(system ?? []).some((s) => `system:${s}` === value) && <option value={value}>{fontLabel(value)}</option>}
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {bundled.filter((b) => b.group === g).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </optgroup>
          ))}
          {custom.length > 0 && <optgroup label="Uploaded">{custom.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>}
          {system && system.length > 0 && <optgroup label="Installed on this device">{system.map((s) => <option key={s} value={`system:${s}`}>{s}</option>)}</optgroup>}
        </select>
      </label>
      <div className="flex gap-2 text-[11px]">
        {!system && <button className="text-brand-600 hover:underline" onClick={() => void querySystemFonts().then(setSystem)}>Show installed fonts</button>}
        <button className="text-brand-600 hover:underline" onClick={() => fileRef.current?.click()}>Upload font…</button>
        <input
          ref={fileRef}
          type="file"
          accept={FONT_ACCEPT}
          className="hidden"
          aria-label="Upload font file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setError('');
              const id = await addCustomFont(f);
              setCustom(await customFonts());
              onChange(id);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {system && system.length === 0 && <p className="text-[11px] text-zinc-500">No common installed fonts detected.</p>}
    </div>
  );
}

export function TextProps({ el, set }: { el: TextElement; set(patch: Partial<TextElement>, refit?: boolean): void }) {
  const weights = weightsFor(el.fontId);
  const emWords = el.emphasis?.words.join(', ') ?? '';
  const theme = useDocument((s) => s.carousel?.theme);
  const pal = theme?.customPalette ?? getPalette(theme?.paletteId ?? 'paper-ink').colors;
  const active = currentEffect(el);
  return (
    <>
      <Section title="Text effect">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Text effects">
          {TEXT_EFFECTS.map((fx) => (
            <button
              key={fx.id}
              aria-pressed={active === fx.id}
              className={`rounded-md border px-1.5 py-1 text-[11px] ${active === fx.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'border-zinc-200 hover:border-brand-500 dark:border-zinc-700'}`}
              onClick={() => set(fx.apply(el, pal))}
            >
              {fx.label}
            </button>
          ))}
        </div>
        {el.extrude && (
          <>
            <Row>
              <ColorField label="Depth color" value={el.extrude.color.slice(0, 7)} onChange={(c) => set({ extrude: { ...el.extrude!, color: c ?? '#000000' } })} />
              <NumberField label="Depth" value={el.extrude.depth} min={1} max={2000} onChange={(v) => set({ extrude: { ...el.extrude!, depth: v } })} />
            </Row>
            <Slider label="Direction" value={el.extrude.angle} min={0} max={360} onChange={(v) => set({ extrude: { ...el.extrude!, angle: v } })} format={(v) => `${v}°`} />
          </>
        )}
        {el.glitch && (
          <Row>
            <ColorField label="Glitch A" value={el.glitch.colors[0]} onChange={(c) => set({ glitch: { ...el.glitch!, colors: [c ?? '#FF2D6F', el.glitch!.colors[1]] } })} />
            <ColorField label="Glitch B" value={el.glitch.colors[1]} onChange={(c) => set({ glitch: { ...el.glitch!, colors: [el.glitch!.colors[0], c ?? '#00E5FF'] } })} />
          </Row>
        )}
        {el.glitch && <Slider label="Glitch offset" value={el.glitch.offset} min={1} max={60} onChange={(v) => set({ glitch: { ...el.glitch!, offset: v } })} />}
        {el.echo && (
          <Row>
            <NumberField label="Copies" value={el.echo.count} min={1} max={12} onChange={(v) => set({ echo: { ...el.echo!, count: v } })} />
            <NumberField label="Spacing" value={el.echo.step} min={-400} max={400} onChange={(v) => set({ echo: { ...el.echo!, step: v } })} />
          </Row>
        )}
      </Section>
      <Section title="Text">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-zinc-500">Content</span>
          <textarea aria-label="Text content" className="field h-20 resize-y text-xs" value={el.text} onChange={(e) => set({ text: e.target.value, spans: undefined }, true)} />
        </label>
        <FontPicker value={el.fontId} onChange={(id) => set({ fontId: id, fontWeight: weightsFor(id).includes(el.fontWeight) ? el.fontWeight : weightsFor(id).reduce((b, w) => (Math.abs(w - el.fontWeight) < Math.abs(b - el.fontWeight) ? w : b)) }, true)} />
        <Row>
          <NumberField label="Size" value={el.fontSize} min={6} max={600} onChange={(v) => set({ fontSize: v }, true)} suffix="px" />
          <Select label="Weight" value={String(el.fontWeight)} options={weights.map((w) => [String(w), String(w)])} onChange={(v) => set({ fontWeight: Number(v) }, true)} />
        </Row>
        <div className="flex flex-wrap gap-1">
          <Toggle label="Italic" checked={el.italic} onChange={(v) => set({ italic: v }, true)} />
          <Toggle label="Underline" checked={Boolean(el.underline)} onChange={(v) => set({ underline: v })} />
          <Toggle label="Auto-fit" checked={el.autoFit} onChange={(v) => set({ autoFit: v }, true)} />
        </div>
        <Segmented label="Align" value={el.align} options={[['left', '⟸', 'Left'], ['center', '≡', 'Center'], ['right', '⟹', 'Right']]} onChange={(v) => set({ align: v })} />
        <Segmented label="Vertical" value={el.verticalAlign} options={[['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']]} onChange={(v) => set({ verticalAlign: v })} />
        <Segmented label="Case" value={el.textCase} options={[['none', 'Aa'], ['upper', 'AA'], ['lower', 'aa'], ['title', 'Ab']]} onChange={(v) => set({ textCase: v }, true)} />
        <Segmented label="List" value={el.listStyle ?? 'none'} options={[['none', 'None'], ['bullet', '• Bullets'], ['number', '1. Numbers']]} onChange={(v) => set({ listStyle: v }, true)} />
        <Slider label="Letter spacing" value={el.letterSpacing} min={-10} max={40} step={0.5} onChange={(v) => set({ letterSpacing: v }, true)} />
        <Slider label="Line height" value={el.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(v) => set({ lineHeight: v }, true)} />
        <Slider label="Curve" value={el.curve ?? 0} min={-100} max={100} step={1} onChange={(v) => set({ curve: v || undefined })} />
        {el.spans?.length ? (
          <button className="text-[11px] text-brand-600 hover:underline" onClick={() => set({ spans: undefined }, true)}>Clear rich-text styles ({el.spans.length})</button>
        ) : (
          <p className="text-[11px] text-zinc-500">Tip: double-click the text on the canvas, select words, and use B / I / U / color / Mark for rich text.</p>
        )}
      </Section>
      <Section title="Color & effects">
        <ColorField label="Color" value={el.fill} onChange={(v) => set({ fill: v ?? '#000000' })} />
        <Toggle
          label="Gradient fill"
          checked={Boolean(el.fillGradient)}
          onChange={(v) => set({ fillGradient: v ? { angle: 90, stops: [{ offset: 0, color: el.fill }, { offset: 1, color: '#5B5BF0' }] } : undefined })}
        />
        {el.fillGradient && (
          <>
            <Row>
              <ColorField label="From" value={el.fillGradient.stops[0]?.color} onChange={(c) => set({ fillGradient: { ...el.fillGradient!, stops: [{ offset: 0, color: c ?? '#000000' }, el.fillGradient!.stops[1]!] } })} />
              <ColorField label="To" value={el.fillGradient.stops[1]?.color} onChange={(c) => set({ fillGradient: { ...el.fillGradient!, stops: [el.fillGradient!.stops[0]!, { offset: 1, color: c ?? '#000000' }] } })} />
            </Row>
            <Slider label="Gradient angle" value={el.fillGradient.angle} min={0} max={360} onChange={(v) => set({ fillGradient: { ...el.fillGradient!, angle: v } })} format={(v) => `${v}°`} />
          </>
        )}
        <Toggle label="Outline" checked={Boolean(el.stroke)} onChange={(v) => set({ stroke: v ? { color: '#000000', width: Math.max(1, Math.round(el.fontSize / 30)) } : undefined })} />
        {el.stroke && (
          <Row>
            <ColorField label="Outline color" value={el.stroke.color} onChange={(c) => set({ stroke: { ...el.stroke!, color: c ?? '#000000' } })} />
            <NumberField label="Outline width" value={el.stroke.width} min={0} max={40} onChange={(w) => set({ stroke: { ...el.stroke!, width: w } })} />
          </Row>
        )}
        <Toggle label="Shadow" checked={Boolean(el.shadow)} onChange={(v) => set({ shadow: v ? { color: '#000000', blur: 12, offsetX: 0, offsetY: 6, opacity: 0.35 } : undefined })} />
        {el.shadow && (
          <>
            <Row>
              <ColorField label="Shadow color" value={el.shadow.color} onChange={(c) => set({ shadow: { ...el.shadow!, color: c ?? '#000000' } })} />
              <NumberField label="Blur" value={el.shadow.blur} min={0} max={200} onChange={(b) => set({ shadow: { ...el.shadow!, blur: b } })} />
            </Row>
            <Row>
              <NumberField label="Offset X" value={el.shadow.offsetX} onChange={(b) => set({ shadow: { ...el.shadow!, offsetX: b } })} />
              <NumberField label="Offset Y" value={el.shadow.offsetY} onChange={(b) => set({ shadow: { ...el.shadow!, offsetY: b } })} />
            </Row>
            <Slider label="Shadow opacity" value={el.shadow.opacity} min={0} max={1} step={0.05} onChange={(o) => set({ shadow: { ...el.shadow!, opacity: o } })} />
          </>
        )}
      </Section>
      <Section title="Highlight words" defaultOpen={Boolean(el.emphasis)}>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-zinc-500">Words to emphasize (comma-separated)</span>
          <input
            aria-label="Emphasized words"
            className="field py-1 text-xs"
            value={emWords}
            onChange={(e) => {
              const words = e.target.value.split(',').map((w) => w.trim()).filter(Boolean);
              set({ emphasis: words.length ? { style: el.emphasis?.style ?? 'highlight', color: el.emphasis?.color ?? '#FDE68A', textColor: el.emphasis?.textColor, words } : undefined }, true);
            }}
          />
        </label>
        {el.emphasis && (
          <Row>
            <Select label="Effect" value={el.emphasis.style} options={[['highlight', 'Marker'], ['color', 'Color'], ['underline', 'Underline'], ['box', 'Box'], ['bold', 'Bold'], ['italic', 'Italic']]} onChange={(v) => set({ emphasis: { ...el.emphasis!, style: v } }, true)} />
            <ColorField label="Effect color" value={el.emphasis.color} onChange={(c) => set({ emphasis: { ...el.emphasis!, color: c ?? '#FDE68A' } })} />
          </Row>
        )}
      </Section>
    </>
  );
}

/** Applies a text patch and re-fits (font size for auto-fit boxes, height otherwise). */
export function patchText(el: TextElement, patch: Partial<TextElement>, refit: boolean): TextElement {
  const next = { ...el, ...patch };
  return refit ? refitText(next, patch.fontSize ?? (el.autoFit ? Math.max(el.fontSize, patch.fontSize ?? 0) : el.fontSize)) : next;
}
