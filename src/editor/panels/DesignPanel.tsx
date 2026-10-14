import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDocument } from '@/app/store';
import { getPalette, getPreset, getStyle, pairings, palettes, presets, styles, fonts as allFonts } from '@/styles';
import { ensureFonts } from '@/styles/fontLoader';
import { loadIcons } from '@/styles/icons';
import { makeItMore, type MoreDirection } from '@/engine/variations';
import type { CarouselTheme } from '@/model/types';
import { db, type BrandKit } from '@/storage/db';
import { newId } from '@/model/id';
import { applyTheme, changePreset, findReplace } from '../ops';
import { applyBrandKit, removeBrandKit } from '../brand';
import { IMAGE_ACCEPT, storeImage } from '../assets';
import { FontPicker } from './TextProps';
import { ColorField, IconButton, Row, Section, Select, Slider, Toggle } from './fields';
import { PATTERN_OPTIONS, TEXTURE_OPTIONS } from './bgOptions';
import { CONTINUOUS_OPTIONS } from '@/app/generate/CarouselView';
import type { DesignModifiers } from '@/model/types';

const themeFonts = (t: CarouselTheme) => [t.headingFont, t.bodyFont, ...(getStyle(t.styleId).fonts.accent ? [getStyle(t.styleId).fonts.accent!] : [])];

/** Applies a theme to every slide (content and user-added elements are kept). */
async function retheme(next: CarouselTheme) {
  await Promise.all([ensureFonts(themeFonts(next)), loadIcons()]);
  useDocument.getState().apply((d) => applyTheme(d, next));
}

