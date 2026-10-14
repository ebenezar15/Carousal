import { Fragment } from 'react';
import { Arc, Circle, Group, Line, Rect, Text } from 'react-konva';
import type { ChartElement } from '@/model/types';
import { cssFamily } from '@/styles/fontLoader';
import { contrast } from '@/styles/color';

/** Rounds an axis maximum up to 1/2/2.5/5 × 10ⁿ so ticks are tidy numbers. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= v)!;
  return m * p;
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));

/** Bar / line / pie / donut chart drawn from editable data, in element-local coords. */
export function ChartNode({ el }: { el: ChartElement }) {
  const fam = cssFamily(el.fontId);
  const fs = el.fontSize;
  const color = (i: number) => el.series[i]?.color ?? el.colors[i % el.colors.length] ?? '#5B5BF0';
  const legendH = el.showLegend && (el.chartType === 'pie' || el.chartType === 'donut' ? el.labels.length : el.series.length) > 1 ? fs * 1.8 : 0;
  const text = (t: string, x: number, y: number, w: number, align: 'left' | 'center' | 'right' = 'center', size = fs, bold = false, fill = el.textColor) => (
    <Text text={t} x={x} y={y} width={w} align={align} fontFamily={fam} fontSize={size} fontStyle={bold ? '700' : '400'} fill={fill} wrap="none" ellipsis />
  );
  const pieLabel = (t: string, fill: string, x: number, y: number, w: number, align: 'center', size: number, bold: boolean) => text(t, x, y, w, align, size, bold, fill);

  if (el.chartType === 'pie' || el.chartType === 'donut') {
    const values = el.series[0]?.values ?? [];
    const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const r = Math.min(el.width, el.height - legendH) / 2 - fs * 0.5;
    const cx = el.width / 2;
    const cy = (el.height - legendH) / 2;
    const sweeps = values.map((v) => (Math.max(0, v) / total) * 360);
    const starts = sweeps.map((_, i) => -90 + sweeps.slice(0, i).reduce((a, b) => a + b, 0));
    return (
      <Group>
        {values.map((v, i) => {
          const sweep = sweeps[i]!;
          const angle = starts[i]!;
          const mid = ((angle + sweep / 2) * Math.PI) / 180;
          const node = (
            <Fragment key={i}>
              <Arc x={cx} y={cy} innerRadius={el.chartType === 'donut' ? r * 0.58 : 0} outerRadius={r} angle={sweep} rotation={angle} fill={el.colors[i % el.colors.length]} stroke={el.gridColor} strokeWidth={2} />
              {el.showValues && sweep > 14 && pieLabel(`${Math.round((v / total) * 100)}%`, contrast('#FFFFFF', el.colors[i % el.colors.length]!) >= 3 ? '#FFFFFF' : '#111111', cx + Math.cos(mid) * r * (el.chartType === 'donut' ? 0.79 : 0.62) - fs * 2, cy + Math.sin(mid) * r * (el.chartType === 'donut' ? 0.79 : 0.62) - fs / 2, fs * 4, 'center', fs, true)}
            </Fragment>
          );
          return node;
        })}
        {legendH > 0 && <Legend el={el} items={el.labels.map((l, i) => [l, el.colors[i % el.colors.length]!])} y={el.height - legendH + fs * 0.4} />}
      </Group>
    );
  }

  const all = el.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(1, ...all));
  const min = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
  const left = fs * 2.6;
  const bottom = fs * 1.8 + legendH;
  const top = fs * (el.showValues ? 1.4 : 0.5);
  const plotW = el.width - left;
  const plotH = el.height - bottom - top;
  const yOf = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const n = Math.max(1, el.labels.length);
  const slot = plotW / n;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  return (
    <Group>
      {ticks.map((t, i) => (
        <Fragment key={i}>
          <Line points={[left, yOf(t), el.width, yOf(t)]} stroke={el.gridColor} strokeWidth={1.5} />
          {text(fmt(t), 0, yOf(t) - fs / 2, left - fs * 0.4, 'right', fs * 0.85)}
        </Fragment>
      ))}
      {el.labels.map((l, i) => <Fragment key={i}>{text(l, left + i * slot, top + plotH + fs * 0.4, slot, 'center', fs * 0.9)}</Fragment>)}
      {el.chartType === 'bar'
        ? el.series.map((s, si) => {
            const gap = slot * 0.2;
            const bw = (slot - gap * 2) / el.series.length;
            return s.values.map((v, i) => {
              const x = left + i * slot + gap + si * bw;
              const y0 = yOf(Math.max(0, min));
              const y1 = yOf(v);
              return (
                <Fragment key={`${si}-${i}`}>
                  <Rect x={x} y={Math.min(y0, y1)} width={bw * 0.92} height={Math.abs(y0 - y1)} fill={color(si)} cornerRadius={[bw * 0.12, bw * 0.12, 0, 0]} />
                  {el.showValues && text(fmt(v), x - bw, y1 - fs * 1.25, bw * 3, 'center', fs * 0.85, true)}
                </Fragment>
              );
            });
          })
        : el.series.map((s, si) => {
            const pts = s.values.flatMap((v, i) => [left + i * slot + slot / 2, yOf(v)]);
            return (
              <Fragment key={si}>
                <Line points={pts} stroke={color(si)} strokeWidth={Math.max(3, fs * 0.18)} lineJoin="round" lineCap="round" />
                {s.values.map((v, i) => (
                  <Fragment key={i}>
                    <Circle x={left + i * slot + slot / 2} y={yOf(v)} radius={Math.max(4, fs * 0.25)} fill={color(si)} />
                    {el.showValues && text(fmt(v), left + i * slot, yOf(v) - fs * 1.4, slot, 'center', fs * 0.85, true)}
                  </Fragment>
                ))}
              </Fragment>
            );
          })}
      {legendH > 0 && <Legend el={el} items={el.series.map((s, i) => [s.name, color(i)])} y={el.height - legendH + fs * 0.4} />}
    </Group>
  );
}

function Legend({ el, items, y }: { el: ChartElement; items: [string, string][]; y: number }) {
  const fs = el.fontSize * 0.85;
  const itemW = el.width / items.length;
  return (
    <Group y={y}>
      {items.map(([label, c], i) => (
        <Fragment key={i}>
          <Rect x={i * itemW} y={fs * 0.15} width={fs * 0.8} height={fs * 0.8} fill={c} cornerRadius={fs * 0.2} />
          <Text x={i * itemW + fs * 1.2} y={0} width={itemW - fs * 1.4} text={label} fontFamily={cssFamily(el.fontId)} fontSize={fs} fill={el.textColor} wrap="none" ellipsis />
        </Fragment>
      ))}
    </Group>
  );
}
