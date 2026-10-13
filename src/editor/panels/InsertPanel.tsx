import { useEffect, useMemo, useState } from 'react';
import { useDocument } from '@/app/store';
import { loadIcons, searchIcons, iconsLoaded, type IconDef } from '@/styles/icons';
import * as F from '../factory';
import * as A from '../actions';
import { useEditor } from '../store';
import { IMAGE_ACCEPT, imageElement, storeImage } from '../assets';
import { importStockPhoto, searchStock, stockProviders, type StockPhoto } from '../stock';
import { Section } from './fields';

interface EmojiGroup { name: string; emojis: { emoji: string; name: string }[] }

const tile = 'rounded-md border border-zinc-200 px-2 py-1.5 text-xs hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700';

export function InsertPanel() {
  const carousel = useDocument((s) => s.carousel)!;
  const slideIndex = useEditor((s) => s.slideIndex);
  const env = F.envFor(carousel);
  const [iconQuery, setIconQuery] = useState('');
  const [iconsReady, setIconsReady] = useState(iconsLoaded());
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiGroups, setEmojiGroups] = useState<EmojiGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadIcons().then(() => setIconsReady(true));
  }, []);

  const icons: IconDef[] = useMemo(() => (iconsReady ? searchIcons(iconQuery || 'star', 40) : []), [iconQuery, iconsReady]);
  const emojis = useMemo(() => {
    if (!emojiGroups) return [];
    const q = emojiQuery.trim().toLowerCase();
    const all = emojiGroups.flatMap((g) => g.emojis);
    return (q ? all.filter((e) => e.name.includes(q)) : all).slice(0, 80);
  }, [emojiGroups, emojiQuery]);

  const uploadImages = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    for (const f of Array.from(files)) {
      try {
        const src = await storeImage(f, f.name);
        A.addElement(await imageElement(src, { width: env.W, height: env.H }, { name: f.name }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  return (
    <div data-testid="insert-panel">
      <Section title="Text">
        <div className="grid grid-cols-2 gap-1">
          {(['heading', 'subheading', 'body', 'quote', 'list', 'label'] as const).map((p) => (
            <button key={p} className={tile} onClick={() => A.addElement(F.text(env, p))}>
              {p === 'list' ? 'Bullet list' : p[0]!.toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Shapes & lines">
        <div className="grid grid-cols-3 gap-1">
          {(['rect', 'rounded', 'circle', 'triangle', 'star', 'hexagon', 'frame', 'pill', 'blob'] as const).map((k) => (
            <button key={k} className={tile} onClick={() => A.addElement(F.shape(env, k))}>{k}</button>
          ))}
          <button className={tile} onClick={() => A.addElement(F.line(env, false))}>Line</button>
          <button className={tile} onClick={() => A.addElement(F.line(env, true))}>Arrow</button>
          <button className={tile} onClick={() => A.addElement(F.line(env, false, true))}>Divider</button>
          <button className={tile} onClick={() => A.addElement(F.badge(env, 'burst'))}>Badge</button>
          <button className={tile} onClick={() => A.addElement(F.badge(env, 'pill'))}>Tag</button>
          <button className={tile} onClick={() => A.addElement(F.badge(env, 'callout'))}>Callout</button>
          <button className={tile} onClick={() => A.addElement(F.progressDots(env, slideIndex, carousel.slides.length))}>Progress dots</button>
        </div>
      </Section>
      <Section title="Images">
        <label className="block cursor-pointer rounded-md border-2 border-dashed border-zinc-300 p-3 text-center text-xs hover:border-brand-500 dark:border-zinc-700">
          Upload images (or drop them on the canvas)
          <input type="file" multiple accept={IMAGE_ACCEPT} className="hidden" aria-label="Upload images" onChange={(e) => { void uploadImages(e.target.files); e.target.value = ''; }} />
        </label>
        <button className={tile} onClick={() => A.addElement(F.imagePlaceholder(env, 'Describe the image you want here'))}>+ AI image placeholder</button>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <StockSearch env={env} />
      </Section>
      <Section title="Icons">
        <input aria-label="Search icons" className="field py-1 text-xs" placeholder="Search 1,800+ icons (e.g. rocket, chart)" value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} />
        <div className="grid max-h-56 grid-cols-6 gap-1 overflow-auto" data-testid="icon-results">
          {icons.map((ic) => (
            <button key={ic.name} title={ic.name} aria-label={`Insert icon ${ic.name}`} className="flex aspect-square items-center justify-center rounded border border-transparent hover:border-brand-500" onClick={() => A.addElement(F.icon(env, ic.name, ic.d))}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {ic.d.map((d, i) => <path key={i} d={d} />)}
              </svg>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Emoji" defaultOpen={false}>
        {!emojiGroups ? (
          <button className={tile} onClick={() => void import('unicode-emoji-json/data-by-group.json').then((m) => setEmojiGroups((m.default ?? m) as unknown as EmojiGroup[]))}>Load emoji</button>
        ) : (
          <>
            <input aria-label="Search emoji" className="field py-1 text-xs" placeholder="Search emoji" value={emojiQuery} onChange={(e) => setEmojiQuery(e.target.value)} />
            <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-auto text-xl">
              {emojis.map((e) => (
                <button key={e.emoji} title={e.name} aria-label={`Insert emoji ${e.name}`} className="rounded hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => A.addElement(F.emoji(env, e.emoji, e.name))}>{e.emoji}</button>
              ))}
            </div>
          </>
        )}
      </Section>
      <Section title="Data">
        <div className="grid grid-cols-2 gap-1">
          {(['bar', 'line', 'pie', 'donut'] as const).map((t) => <button key={t} className={tile} onClick={() => A.addElement(F.chart(env, t))}>{t[0]!.toUpperCase() + t.slice(1)} chart</button>)}
          <button className={tile} onClick={() => A.addElement(F.table(env))}>Table</button>
          <button className={tile} onClick={() => A.addElement(F.qr(env))}>QR code</button>
        </div>
      </Section>
    </div>
  );
}

function StockSearch({ env }: { env: F.Env }) {
  const [providers, setProviders] = useState<('unsplash' | 'pexels')[] | null>(null);
  const [source, setSource] = useState<'unsplash' | 'pexels'>('unsplash');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    void stockProviders().then((p) => {
      setProviders(p);
      if (p[0]) setSource(p[0]);
    });
  }, []);
  if (providers === null) return null;
  if (!providers.length) return <p className="text-[11px] text-zinc-500">Stock photos: add a free Unsplash or Pexels API key in Settings to search when online.</p>;
  return (
    <form
      className="space-y-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg('Searching…');
        try {
          setResults(await searchStock(source, q));
          setMsg('');
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}
    >
      <div className="flex gap-1">
        {providers.length > 1 && (
          <select aria-label="Stock source" className="rounded border border-zinc-300 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={source} onChange={(e) => setSource(e.target.value as 'unsplash' | 'pexels')}>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <input aria-label="Search stock photos" className="field py-1 text-xs" placeholder="Search stock photos" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
      <div className="grid max-h-64 grid-cols-3 gap-1 overflow-auto">
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            title={`${p.alt} — ${p.author}`}
            className="overflow-hidden rounded"
            onClick={async () => {
              setMsg('Downloading…');
              try {
                const src = await importStockPhoto(p);
                A.addElement(await imageElement(src, { width: env.W, height: env.H }, { name: p.alt, credit: { author: p.author, url: p.pageUrl, source: p.source } }));
                setMsg('');
              } catch (err) {
                setMsg((err as Error).message);
              }
            }}
          >
            <img src={p.thumb} alt={p.alt} className="aspect-square w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </form>
  );
}
