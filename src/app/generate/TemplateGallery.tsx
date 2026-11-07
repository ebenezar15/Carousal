// Template gallery: the built-in templates by category, searchable, with live previews (cover + second
// slide, so alternating light/dark templates show their rhythm). Thumbnails render once and are cached.
import { useEffect, useMemo, useState } from 'react';
import { getPreset, getStyle } from '@/styles';
import { FAITH_CATEGORIES, TEMPLATES, TEMPLATE_CATEGORIES, searchTemplates, themeFromTemplate, type CarouselTemplate, type TemplateCategory } from '@/styles/templates';
import { getCarouselType, planFromText, defaultOptions, shapeForType, type CarouselPlan } from '@/engine';
import { prepareLayout, rebuildSlide } from '@/engine/layout';
import { renderSlideToDataURL } from '@/export/render';
import { SAMPLES } from '../sample';

const PAGE = 18;
const thumbs = new Map<string, string[]>();

const FAITH_PREVIEW = `# The Trinity almost tore the church apart

And one of its oldest errors is still taught with water, ice and steam.

## Three questions
- Is Jesus truly God?
- Are the three distinct?
- How is God still one?

## Jesus did not become God
Adoptionism taught that Jesus began as a man and was later adopted as God's Son.

> In the beginning was the Word, and the Word was with God, and the Word was God. — John 1:1`;

const previewPlans = new Map<string, CarouselPlan>();
function previewPlan(t: CarouselTemplate, own?: CarouselPlan): CarouselPlan {
  if (own) return own;
  const faith = FAITH_CATEGORIES.includes(t.category);
  const key = faith ? `faith:${t.types[0]}` : 'general';
  let p = previewPlans.get(key);
  if (!p) {
    const text = faith ? (t.category === 'kids' || t.category === 'devotional' ? SAMPLES.find((s) => s.id === 'psalm23')!.text : FAITH_PREVIEW) : SAMPLES[0]!.text;
    p = shapeForType(planFromText(text, defaultOptions), faith ? t.types[0] : undefined);
    previewPlans.set(key, p);
  }
  return p;
}

async function renderThumbs(t: CarouselTemplate, presetId: string, plan: CarouselPlan, planKey: string): Promise<string[]> {
  const key = `${t.id}|${presetId}|${planKey}`;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const theme = themeFromTemplate(t, { handle: '@yourchurch' });
  await prepareLayout(theme, plan);
  const preset = getPreset(presetId);
  const out = [0, 1].filter((i) => i < plan.slides.length).map((i) =>
    renderSlideToDataURL(rebuildSlide(plan, presetId, theme, i), preset.width, preset.height, { pixelRatio: 180 / preset.width, mime: 'image/jpeg', quality: 0.82 }),
  );
  thumbs.set(key, out);
  return out;
}

/** Round-robin across styles so a page shows many different looks, not one family's variants. */
function interleave(list: CarouselTemplate[]): CarouselTemplate[] {
  const groups = new Map<string, CarouselTemplate[]>();
  list.forEach((t) => groups.set(t.styleId, [...(groups.get(t.styleId) ?? []), t]));
  const out: CarouselTemplate[] = [];
  for (let i = 0; out.length < list.length; i++) for (const g of groups.values()) if (g[i]) out.push(g[i]!);
  return out;
}

interface Props {
  presetId: string;
  selectedId?: string;
  /** Carousel type: its templates are offered first as "Suggested". */
  typeId?: string;
  /** Preview templates with this plan (the open carousel) instead of the sample text. */
  plan?: CarouselPlan;
  onPick(t: CarouselTemplate): void;
  onClose?(): void;
  pickLabel?: string;
}

export function TemplateGallery({ presetId, selectedId, typeId, plan, onPick, onClose, pickLabel = 'Use template' }: Props) {
  const type = getCarouselType(typeId);
  const [cat, setCat] = useState<'suggested' | 'all' | TemplateCategory>(type ? 'suggested' : 'all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<Record<string, string[]>>({});
  const planKey = plan ? `own:${plan.title}:${plan.slides.length}` : 'sample';

  const list = useMemo(() => {
    const base = cat === 'all' ? TEMPLATES : cat === 'suggested' ? TEMPLATES.filter((t) => type && t.types.includes(type.id)) : TEMPLATES.filter((t) => t.category === cat);
    return interleave(searchTemplates(query, base));
  }, [cat, query, type]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const visible = list.slice(page * PAGE, page * PAGE + PAGE);

  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const t of visible) {
        if (!alive) return;
        const key = `${t.id}|${presetId}|${planKey}`;
        if (images[key]) continue;
        try {
          const urls = await renderThumbs(t, presetId, previewPlan(t, plan), planKey);
          if (alive) setImages((m) => ({ ...m, [key]: urls }));
        } catch (e) {
          console.warn('Template preview failed', t.id, e);
        }
        // Yield so the dialog stays responsive while previews render.
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((t) => t.id).join(','), presetId, planKey]);

  const tabs: [string, string][] = [...(type ? [['suggested', `For “${type.label}”`] as [string, string]] : []), ['all', `All (${TEMPLATES.length})`], ...TEMPLATE_CATEGORIES];

  return (
    <div className="space-y-3" data-testid="template-gallery">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search templates" className="field min-w-0 flex-1 py-1 text-sm" placeholder="Search: engraving, crimson, kids, timeline, noir…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        {onClose && <button className="btn-ghost border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700" onClick={onClose}>Close</button>}
      </div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Template categories">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={cat === id} className={`rounded-full border px-2 py-0.5 text-[11px] ${cat === id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'border-zinc-300 text-zinc-600 hover:border-brand-500 dark:border-zinc-700 dark:text-zinc-400'}`} onClick={() => { setCat(id as typeof cat); setPage(0); }}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">{list.length} template{list.length === 1 ? '' : 's'}{query ? ` matching “${query}”` : ''}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="template-grid">
        {visible.map((t) => {
          const imgs = images[`${t.id}|${presetId}|${planKey}`];
          return (
            <li key={t.id} data-testid="template-card" className={`space-y-1 rounded-lg p-1.5 text-[11px] ring-1 ${selectedId === t.id ? 'ring-2 ring-brand-500' : 'ring-black/10 dark:ring-white/10'}`}>
              <button className="flex w-full gap-1" onClick={() => onPick(t)} aria-label={`${pickLabel}: ${t.name}`}>
                {imgs ? imgs.map((src, i) => <img key={i} src={src} alt="" className="min-w-0 flex-1 rounded-sm" />) : <div className="aspect-[4/5] w-full animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />}
              </button>
              <p className="truncate font-medium" title={t.name}>{t.name}</p>
              <p className="truncate text-zinc-500" title={getStyle(t.styleId).description}>{getStyle(t.styleId).name}</p>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button className="btn-ghost px-2 py-0.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn-ghost px-2 py-0.5" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