export function DesignPanel() {
  const carousel = useDocument((s) => s.carousel)!;
  const plan = useDocument((s) => s.plan);
  const theme = carousel.theme;
  const style = getStyle(theme.styleId);
  const manualCount = carousel.slides.filter((s) => s.manual).length;
  const canRebuild = Boolean(plan && plan.slides.length === carousel.slides.length);

  return (
    <div data-testid="design-panel">
      <Section title="Theme (all slides)">
        {!canRebuild && <p className="text-[11px] text-amber-700">This carousel has no generation plan, so theme changes are unavailable.</p>}
        <Select label="Style system" value={theme.styleId} options={styles.map((s) => [s.id, s.name])} onChange={(id) => void retheme({ ...theme, styleId: id, paletteId: getStyle(id).palettes[0]!, headingFont: getStyle(id).fonts.heading, bodyFont: getStyle(id).fonts.body, layoutOverrides: undefined, label: undefined })} />
        <Select
          label="Palette"
          value={theme.customPalette ? 'custom' : theme.paletteId}
          options={[...(theme.customPalette ? [['custom', 'Brand kit colors'] as [string, string]] : []), ...style.palettes.map((p) => [p, `★ ${getPalette(p).name}`] as [string, string]), ...palettes.filter((p) => !style.palettes.includes(p.id)).map((p) => [p.id, p.name] as [string, string])]}
          onChange={(id) => id !== 'custom' && void retheme({ ...theme, paletteId: id, customPalette: undefined })}
        />
        <div className="flex flex-wrap gap-1">
          {[...style.palettes].map((p) => {
            const c = getPalette(p).colors;
            return (
              <button key={p} title={getPalette(p).name} aria-label={`Palette ${getPalette(p).name}`} className={`flex overflow-hidden rounded border ${p === theme.paletteId && !theme.customPalette ? 'border-brand-500 ring-1 ring-brand-500' : 'border-zinc-300 dark:border-zinc-700'}`} onClick={() => void retheme({ ...theme, paletteId: p, customPalette: undefined })}>
                {[c.bg, c.text, c.primary, c.accent].map((col, i) => <span key={i} className="h-5 w-3" style={{ background: col }} />)}
              </button>
            );
          })}
        </div>
        <Select
          label="Font pairing"
          value={`${theme.headingFont}|${theme.bodyFont}`}
          options={[
            ...[style.fonts, ...style.altFonts].map((f) => [`${f.heading}|${f.body}`, `★ ${name(f.heading)} + ${name(f.body)}`] as [string, string]),
            ...pairings.map((p) => [`${p.heading}|${p.body}`, `${name(p.heading)} + ${name(p.body)}`] as [string, string]),
          ].filter((o, i, a) => a.findIndex((x) => x[0] === o[0]) === i)}
          onChange={(v) => {
            const [h, b] = v.split('|');
            void retheme({ ...theme, headingFont: h!, bodyFont: b! });
          }}
        />
        <div className="flex flex-wrap gap-1">
          {(['bold', 'minimal', 'colorful', 'professional', 'plain', 'textured'] as MoreDirection[]).map((d) => (
            <IconButton key={d} label={d === 'plain' ? 'Make it plain' : d === 'textured' ? 'Next texture' : `Make it more ${d}`} onClick={() => void retheme(makeItMore(theme, d))}>{d === 'plain' ? 'Plain' : d === 'textured' ? 'Textured' : `More ${d}`}</IconButton>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          Theme changes re-lay out generated slides with your current text. Elements you added are kept{manualCount ? `; ${manualCount} hand-made slide${manualCount > 1 ? 's are' : ' is'} left as is` : ''}.
        </p>
      </Section>
      {canRebuild && <BackgroundSection theme={theme} />}
      <PlatformSection />
      <BrandSection />
      <FindReplaceSection />
    </div>
  );
}

/** Background look for every slide: type (incl. plain), texture, pattern and decoration density. */
function BackgroundSection({ theme }: { theme: CarouselTheme }) {
  const m = theme.modifiers ?? {};
  const set = (patch: Partial<DesignModifiers>) => {
    const modifiers = { ...m, ...patch } as Record<string, unknown>;
    Object.keys(modifiers).forEach((k) => modifiers[k] === undefined && delete modifiers[k]);
    void retheme({ ...theme, modifiers: modifiers as DesignModifiers });
  };
  return (
    <Section title="Background (all slides)">
      <Select
        label="Background"
        value={m.background ?? 'style'}
        options={[['style', 'Style default'], ['plain', 'Plain (flat color only)'], ['solid', 'Solid'], ['gradient', 'Gradient'], ['radial', 'Radial glow'], ['mesh', 'Mesh gradient']]}
        onChange={(v) => set(v === 'plain' ? { background: 'plain', decoration: 'none' } : { background: v === 'style' ? undefined : (v as DesignModifiers['background']), decoration: m.background === 'plain' ? undefined : m.decoration })}
      />
      <Row>
        <Select label="Texture" value={m.texture ?? 'style'} options={[['style', 'Style default'], ['none', 'None'], ...TEXTURE_OPTIONS]} onChange={(v) => set({ texture: v === 'style' ? undefined : (v as DesignModifiers['texture']), textureAmount: undefined })} />
        <Select label="Pattern" value={m.pattern ?? 'style'} options={[['style', 'Style default'], ['none', 'None'], ...PATTERN_OPTIONS]} onChange={(v) => set({ pattern: v === 'style' ? undefined : (v as DesignModifiers['pattern']) })} />
      </Row>
      {m.texture && m.texture !== 'none' && <Slider label="Texture strength" value={m.textureAmount ?? 0.5} min={0.05} max={1} step={0.05} onChange={(v) => set({ textureAmount: v })} />}
      <Select
        label="Continuous slides"
        value={m.panoramic === false ? 'off' : m.continuous ?? (m.panoramic ? 'flow' : 'style')}
        options={[['style', 'Style default'], ...CONTINUOUS_OPTIONS]}
        onChange={(v) => set(v === 'style' ? { panoramic: undefined, continuous: undefined } : v === 'off' ? { panoramic: false, continuous: undefined } : { panoramic: true, continuous: v as DesignModifiers['continuous'] })}
      />
      <Select label="Decorations" value={m.decoration ?? 'style'} options={[['style', 'Style default'], ['none', 'None'], ['minimal', 'Minimal'], ['normal', 'Normal'], ['rich', 'Rich']]} onChange={(v) => set({ decoration: v === 'style' ? undefined : (v as DesignModifiers['decoration']) })} />
    </Section>
  );
}

const name = (id: string) => allFonts.find((f) => f.id === id)?.family ?? id;

function PlatformSection() {
  const carousel = useDocument((s) => s.carousel)!;
  return (
    <Section title="Platform size" defaultOpen={false}>
      <Select
        label="Resize carousel to"
        value={carousel.presetId}
        options={presets.map((p) => [p.id, `${p.label} · ${p.width}×${p.height}`])}
        onChange={(id) => {
          const from = getPreset(carousel.presetId);
          const to = getPreset(id);
          useDocument.getState().apply((d) => changePreset(d, id, from, to));
        }}
      />
    </Section>
  );
}

const emptyKit = (): BrandKit => ({
  id: newId('brand_'), name: 'My brand', colors: { primary: '#5B5BF0', accent: '#F97316', background: '#FFFFFF', text: '#111827' },
  headingFont: 'plus-jakarta-sans', bodyFont: 'inter', handle: '', watermark: false, watermarkPosition: 'bottom-right',
});

function BrandSection() {
  const carousel = useDocument((s) => s.carousel)!;
  const kits = useLiveQuery(() => db.brandKits.toArray(), []) ?? [];
  const [editing, setEditing] = useState<BrandKit | null>(null);
  const active = kits.find((k) => k.id === carousel.theme.brandKitId);
  useEffect(() => {
    if (editing) void ensureFonts([editing.headingFont, editing.bodyFont]);
  }, [editing]);

  const saveKit = async (kit: BrandKit) => {
    await db.brandKits.put(kit);
    setEditing(null);
    if (carousel.theme.brandKitId === kit.id) await retheme(applyBrandKit(carousel.theme, kit));
  };

  return (
    <Section title="Brand kit" defaultOpen={Boolean(active)}>
      {kits.length === 0 && !editing && <p className="text-[11px] text-zinc-500">Save your logo, colors, fonts and handle once, then apply them to any carousel.</p>}
      <ul className="space-y-1">
        {kits.map((k) => (
          <li key={k.id} className="flex items-center gap-2 text-xs">
            <span className="flex overflow-hidden rounded border border-zinc-300 dark:border-zinc-700">
              {Object.values(k.colors).map((c, i) => <span key={i} className="h-4 w-3" style={{ background: c }} />)}
            </span>
            <span className="flex-1 truncate">{k.name}{active?.id === k.id && <span className="ml-1 text-emerald-600">● applied</span>}</span>
            <button className="text-brand-600 hover:underline" onClick={() => void retheme(applyBrandKit(carousel.theme, k))}>Apply</button>
            <button className="text-zinc-500 hover:underline" onClick={() => setEditing(structuredClone(k))}>Edit</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <IconButton label="New brand kit" onClick={() => setEditing(emptyKit())}>+ New brand kit</IconButton>
        {active && <IconButton label="Remove brand kit from this carousel" onClick={() => void retheme(removeBrandKit(carousel.theme))}>Remove from carousel</IconButton>}
      </div>
      {editing && (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700" data-testid="brand-editor">
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-zinc-500">Name</span>
            <input aria-label="Brand name" className="field py-1 text-xs" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <Row>
            {(['primary', 'accent', 'background', 'text'] as const).map((k) => (
              <ColorField key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={editing.colors[k]} onChange={(c) => setEditing({ ...editing, colors: { ...editing.colors, [k]: c ?? '#000000' } })} />
            ))}
          </Row>
          <div>
            <span className="mb-0.5 block text-[11px] text-zinc-500">Heading font</span>
            <FontPicker value={editing.headingFont} onChange={(id) => setEditing({ ...editing, headingFont: id })} />
          </div>
          <div>
            <span className="mb-0.5 block text-[11px] text-zinc-500">Body font</span>
            <FontPicker value={editing.bodyFont} onChange={(id) => setEditing({ ...editing, bodyFont: id })} />
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-zinc-500">Handle</span>
            <input aria-label="Brand handle" className="field py-1 text-xs" placeholder="@yourbrand" value={editing.handle ?? ''} onChange={(e) => setEditing({ ...editing, handle: e.target.value })} />
          </label>
          <label className="block cursor-pointer text-xs text-brand-600 hover:underline">
            {editing.logoSrc ? 'Replace logo…' : 'Upload logo…'}
            <input type="file" accept={IMAGE_ACCEPT} className="hidden" aria-label="Brand logo" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditing({ ...editing, logoSrc: await storeImage(f, f.name) }); }} />
          </label>
          <Toggle label="Watermark (logo + handle on every slide)" checked={editing.watermark} onChange={(v) => setEditing({ ...editing, watermark: v })} />
          {editing.watermark && <Select label="Watermark position" value={editing.watermarkPosition} options={[['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-right', 'Top right'], ['top-left', 'Top left']]} onChange={(v) => setEditing({ ...editing, watermarkPosition: v })} />}
          <div className="flex gap-1">
            <button className="btn-primary px-2.5 py-1 text-xs" onClick={() => void saveKit(editing)}>Save kit</button>
            <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditing(null)}>Cancel</button>
            {kits.some((k) => k.id === editing.id) && <button className="btn-ghost ml-auto px-2.5 py-1 text-xs text-red-600" onClick={() => { void db.brandKits.delete(editing.id); setEditing(null); }}>Delete</button>}
          </div>
        </div>
      )}
    </Section>
  );
}

function FindReplaceSection() {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <Section title="Find & replace" defaultOpen={false}>
      <input aria-label="Find" className="field py-1 text-xs" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} />
      <input aria-label="Replace with" className="field py-1 text-xs" placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} />
      <div className="flex gap-3">
        <Toggle label="Match case" checked={matchCase} onChange={setMatchCase} />
        <Toggle label="Whole word" checked={wholeWord} onChange={setWholeWord} />
      </div>
      <button
        className="btn-primary px-2.5 py-1 text-xs"
        disabled={!find}
        onClick={() => {
          let n = 0;
          useDocument.getState().apply((d) => {
            const r = findReplace(d, find, replace, { matchCase, wholeWord });
            n = r.count;
            return r.doc;
          });
          setMsg(n ? `Replaced ${n} occurrence${n > 1 ? 's' : ''}.` : 'No matches.');
        }}
      >
        Replace all
      </button>
      {msg && <p role="status" className="text-[11px] text-zinc-500">{msg}</p>}
    </Section>
  );
}
