import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCarousel } from '@/editor/accessibility';
import { canvasSampler } from '@/editor/sampler';
import type { Carousel, Project } from '@/model/types';
import { getPreset } from '@/styles';
import type { CarouselPlan } from '@/engine/schema';
import { SlideStage } from '@/editor/SlideStage';
import { slideFileName, slideToBlob, verifyImage, webpEncodeSupported, slug, type ImageFormat, type Verified } from './images';
import { pdfPageSizes, slidesToPdf, textFile, zipFiles } from './archive';
import { slidesToGif, slidesToVideo, videoSize, type Transition } from './video';
import { ANIMATION_PRESETS, autoAnimate, introDuration, slideHasAnimation, type AnimationPreset } from '@/editor/animation';
import { exportProjectFile, PROJECT_EXT } from './projectFile';
import { formatBytes, saveBlob } from './save';

type Mode = 'images' | 'zip' | 'pdf' | 'video' | 'project';

interface Result { rows: (Verified & { note?: string })[]; saved: string[] }

export function ExportDialog({ project, carousel, plan, onClose, initialSlide }: { project: Project; carousel: Carousel; plan?: CarouselPlan | null; onClose(): void; initialSlide?: number }) {
  const preset = getPreset(carousel.presetId);
  const [mode, setMode] = useState<Mode>(preset.exportKind === 'pdf' ? 'pdf' : 'zip');
  const [format, setFormat] = useState<ImageFormat>('png');
  const [scale, setScale] = useState<1 | 2>(1);
  const [quality, setQuality] = useState(0.92);
  const [range, setRange] = useState<'all' | 'current'>('all');
  const [videoKind, setVideoKind] = useState<'mp4' | 'gif' | 'clips'>('mp4');
  const hasOwnAnimation = useMemo(() => carousel.slides.some(slideHasAnimation), [carousel]);
  const [animation, setAnimation] = useState<'mine' | AnimationPreset>(hasOwnAnimation ? 'mine' : 'subtle');
  const [hold, setHold] = useState(2.5);
  const [transition, setTransition] = useState<Transition>('slide');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const abort = useRef<AbortController | null>(null);
  const webp = useMemo(() => webpEncodeSupported(), []);
  const [a11y, setA11y] = useState<{ errors: number; warnings: number } | null>(null);
  useEffect(() => {
    let alive = true;
    void checkCarousel(carousel, canvasSampler(carousel.presetId)).then((issues) => {
      if (alive) setA11y({ errors: issues.filter((i) => i.severity === 'error').length, warnings: issues.filter((i) => i.severity === 'warning').length });
    });
    return () => {
      alive = false;
    };
  }, [carousel]);

  const slides = range === 'current' && initialSlide !== undefined ? [carousel.slides[initialSlide]!] : carousel.slides;
  const indices = range === 'current' && initialSlide !== undefined ? [initialSlide] : carousel.slides.map((_, i) => i);
  const expected = { width: preset.width * scale, height: preset.height * scale };
  const maxMB = preset.maxFileSizeMB;
  const name = project.name;
  const ext = format;

  const run = async () => {
    setError('');
    setResult(null);
    setProgress(0);
    abort.current = new AbortController();
    try {
      if (mode === 'images' || mode === 'zip') {
        setBusy('Rendering slides…');
        const rows: Verified[] = [];
        for (const [n, i] of indices.entries()) {
          const blob = await slideToBlob(carousel.slides[i]!, preset, { format, scale, quality });
          rows.push(await verifyImage(slideFileName(name, i, ext), blob, expected, maxMB));
          setProgress((n + 1) / indices.length);
        }
        const saved: string[] = [];
        if (mode === 'zip') {
          const extras = plan ? [{ name: 'caption.txt', blob: textFile(`${plan.caption}\n\n${plan.hashtags.join(' ')}\n${project.altText?.length ? `\n--- Alt text ---\n${project.altText.map((a) => a).join('\n')}\n` : ''}`) }] : [];
          const zip = await zipFiles([...rows.map((r) => ({ name: r.name, blob: r.blob })), ...extras]);
          const zipName = `${slug(name)}.zip`;
          if ((await saveBlob(zip, zipName)) === 'saved') saved.push(`${zipName} (${formatBytes(zip.size)})`);
        } else {
          for (const r of rows) if ((await saveBlob(r.blob, r.name)) === 'saved') saved.push(r.name);
        }
        setResult({ rows, saved });
      } else if (mode === 'pdf') {
        setBusy('Building PDF…');
        const blob = await slidesToPdf(slides, {
          width: preset.width, height: preset.height, scale, imageFormat: format === 'png' ? 'png' : 'jpg', quality,
          title: name, author: carousel.theme.handle, subject: plan?.caption, keywords: plan?.hashtags, onProgress: (d, t) => setProgress(d / t),
        });
        const pages = await pdfPageSizes(blob);
        const ok = pages.every((p) => Math.round(p.width) === preset.width && Math.round(p.height) === preset.height);
        const fileName = `${slug(name)}.pdf`;
        const saved = (await saveBlob(blob, fileName)) === 'saved' ? [`${fileName} (${formatBytes(blob.size)})`] : [];
        setResult({
          rows: [{ name: `${fileName} · ${pages.length} pages`, blob, expected: { width: preset.width, height: preset.height }, actual: pages[0] && { width: Math.round(pages[0].width), height: Math.round(pages[0].height) }, dimsOk: ok, sizeOk: !maxMB || blob.size <= maxMB * 1024 * 1024, note: pages.length > (preset.maxSlides ?? 300) ? `More pages than ${preset.label} allows` : undefined }],
          saved,
        });
      } else if (mode === 'video') {
        setBusy(videoKind === 'gif' ? 'Encoding GIF…' : 'Encoding video…');
        const opts = { width: preset.width, height: preset.height, hold, transition, transitionDuration: 0.6, onProgress: setProgress, signal: abort.current.signal };
        const animated = animation === 'mine' ? slides : slides.map((sl) => autoAnimate(sl, animation));
        if (videoKind === 'clips') {
          // One short animated clip per slide, for carousels that mix videos (Instagram, TikTok, LinkedIn).
          const files: { name: string; blob: Blob }[] = [];
          for (let i = 0; i < animated.length; i++) {
            const v = await slidesToVideo([animated[i]!], { ...opts, transition: 'none', onProgress: (p) => setProgress((i + p) / animated.length) });
            files.push({ name: `${slug(name)}-${String(indices[i]! + 1).padStart(2, '0')}.${v.ext}`, blob: v.blob });
          }
          const zip = await zipFiles(files);
          const fileName = `${slug(name)}-clips.zip`;
          const saved = (await saveBlob(zip, fileName)) === 'saved' ? [`${fileName} (${formatBytes(zip.size)})`] : [];
          setResult({ rows: files.map((f) => ({ name: f.name, blob: f.blob, expected: videoSize(preset.width, preset.height), actual: videoSize(preset.width, preset.height), dimsOk: true, sizeOk: true, note: formatBytes(f.blob.size) })), saved });
        } else if (videoKind === 'gif') {
          const blob = await slidesToGif(animated, opts);
          const fileName = `${slug(name)}.gif`;
          const size = videoSize(preset.width, preset.height, 540);
          const saved = (await saveBlob(blob, fileName)) === 'saved' ? [`${fileName} (${formatBytes(blob.size)})`] : [];
          setResult({ rows: [{ ...(await verifyImage(fileName, blob, size)), note: 'GIFs are downscaled to 540px wide to keep them small' }], saved });
        } else {
          const v = await slidesToVideo(animated, opts);
          const fileName = `${slug(name)}.${v.ext}`;
          const saved = (await saveBlob(v.blob, fileName)) === 'saved' ? [`${fileName} (${formatBytes(v.blob.size)})`] : [];
          setResult({ rows: [{ name: fileName, blob: v.blob, expected: videoSize(preset.width, preset.height), actual: { width: v.width, height: v.height }, dimsOk: true, sizeOk: true, note: v.ext === 'webm' ? `This browser has no H.264 encoder, so this is a WebM (${v.codec.toUpperCase()}) video. Instagram/TikTok/LinkedIn expect MP4 — export from Chrome, Edge or Safari for MP4, or use the GIF option.` : `${v.codec.toUpperCase()} MP4 · ${v.duration.toFixed(1)}s` }], saved });
        }
      } else {
        setBusy('Packing project…');
        const blob = await exportProjectFile({ ...project, carousel, plan: plan ?? project.plan });
        const fileName = `${slug(name)}.${PROJECT_EXT}`;
        const saved = (await saveBlob(blob, fileName)) === 'saved' ? [`${fileName} (${formatBytes(blob.size)})`] : [];
        setResult({ rows: [], saved });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const thumbW = preset.width > preset.height ? 150 : 96;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Export">
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="font-semibold">Export “{name}”</h2>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Close export">✕</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Export type">
              {([['zip', 'ZIP of images'], ['images', 'Separate images'], ['pdf', 'PDF'], ['video', 'Video / GIF'], ['project', 'Project file']] as [Mode, string][]).map(([m, l]) => (
                <button key={m} role="tab" aria-selected={mode === m} className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === m ? 'bg-brand-500 text-white' : 'border border-zinc-300 hover:border-brand-500 dark:border-zinc-700'}`} onClick={() => { setMode(m); setResult(null); }}>
                  {l}
                </button>
              ))}
            </div>

            {(mode === 'images' || mode === 'zip' || mode === 'pdf') && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="label">{mode === 'pdf' ? 'Page images' : 'Format'}</span>
                  <select aria-label="Image format" className="field py-1.5" value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)}>
                    <option value="png">PNG (lossless)</option>
                    <option value="jpg">JPG (smaller)</option>
                    {mode !== 'pdf' && <option value="webp" disabled={!webp}>WebP{webp ? '' : ' (not supported here)'}</option>}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Resolution</span>
                  <select aria-label="Resolution" className="field py-1.5" value={scale} onChange={(e) => setScale(Number(e.target.value) as 1 | 2)}>
                    <option value={1}>1× · {preset.width}×{preset.height}</option>
                    <option value={2}>2× · {preset.width * 2}×{preset.height * 2}</option>
                  </select>
                </label>
                {format !== 'png' && (
                  <label className="col-span-2 block">
                    <span className="label">Quality {Math.round(quality * 100)}%</span>
                    <input aria-label="Quality" type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-brand-500" />
                  </label>
                )}
              </div>
            )}

            {mode === 'video' && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="label">Type</span>
                  <select aria-label="Video type" className="field py-1.5" value={videoKind} onChange={(e) => setVideoKind(e.target.value as 'mp4' | 'gif' | 'clips')}>
                    <option value="mp4">Video (MP4)</option>
                    <option value="gif">Animated GIF</option>
                    <option value="clips">One animated clip per slide (ZIP)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Animation</span>
                  <select aria-label="Animation" className="field py-1.5" value={animation} onChange={(e) => setAnimation(e.target.value as 'mine' | AnimationPreset)}>
                    {hasOwnAnimation && <option value="mine">As set in the editor</option>}
                    {ANIMATION_PRESETS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Transition</span>
                  <select aria-label="Transition" className="field py-1.5" value={transition} onChange={(e) => setTransition(e.target.value as Transition)}>
                    <option value="slide">Slide (swipe)</option>
                    <option value="fade">Crossfade</option>
                    <option value="zoom">Zoom in</option>
                    <option value="none">Cut</option>
                  </select>
                </label>
                <label className="col-span-2 block">
                  <span className="label">Hold each slide: {hold.toFixed(1)}s (after its animation) · total ≈ {(slides.reduce((t, sl) => t + hold + (animation === 'none' ? 0 : introDuration(animation === 'mine' ? sl : autoAnimate(sl, animation))), 0) + (slides.length - 1) * (transition === 'none' ? 0 : 0.6)).toFixed(0)}s</span>
                  <input aria-label="Seconds per slide" type="range" min={1} max={8} step={0.5} value={hold} onChange={(e) => setHold(Number(e.target.value))} className="w-full accent-brand-500" />
                </label>
              </div>
            )}

            {mode === 'project' && <p className="text-sm text-zinc-600 dark:text-zinc-400">Saves a <code>.{PROJECT_EXT}</code> file with every slide, the generation plan, and embedded images and uploaded fonts. Open it on any machine from Generate → Open project file.</p>}

            {mode !== 'project' && initialSlide !== undefined && (
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5"><input type="radio" name="range" checked={range === 'all'} onChange={() => setRange('all')} /> All {carousel.slides.length} slides</label>
                <label className="flex items-center gap-1.5"><input type="radio" name="range" checked={range === 'current'} onChange={() => setRange('current')} /> Current slide only</label>
              </div>
            )}

            {mode !== 'project' && mode !== 'video' && (
              <div>
                <h3 className="label">Preview</h3>
                <ul className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 overflow-y-auto" data-testid="export-preview">
                  {indices.map((i) => (
                    <li key={i} className="text-[10px] text-zinc-500">
                      <div className="overflow-hidden rounded ring-1 ring-black/10"><SlideStage slide={carousel.slides[i]!} width={preset.width} height={preset.height} displayWidth={thumbW} /></div>
                      <p className="mt-0.5 truncate">{mode === 'pdf' ? `Page ${i + 1}` : slideFileName(name, i, ext)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-3 text-xs">
            <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
              <p className="font-medium">{preset.label}</p>
              <p className="text-zinc-500">{preset.width}×{preset.height}px · up to {preset.maxSlides} slides{maxMB ? ` · ≤ ${maxMB} MB per file` : ''}</p>
              {preset.exportKind === 'pdf' && mode !== 'pdf' && <p className="mt-1 text-amber-700 dark:text-amber-400">This platform expects a PDF document.</p>}
              {carousel.slides.length > preset.maxSlides && <p className="mt-1 text-amber-700 dark:text-amber-400">You have {carousel.slides.length} slides; the limit is {preset.maxSlides}.</p>}
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800" data-testid="export-a11y">
              <p className="font-medium">Readability check</p>
              {!a11y ? (
                <p className="text-zinc-500">Checking…</p>
              ) : a11y.errors + a11y.warnings === 0 ? (
                <p className="text-emerald-700 dark:text-emerald-400">No contrast or size problems ✓</p>
              ) : (
                <p className="text-amber-700 dark:text-amber-400">{a11y.errors} errors, {a11y.warnings} warnings — open the editor’s Check tab to review and fix.</p>
              )}
            </div>
            <button className="btn-primary w-full" onClick={() => void run()} disabled={Boolean(busy)}>{busy ?? 'Export'}</button>
            {busy && (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700"><div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                {mode === 'video' && <button className="text-zinc-500 hover:underline" onClick={() => abort.current?.abort()}>Cancel</button>}
              </div>
            )}
            {error && <p role="alert" className="text-red-600">{error}</p>}
            {result && (
              <div className="space-y-2" data-testid="export-result">
                {result.saved.length > 0 && <p role="status" className="text-emerald-700 dark:text-emerald-400">Saved: {result.saved.length > 3 ? `${result.saved.length} files` : result.saved.join(', ')}</p>}
                {result.rows.length > 0 && (
                  <table className="w-full text-[11px]">
                    <thead><tr className="text-left text-zinc-500"><th>File</th><th>Pixels</th><th>Size</th></tr></thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.name} data-testid="export-row" data-ok={r.dimsOk && r.sizeOk}>
                          <td className="max-w-[90px] truncate" title={r.note ?? r.name}>{r.name}</td>
                          <td className={r.dimsOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}>{r.actual ? `${r.actual.width}×${r.actual.height}` : '—'} {r.dimsOk ? '✓' : `≠ ${r.expected.width}×${r.expected.height}`}</td>
                          <td className={r.sizeOk ? '' : 'text-red-600'}>{formatBytes(r.blob.size)}{r.sizeOk ? '' : ' ⚠'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {result.rows.some((r) => r.note) && <p className="text-zinc-500">{result.rows.find((r) => r.note)?.note}</p>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
