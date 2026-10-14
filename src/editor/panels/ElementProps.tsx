import { useState } from 'react';
import type { ChartElement, ImageElement, ImageMask, LineElement, PathElement, QRElement, ShapeElement, SlideElement, TableElement } from '@/model/types';
import { removeBackground } from '@/image/bgremove';
import { tableMetrics } from '../render/TableQR';
import { assetBlob, IMAGE_ACCEPT, storeImage } from '../assets';
import * as A from '../actions';
import { ColorField, IconButton, NumberField, Row, Section, Segmented, Select, Slider, Toggle } from './fields';

type Set<T> = (patch: Partial<T>) => void;

export function CommonProps({ el, set, multi }: { el: SlideElement; set: Set<SlideElement>; multi: boolean }) {
  return (
    <Section title={multi ? 'Selection' : 'Position & size'}>
      {!multi && (
        <>
          <Row>
            <NumberField label="X" value={el.x} onChange={(v) => set({ x: v })} />
            <NumberField label="Y" value={el.y} onChange={(v) => set({ y: v })} />
          </Row>
          <Row>
            <NumberField label="Width" value={el.width} min={4} onChange={(v) => set({ width: v })} />
            <NumberField label="Height" value={el.height} min={4} onChange={(v) => set({ height: v })} />
          </Row>
          <Row>
            <NumberField label="Rotation" value={el.rotation} min={-360} max={360} onChange={(v) => set({ rotation: v })} suffix="°" />
            <NumberField label="Opacity %" value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} />
          </Row>
        </>
      )}
      <div className="flex flex-wrap gap-1">
        <IconButton label="Align left" onClick={() => A.alignSelection('left')}>⇤</IconButton>
        <IconButton label="Align center" onClick={() => A.alignSelection('hcenter')}>↔</IconButton>
        <IconButton label="Align right" onClick={() => A.alignSelection('right')}>⇥</IconButton>
        <IconButton label="Align top" onClick={() => A.alignSelection('top')}>⤒</IconButton>
        <IconButton label="Align middle" onClick={() => A.alignSelection('vcenter')}>↕</IconButton>
        <IconButton label="Align bottom" onClick={() => A.alignSelection('bottom')}>⤓</IconButton>
        {multi && (
          <>
            <IconButton label="Distribute horizontally" onClick={() => A.distributeSelection('h')}>⋯</IconButton>
            <IconButton label="Distribute vertically" onClick={() => A.distributeSelection('v')}>⋮</IconButton>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <IconButton label="Bring to front" onClick={() => A.reorderSelection('front')}>Front</IconButton>
        <IconButton label="Bring forward" onClick={() => A.reorderSelection('forward')}>Fwd</IconButton>
        <IconButton label="Send backward" onClick={() => A.reorderSelection('backward')}>Back</IconButton>
        <IconButton label="Send to back" onClick={() => A.reorderSelection('back')}>Bottom</IconButton>
      </div>
      <div className="flex flex-wrap gap-1">
        {multi ? <IconButton label="Group" onClick={A.groupSelection}>Group</IconButton> : el.kind === 'group' && <IconButton label="Ungroup" onClick={A.ungroupSelection}>Ungroup</IconButton>}
        <IconButton label="Duplicate" onClick={A.duplicateSelection}>Duplicate</IconButton>
        {!multi && <IconButton label={el.locked ? 'Unlock' : 'Lock'} active={el.locked} onClick={() => set({ locked: !el.locked })}>{el.locked ? 'Locked' : 'Lock'}</IconButton>}
        <IconButton label="Delete" onClick={A.deleteSelection}>Delete</IconButton>
      </div>
    </Section>
  );
}

export function ShapeProps({ el, set }: { el: ShapeElement | PathElement; set: (patch: Partial<ShapeElement> & Partial<Omit<PathElement, 'kind'>>) => void }) {
  const isPath = el.kind === 'path';
  return (
    <Section title={isPath ? 'Icon / shape' : 'Shape'}>
      <Row>
        <ColorField label="Fill" value={el.fill} onChange={(v) => set({ fill: v ?? 'transparent' })} allowNone />
        <ColorField label="Stroke" value={el.stroke} onChange={(v) => set({ stroke: v })} allowNone />
      </Row>
      <Row>
        <NumberField label="Stroke width" value={el.strokeWidth ?? 0} min={0} max={100} onChange={(v) => set({ strokeWidth: v })} />
        {el.kind === 'rect' && <NumberField label="Corner radius" value={el.cornerRadius ?? 0} min={0} max={2000} onChange={(v) => set({ cornerRadius: v })} />}
      </Row>
      {!isPath && (
        <>
          <Toggle label="Dashed outline" checked={Boolean((el as ShapeElement).dash)} onChange={(v) => set({ dash: v ? [16, 10] : undefined })} />
          <Toggle label="Shadow" checked={Boolean((el as ShapeElement).shadow)} onChange={(v) => set({ shadow: v ? { color: '#000000', blur: 30, offsetX: 0, offsetY: 12, opacity: 0.2 } : undefined })} />
        </>
      )}
    </Section>
  );
}

export function LineProps({ el, set }: { el: LineElement; set: Set<LineElement> }) {
  return (
    <Section title="Line">
      <Row>
        <ColorField label="Color" value={el.stroke} onChange={(v) => set({ stroke: v ?? '#000000' })} />
        <NumberField label="Thickness" value={el.strokeWidth} min={1} max={80} onChange={(v) => set({ strokeWidth: v })} />
      </Row>
      <Segmented label="Style" value={el.dash ? (el.dash[0]! <= el.strokeWidth ? 'dotted' : 'dashed') : 'solid'} options={[['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]} onChange={(v) => set({ dash: v === 'solid' ? undefined : v === 'dashed' ? [el.strokeWidth * 3, el.strokeWidth * 2] : [0.1, el.strokeWidth * 2] })} />
      <Toggle label="Arrow head" checked={Boolean(el.arrowEnd)} onChange={(v) => set({ arrowEnd: v })} />
    </Section>
  );
}

const MASKS: [ImageMask, string][] = [['none', 'None'], ['rounded', 'Rounded'], ['circle', 'Circle'], ['arch', 'Arch'], ['blob', 'Blob'], ['hexagon', 'Hexagon'], ['star', 'Star']];

export function ImageProps({ el, set }: { el: ImageElement; set: Set<ImageElement> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const f = el.filters ?? {};
  const setF = (p: Partial<NonNullable<ImageElement['filters']>>) => set({ filters: { ...f, ...p } });
  const crop = el.crop ?? { zoom: 1, focusX: 0.5, focusY: 0.5 };

  const replace = async (file: File) => {
    try {
      setError('');
      set({ src: await storeImage(file, file.name), crop: undefined });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeBg = async () => {
    setBusy('Removing background…');
    setError('');
    try {
      const out = await removeBackground(await assetBlob(el.src), { onProgress: (p) => setBusy(p.stage === 'loading-model' ? 'Loading model (first time only)…' : 'Removing background…') });
      set({ src: await storeImage(out, 'cutout.png'), fit: 'contain' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(`Background removal failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Section title="Image">
        <div className="flex flex-wrap gap-1">
          <label className="cursor-pointer rounded-md border border-zinc-300 px-2 py-1 text-xs hover:border-brand-500 dark:border-zinc-700">
            {el.src ? 'Replace…' : 'Upload…'}
            <input type="file" accept={IMAGE_ACCEPT} className="hidden" aria-label="Replace image" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void replace(file); }} />
          </label>
          <IconButton label="Remove background" onClick={() => void removeBg()} disabled={!el.src || Boolean(busy)}>Remove background</IconButton>
        </div>
        {busy && <p role="status" className="text-[11px] text-brand-600">{busy}</p>}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-zinc-500">AI image prompt / alt text</span>
          <input aria-label="Image prompt" className="field py-1 text-xs" placeholder="e.g. team planning at a whiteboard, warm light" value={el.prompt ?? ''} onChange={(e) => set({ prompt: e.target.value || undefined })} />
        </label>
        {el.credit && <p className="text-[11px] text-zinc-500">Photo by <a className="underline" href={el.credit.url} target="_blank" rel="noreferrer">{el.credit.author}</a> on {el.credit.source === 'unsplash' ? 'Unsplash' : 'Pexels'}</p>}
        <Segmented label="Fit" value={el.fit} options={[['cover', 'Fill & crop'], ['contain', 'Fit'], ['fill', 'Stretch']]} onChange={(v) => set({ fit: v })} />
        {el.fit === 'cover' && (
          <>
            <Slider label="Crop zoom" value={crop.zoom} min={1} max={4} step={0.05} onChange={(v) => set({ crop: { ...crop, zoom: v } })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Focus X" value={crop.focusX} min={0} max={1} step={0.01} onChange={(v) => set({ crop: { ...crop, focusX: v } })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Focus Y" value={crop.focusY} min={0} max={1} step={0.01} onChange={(v) => set({ crop: { ...crop, focusY: v } })} format={(v) => `${Math.round(v * 100)}%`} />
          </>
        )}
        <Select label="Mask" value={el.mask ?? 'none'} options={MASKS} onChange={(v) => set({ mask: v })} />
        <Row>
          <NumberField label="Corner radius" value={el.cornerRadius ?? 0} min={0} max={2000} onChange={(v) => set({ cornerRadius: v })} />
          <NumberField label="Border" value={el.strokeWidth ?? 0} min={0} max={60} onChange={(v) => set({ strokeWidth: v, stroke: el.stroke ?? '#FFFFFF' })} />
        </Row>
        {(el.strokeWidth ?? 0) > 0 && <ColorField label="Border color" value={el.stroke} onChange={(v) => set({ stroke: v })} />}
      </Section>
      <Section title="Filters">
        <Slider label="Brightness" value={f.brightness ?? 0} min={-0.6} max={0.6} step={0.02} onChange={(v) => setF({ brightness: v })} />
        <Slider label="Contrast" value={f.contrast ?? 0} min={-60} max={60} step={1} onChange={(v) => setF({ contrast: v })} />
        <Slider label="Saturation" value={f.saturation ?? 0} min={-2} max={2} step={0.05} onChange={(v) => setF({ saturation: v })} />
        <Slider label="Blur" value={f.blur ?? 0} min={0} max={40} step={1} onChange={(v) => setF({ blur: v })} />
        <Toggle label="Black & white" checked={Boolean(f.grayscale)} onChange={(v) => setF({ grayscale: v })} />
        <Toggle label="Duotone" checked={Boolean(f.duotone)} onChange={(v) => setF({ duotone: v ? ['#1E1B4B', '#F9A8D4'] : undefined })} />
        {f.duotone && (
          <Row>
            <ColorField label="Shadows" value={f.duotone[0]} onChange={(c) => setF({ duotone: [c ?? '#000000', f.duotone![1]] })} />
            <ColorField label="Highlights" value={f.duotone[1]} onChange={(c) => setF({ duotone: [f.duotone![0], c ?? '#FFFFFF'] })} />
          </Row>
        )}
        <button className="text-[11px] text-brand-600 hover:underline" onClick={() => set({ filters: undefined })}>Reset filters</button>
      </Section>
    </>
  );
}

export function ChartProps({ el, set }: { el: ChartElement; set: Set<ChartElement> }) {
  const pie = el.chartType === 'pie' || el.chartType === 'donut';
  const series = pie ? el.series.slice(0, 1) : el.series;
  const setCell = (si: number, i: number, v: number) => set({ series: el.series.map((s, k) => (k === si ? { ...s, values: s.values.map((x, j) => (j === i ? v : x)) } : s)) });
  return (
    <Section title="Chart">
      <Segmented label="Type" value={el.chartType} options={[['bar', 'Bar'], ['line', 'Line'], ['pie', 'Pie'], ['donut', 'Donut']]} onChange={(v) => set({ chartType: v })} />
      <div className="overflow-x-auto">
        <table className="text-[11px]" aria-label="Chart data">
          <thead>
            <tr>
              <th className="pr-1 text-left font-normal text-zinc-500">Label</th>
              {series.map((s, si) => (
                <th key={si} className="px-0.5">
                  <input aria-label={`Series ${si + 1} name`} className="w-16 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-900" value={s.name} onChange={(e) => set({ series: el.series.map((x, k) => (k === si ? { ...x, name: e.target.value } : x)) })} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {el.labels.map((l, i) => (
              <tr key={i}>
                <td className="pr-1">
                  <input aria-label={`Label ${i + 1}`} className="w-20 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-900" value={l} onChange={(e) => set({ labels: el.labels.map((x, j) => (j === i ? e.target.value : x)) })} />
                </td>
                {series.map((s, si) => (
                  <td key={si} className="px-0.5">
                    <input type="number" aria-label={`${s.name} ${l}`} className="w-16 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-900" value={s.values[i] ?? 0} onChange={(e) => setCell(si, i, Number(e.target.value))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1">
        <IconButton label="Add row" onClick={() => set({ labels: [...el.labels, `Item ${el.labels.length + 1}`], series: el.series.map((s) => ({ ...s, values: [...s.values, 0] })) })}>+ Row</IconButton>
        <IconButton label="Remove row" disabled={el.labels.length <= 1} onClick={() => set({ labels: el.labels.slice(0, -1), series: el.series.map((s) => ({ ...s, values: s.values.slice(0, -1) })) })}>− Row</IconButton>
        {!pie && <IconButton label="Add series" onClick={() => set({ series: [...el.series, { name: `Series ${el.series.length + 1}`, values: el.labels.map(() => 0) }] })}>+ Series</IconButton>}
        {!pie && <IconButton label="Remove series" disabled={el.series.length <= 1} onClick={() => set({ series: el.series.slice(0, -1) })}>− Series</IconButton>}
      </div>
      <div className="flex flex-wrap gap-1">
        {el.colors.slice(0, Math.max(series.length, pie ? el.labels.length : 1)).map((c, i) => (
          <input key={i} type="color" aria-label={`Chart color ${i + 1}`} className="h-6 w-7 cursor-pointer rounded border-0 p-0" value={c} onChange={(e) => set({ colors: el.colors.map((x, j) => (j === i ? e.target.value : x)) })} />
        ))}
      </div>
      <Row>
        <ColorField label="Text" value={el.textColor} onChange={(v) => set({ textColor: v ?? '#000000' })} />
        <NumberField label="Font size" value={el.fontSize} min={10} max={120} onChange={(v) => set({ fontSize: v })} />
      </Row>
      <Toggle label="Show values" checked={el.showValues} onChange={(v) => set({ showValues: v })} />
      <Toggle label="Legend" checked={el.showLegend} onChange={(v) => set({ showLegend: v })} />
    </Section>
  );
}

export function TableProps({ el, set }: { el: TableElement; set: Set<TableElement> }) {
  const cols = Math.max(1, ...el.rows.map((r) => r.length));
  const setRows = (rows: string[][]) => {
    const next = { ...el, rows };
    set({ rows, height: Math.ceil(tableMetrics(next).total) });
  };
  return (
    <Section title="Table">
      <div className="max-h-64 overflow-auto">
        <table className="text-[11px]" aria-label="Table cells">
          <tbody>
            {el.rows.map((r, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci} className="p-0.5">
                    <input aria-label={`Cell ${ri + 1},${ci + 1}`} className={`w-20 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-900 ${el.header && ri === 0 ? 'font-semibold' : ''}`} value={r[ci] ?? ''} onChange={(e) => setRows(el.rows.map((row, i) => (i === ri ? Array.from({ length: cols }, (_, j) => (j === ci ? e.target.value : row[j] ?? '')) : row)))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1">
        <IconButton label="Add row" onClick={() => setRows([...el.rows, Array(cols).fill('')])}>+ Row</IconButton>
        <IconButton label="Remove row" disabled={el.rows.length <= 1} onClick={() => setRows(el.rows.slice(0, -1))}>− Row</IconButton>
        <IconButton label="Add column" onClick={() => setRows(el.rows.map((r) => [...r, '']))}>+ Col</IconButton>
        <IconButton label="Remove column" disabled={cols <= 1} onClick={() => setRows(el.rows.map((r) => r.slice(0, cols - 1)))}>− Col</IconButton>
      </div>
      <Toggle label="Header row" checked={el.header} onChange={(v) => set({ header: v })} />
      <Row>
        <ColorField label="Header fill" value={el.headerFill} onChange={(v) => set({ headerFill: v ?? '#000000' })} />
        <ColorField label="Header text" value={el.headerTextColor} onChange={(v) => set({ headerTextColor: v ?? '#FFFFFF' })} />
      </Row>
      <Row>
        <ColorField label="Text" value={el.textColor} onChange={(v) => set({ textColor: v ?? '#000000' })} />
        <ColorField label="Stripes" value={el.stripeFill} onChange={(v) => set({ stripeFill: v })} allowNone />
      </Row>
      <Row>
        <NumberField label="Font size" value={el.fontSize} min={10} max={96} onChange={(v) => set({ fontSize: v, height: Math.ceil(tableMetrics({ ...el, fontSize: v }).total) })} />
        <Select label="Align" value={el.align} options={[['left', 'Left'], ['center', 'Center']]} onChange={(v) => set({ align: v })} />
      </Row>
    </Section>
  );
}

export function QRProps({ el, set }: { el: QRElement; set: Set<QRElement> }) {
  return (
    <Section title="QR code">
      <label className="block">
        <span className="mb-0.5 block text-[11px] text-zinc-500">Link or text</span>
        <input aria-label="QR content" className="field py-1 text-xs" value={el.data} onChange={(e) => set({ data: e.target.value })} />
      </label>
      <Row>
        <ColorField label="Foreground" value={el.fg} onChange={(v) => set({ fg: v ?? '#000000' })} />
        <ColorField label="Background" value={el.bg} onChange={(v) => set({ bg: v ?? '#FFFFFF' })} />
      </Row>
      <p className="text-[11px] text-zinc-500">Keep strong contrast so phones can scan it.</p>
    </Section>
  );
}
