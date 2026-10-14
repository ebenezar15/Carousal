import { Fragment, useMemo, type ReactNode } from 'react';
import { Group, Rect, Text, TextPath } from 'react-konva';
import type { LinearGradient, TextElement } from '@/model/types';
import { fontStack, useFontsVersion } from '@/styles/fontLoader';
import { nearestWeight } from '@/styles';
import { applyCase, layoutElement, trackingFor, type TextLayout } from '@/engine/layout/textLayout';

const shadowProps = (s?: TextElement['shadow']) =>
  s ? { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: s.opacity } : {};

/** Gradient endpoints across a w×h box for a CSS-like angle (0 = bottom→top, 90 = left→right). */
export function gradientPoints(g: LinearGradient, w: number, h: number) {
  const rad = ((g.angle - 90) * Math.PI) / 180;
  const half = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  return {
    start: { x: w / 2 - Math.cos(rad) * half, y: h / 2 - Math.sin(rad) * half },
    end: { x: w / 2 + Math.cos(rad) * half, y: h / 2 + Math.sin(rad) * half },
    stops: g.stops.flatMap((s) => [s.offset, s.color]),
  };
}

/** Draws text in element-local coordinates (0,0 = top-left of the box). */
export function RichText({ el }: { el: TextElement }) {
  // Re-measure when late fonts (e.g. a Tamil fallback) finish loading.
  const fontsVersion = useFontsVersion((s) => s.v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutElement(el), [el, fontsVersion]);
  if (el.curve) return <CurvedText el={el} />;
  const offsetY = el.verticalAlign === 'middle' ? (el.height - layout.height) / 2 : el.verticalAlign === 'bottom' ? el.height - layout.height : 0;
  const em = el.emphasis;
  const pad = el.fontSize * 0.08;
  const grad = el.fillGradient ? gradientPoints(el.fillGradient, el.width, Math.max(el.height, layout.height)) : null;
  return (
    <Group y={offsetY}>
      <EffectLayers el={el} layout={layout} />
      {layout.lines.map((line, li) => {
        const lx = el.align === 'center' ? (el.width - line.width - line.indent) / 2 : el.align === 'right' ? el.width - line.width - line.indent : 0;
        return (
          <Fragment key={li}>
            {line.runs.map((run, ri) => {
              const isEm = Boolean(run.emphasized && em);
              const weight = isEm && em!.style === 'bold' ? nearestWeight(run.style.fontId, 800) : run.style.weight;
              const x = lx + run.x;
              const y = line.y;
              const lh = layout.lineHeightPx;
              let fill = run.style.color ?? el.fill;
              if (isEm && !run.style.color) fill = em!.style === 'color' || em!.style === 'italic' ? em!.color : em!.style === 'box' ? em!.textColor ?? el.fill : el.fill;
              const gradProps =
                grad && !run.style.color && !(isEm && (em!.style === 'color' || em!.style === 'box'))
                  ? { fillLinearGradientStartPoint: { x: grad.start.x - x, y: grad.start.y - y }, fillLinearGradientEndPoint: { x: grad.end.x - x, y: grad.end.y - y }, fillLinearGradientColorStops: grad.stops, fillPriority: 'linear-gradient' as const }
                  : {};
              const underline = run.style.underline || (isEm && em!.style === 'underline');
              return (
                <Fragment key={ri}>
                  {run.style.highlight && <Rect x={x - pad} y={y + lh * 0.12} width={run.width + pad * 2} height={lh * 0.8} fill={run.style.highlight} cornerRadius={pad} />}
                  {isEm && em!.style === 'highlight' && <Rect x={x - pad} y={y + lh * 0.12} width={run.width + pad * 2} height={lh * 0.8} fill={em!.color} cornerRadius={pad} />}
                  {isEm && em!.style === 'box' && <Rect x={x - pad * 1.5} y={y + lh * 0.04} width={run.width + pad * 3} height={lh * 0.94} fill={em!.color} />}
                  {underline && <Rect x={x} y={y + lh * 0.84} width={run.width} height={Math.max(2, el.fontSize * (isEm ? 0.09 : 0.06))} fill={isEm && em!.style === 'underline' ? em!.color : fill} />}
                  <Text
                    x={x}
                    y={y}
                    text={run.text}
                    fontFamily={fontStack(run.style.fontId)}
                    fontSize={el.fontSize}
                    fontStyle={`${run.style.italic ? 'italic ' : ''}${weight}`}
                    letterSpacing={trackingFor(run.text, el.letterSpacing)}
                    lineHeight={el.lineHeight}
                    height={lh}
                    verticalAlign="middle"
                    fill={fill}
                    {...gradProps}
                    stroke={el.stroke?.color}
                    strokeWidth={el.stroke?.width}
                    fillAfterStrokeEnabled
                    {...shadowProps(el.shadow)}
                    wrap="none"
                  />
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </Group>
  );
}

/** One flat copy of the text (no decorations), used for extrude, glitch and echo effects. */
function TextCopy({ el, layout, dx, dy, fill, stroke, strokeWidth, opacity = 1 }: { el: TextElement; layout: TextLayout; dx: number; dy: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }) {
  return (
    <Group x={dx} y={dy} opacity={opacity} listening={false}>
      {layout.lines.map((line, li) => {
        const lx = el.align === 'center' ? (el.width - line.width - line.indent) / 2 : el.align === 'right' ? el.width - line.width - line.indent : 0;
        return line.runs.map((run, ri) => (
          <Text
            key={`${li}-${ri}`}
            x={lx + run.x}
            y={line.y}
            text={run.text}
            fontFamily={fontStack(run.style.fontId)}
            fontSize={el.fontSize}
            fontStyle={`${run.style.italic ? 'italic ' : ''}${run.style.weight}`}
            letterSpacing={trackingFor(run.text, el.letterSpacing)}
            height={layout.lineHeightPx}
            verticalAlign="middle"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            wrap="none"
          />
        ));
      })}
    </Group>
  );
}

/** Extrude (3D / long shadow), glitch and echo copies, drawn behind the main text. */
function EffectLayers({ el, layout }: { el: TextElement; layout: TextLayout }) {
  const layers: ReactNode[] = [];
  if (el.echo && el.echo.count > 0) {
    const sw = Math.max(1, el.fontSize * 0.02);
    for (let i = el.echo.count; i >= 1; i--) layers.push(<TextCopy key={`echo${i}`} el={el} layout={layout} dx={0} dy={el.echo.step * i} fill="transparent" stroke={el.echo.color} strokeWidth={sw} opacity={1 - i / (el.echo.count + 1)} />);
  }
  if (el.extrude && el.extrude.depth > 0) {
    const rad = (el.extrude.angle * Math.PI) / 180;
    const step = Math.max(1, el.fontSize / 60);
    const n = Math.min(80, Math.round(el.extrude.depth / step));
    for (let i = n; i >= 1; i--) layers.push(<TextCopy key={`ex${i}`} el={el} layout={layout} dx={Math.cos(rad) * step * i} dy={Math.sin(rad) * step * i} fill={el.extrude.color} />);
  }
  if (el.glitch) {
    const o = el.glitch.offset;
    layers.push(<TextCopy key="g1" el={el} layout={layout} dx={-o} dy={o * 0.3} fill={el.glitch.colors[0]} opacity={0.9} />);
    layers.push(<TextCopy key="g2" el={el} layout={layout} dx={o} dy={-o * 0.3} fill={el.glitch.colors[1]} opacity={0.9} />);
  }
  return <>{layers}</>;
}

/** Text along a circular arc; curve > 0 smiles, < 0 frowns. Single line, no rich spans. */
function CurvedText({ el }: { el: TextElement }) {
  const c = Math.max(-100, Math.min(100, el.curve ?? 0));
  const sweep = (Math.abs(c) / 100) * Math.PI * 1.6; // up to ~290°
  const w = el.width;
  const r = w / 2 / Math.sin(Math.min(sweep, Math.PI * 0.999) / 2);
  const sag = r - Math.sqrt(Math.max(0, r * r - (w / 2) ** 2));
  const midY = el.height / 2;
  const large = sweep > Math.PI ? 1 : 0;
  const grad = el.fillGradient ? gradientPoints(el.fillGradient, el.width, el.height) : null;
  const data =
    c > 0
      ? `M 0 ${midY - sag / 2} A ${r} ${r} 0 ${large} 0 ${w} ${midY - sag / 2}`
      : `M 0 ${midY + sag / 2} A ${r} ${r} 0 ${large} 1 ${w} ${midY + sag / 2}`;
  return (
    <TextPath
      data={data}
      text={applyCase(el.text.replace(/\n/g, ' '), el.textCase)}
      fontFamily={fontStack(el.fontId)}
      fontSize={el.fontSize}
      fontStyle={`${el.italic ? 'italic ' : ''}${el.fontWeight}`}
      letterSpacing={trackingFor(el.text, el.letterSpacing)}
      fill={el.fill}
      {...(grad ? { fillLinearGradientStartPoint: grad.start, fillLinearGradientEndPoint: grad.end, fillLinearGradientColorStops: grad.stops, fillPriority: 'linear-gradient' } : {})}
      align="center"
      stroke={el.stroke?.color}
      strokeWidth={el.stroke?.width}
      {...shadowProps(el.shadow)}
    />
  );
}
