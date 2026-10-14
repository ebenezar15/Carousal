import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDocument, useProjects } from '@/app/store';
import { getPreset, getStyle, presets, styles } from '@/styles';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import type { Carousel, CarouselTheme } from '@/model/types';
import { db, type TemplateRecord } from '@/storage/db';
import { newId } from '@/model/id';
import { renderSlide } from '@/export/render';
import { SlideStage } from '../SlideStage';
import { SAMPLE_CONTENT } from '@/app/sample';
import { ensureFonts } from '@/styles/fontLoader';
import { loadIcons } from '@/styles/icons';
import { applyTheme } from '../ops';
import { Section, Select } from './fields';

interface Item { id: string; name: string; styleId: string; presetId: string; carousel: Carousel; builtIn: boolean; record?: TemplateRecord }

const samplePlan = () => planFromText(SAMPLE_CONTENT, defaultOptions);

async function applyDesign(theme: CarouselTheme) {
  const fontsToLoad = [theme.headingFont, theme.bodyFont, ...(getStyle(theme.styleId).fonts.accent ? [getStyle(theme.styleId).fonts.accent!] : [])];
  await Promise.all([ensureFonts(fontsToLoad), loadIcons()]);
  useDocument.getState().apply((d) => applyTheme(d, { ...theme, handle: d.carousel.theme.handle ?? theme.handle }));
}

/** Template gallery (built-in style starters + saved templates) with style/platform filters. */
export function TemplatesPanel() {
  const carousel = useDocument((s) => s.carousel)!;
  const plan = useDocument((s) => s.plan);
  const { current, save, open } = useProjects();
  const saved = useLiveQuery(() => db.templates.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [styleFilter, setStyleFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('current');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const builtIn = useMemo<Item[]>(() => {
    const p = samplePlan();
    return styles.map((s) => ({ id: `builtin:${s.id}`, name: s.name, styleId: s.id, presetId: carousel.presetId, carousel: buildCarousel({ plan: p, presetId: carousel.presetId, theme: themeFor(s.id) }), builtIn: true }));
  }, [carousel.presetId]);

  const items: Item[] = [
    ...saved.map((r) => ({ id: r.id, name: r.name, styleId: r.styleId, presetId: r.presetId, carousel: r.carousel, builtIn: false, record: r })),
    ...builtIn,
  ].filter((i) => (styleFilter === 'all' || i.styleId === styleFilter) && (platformFilter === 'all' || (platformFilter === 'current' ? i.presetId === carousel.presetId : getPreset(i.presetId).platform === platformFilter)));

  const saveTemplate = async () => {
    const p = getPreset(carousel.presetId);
    const thumbnail = carousel.slides[0] ? await renderSlide(carousel.slides[0], p.width, p.height, { pixelRatio: 240 / p.width, mime: 'image/jpeg', quality: 0.8 }) : undefined;
    await db.templates.put({ id: newId('tpl_'), name: name.trim() || `${getStyle(carousel.theme.styleId).name} template`, styleId: carousel.theme.styleId, presetId: carousel.presetId, createdAt: Date.now(), carousel: structuredClone(carousel), plan: plan ? structuredClone(plan) : undefined, thumbnail });
    setName('');
    setMsg('Template saved.');
  };

  const startFrom = async (r: TemplateRecord) => {
    const project = { id: newId('prj_'), name: `${r.name} copy`, createdAt: Date.now(), updatedAt: Date.now(), plan: r.plan, generatedBy: 'template', carousel: { ...structuredClone(r.carousel), id: newId('car_') } };
    open(await save(project));
  };

  return (
    <div data-testid="templates-panel">
      <Section title="Save as template">
        <input aria-label="Template name" className="field py-1 text-xs" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary w-full px-2.5 py-1 text-xs" onClick={() => void saveTemplate()}>Save current design</button>
        {msg && <p role="status" className="text-[11px] text-emerald-700">{msg}</p>}
      </Section>
      <Section title="Gallery">
        <Select label="Style" value={styleFilter} options={[['all', 'All styles'], ...styles.map((s) => [s.id, s.name] as [string, string])]} onChange={setStyleFilter} />
        <Select label="Platform" value={platformFilter} options={[['current', 'This size'], ['all', 'All'], ...[...new Set(presets.map((p) => p.platform))].map((p) => [p, p] as [string, string])]} onChange={setPlatformFilter} />
        <ul className="grid grid-cols-2 gap-2" data-testid="template-list">
          {items.map((it) => {
            const p = getPreset(it.presetId);
            return (
              <li key={it.id} className="space-y-1 text-[11px]" data-testid="template-item">
                <div className="overflow-hidden rounded ring-1 ring-black/10">
                  {it.record?.thumbnail ? <img src={it.record.thumbnail} alt="" className="w-full" /> : <SlideStage slide={it.carousel.slides[0]!} width={p.width} height={p.height} displayWidth={116} />}
                </div>
                <p className="truncate font-medium">{it.name}{!it.builtIn && <span className="ml-1 text-zinc-400">(saved)</span>}</p>
                <div className="flex flex-wrap gap-1">
                  <button className="text-brand-600 hover:underline" onClick={() => void applyDesign(it.carousel.theme)} aria-label={`Apply design ${it.name}`}>Apply design</button>
                  {it.record && current && <button className="text-zinc-600 hover:underline dark:text-zinc-400" onClick={() => void startFrom(it.record!)}>New project</button>}
                  {it.record && <button className="text-red-600 hover:underline" onClick={() => void db.templates.delete(it.id)}>Delete</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
