// Renders one Slide scene graph with react-konva. Used for the editor canvas, thumbnails and export,
// so all three are pixel-identical. Coordinates in the model are in output pixels (e.g. 1080×1350);
// `displayWidth` only scales the stage.
import { forwardRef, Fragment, useMemo, type ReactNode } from 'react';
import { Ellipse, Group, Layer, Line, Path, Rect, Shape, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { Background, BackgroundPattern, GroupElement, PathElement, Shadow, Slide, SlideElement, TextElement } from '@/model/types';
import { cssFamily } from '@/styles/fontLoader';
import { hexToRgb } from '@/styles/color';
import { nearestWeight } from '@/styles';
import { applyCase, emphasisFont, layoutText } from '@/engine/layout/textLayout';

interface Props {
  slide: Slide;
  width: number;
  height: number;
  displayWidth: number;
}

export const SlideStage = forwardRef<Konva.Stage, Props>(function SlideStage({ slide, width, height, displayWidth }, ref) {
  const scale = displayWidth / width;
  return (
    <Stage ref={ref} width={Math.round(width * scale)} height={Math.round(height * scale)} scaleX={scale} scaleY={scale} listening={false}>
      <Layer>
        <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
          <BackgroundNode bg={slide.background} width={width} height={height} />
          {slide.elements.map((el) => (
            <ElementNode key={el.id} el={el} />
          ))}
        </Group>
      </Layer>
    </Stage>
  );
});

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Backgrounds are drawn on a canvas `count` slides wide and offset, so panoramic spans line up at seams. */
function BackgroundNode({ bg, width, height }: { bg: Background; width: number; height: number }) {
  const count = bg.span?.count ?? 1;
  const offset = -(bg.span?.index ?? 0) * width;
  const W = width * count;
  let fill: ReactNode;
  if (bg.type === 'solid') fill = <Rect width={W} height={height} fill={bg.color} />;
  else if (bg.type === 'linear') {
    const stops = bg.stops.flatMap((s) => [s.offset, s.color]);
    const rad = ((bg.angle - 90) * Math.PI) / 180;
    const half = (Math.abs(W * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) / 2;
    const cx = W / 2;
    const cy = height / 2;
    fill = (
      <Rect
        width={W}
        height={height}
        fillLinearGradientStartPoint={{ x: cx - Math.cos(rad) * half, y: cy - Math.sin(rad) * half }}
        fillLinearGradientEndPoint={{ x: cx + Math.cos(rad) * half, y: cy + Math.sin(rad) * half }}
        fillLinearGradientColorStops={stops}
      />
    );
  } else if (bg.type === 'radial') {
    const center = { x: bg.cx * W, y: bg.cy * height };
    fill = (
      <Rect
        width={W}
        height={height}
        fillRadialGradientStartPoint={center}
        fillRadialGradientEndPoint={center}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndRadius={bg.radius * Math.max(W, height)}
        fillRadialGradientColorStops={bg.stops.flatMap((s) => [s.offset, s.color])}
      />
    );
  } else {
    const R = Math.max(width, height);
    fill = (
      <>
        <Rect width={W} height={height} fill={bg.base} />
        {Array.from({ length: count }).flatMap((_, rep) =>
          bg.points.map((p, i) => {
            const c = { x: rep * width + p.x * width, y: p.y * height };
            return (
              <Rect
                key={`${rep}-${i}`}
                width={W}
                height={height}
                fillRadialGradientStartPoint={c}
                fillRadialGradientEndPoint={c}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndRadius={p.r * R}
                fillRadialGradientColorStops={[0, rgba(p.color, 1), 0.55, rgba(p.color, 0.45), 1, rgba(p.color, 0)]}
              />
            );
          }),
        )}
      </>
    );
  }
  return (
    <Group x={offset}>
      {fill}
      {bg.pattern && <PatternNode pattern={bg.pattern} width={W} height={height} />}
      {bg.noise ? <NoiseNode amount={bg.noise} width={W} height={height} /> : null}
    </Group>
  );
}

function PatternNode({ pattern: p, width, height }: { pattern: BackgroundPattern; width: number; height: number }) {
  return (
    <Shape
      opacity={p.opacity}
      sceneFunc={(c) => {
        const ctx = c._context;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        const s = p.size;
        ctx.lineWidth = Math.max(1, s / 28);
        if (p.kind === 'dots' || p.kind === 'halftone') {
          for (let y = s / 2, row = 0; y < height; y += s, row++) {
            for (let x = (p.kind === 'halftone' && row % 2 ? s : s / 2); x < width; x += s) {
              const r = p.kind === 'halftone' ? (s * 0.32 * (0.35 + 0.65 * (y / height))) : Math.max(1.5, s / 14);
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (p.kind === 'grid' || p.kind === 'lines') {
          ctx.beginPath();
          for (let y = s; y < height; y += s) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          if (p.kind === 'grid') for (let x = s; x < width; x += s) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          ctx.stroke();
        } else if (p.kind === 'diagonal') {
          ctx.beginPath();
          for (let x = -height; x < width; x += s) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height, height);
          }
          ctx.stroke();
        } else {
          // perspective grid on the lower 45% (vanishing point above the horizon)
          const horizon = height * 0.55;
          ctx.beginPath();
          for (let i = 0; i < 14; i++) {
            const t = i / 13;
            const y = horizon + (height - horizon) * t * t;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          const vx = width / 2;
          for (let x = -width; x <= width * 2; x += s * 2.5) {
            ctx.moveTo(vx + (x - vx) * 0.08, horizon);
            ctx.lineTo(x, height);
          }
          ctx.stroke();
        }
        ctx.restore();
      }}
      listening={false}
    />
  );
}

const noiseCache = new Map<string, HTMLCanvasElement>();
/** Deterministic grain tile, repeated across the background. */
function noiseTile(): HTMLCanvasElement | null {
  const key = 'tile';
  if (noiseCache.has(key)) return noiseCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseCache.set(key, c);
  return c;
}

function NoiseNode({ amount, width, height }: { amount: number; width: number; height: number }) {
  const tile = noiseTile(); // cached module-level
  if (!tile) return null;
  return <Rect width={width} height={height} fillPatternImage={tile as unknown as HTMLImageElement} fillPatternRepeat="repeat" opacity={amount} globalCompositeOperation="overlay" listening={false} />;
}

const shadowProps = (s?: Shadow) =>
  s ? { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: s.opacity } : {};

/** Rotates around the element's center (the model stores top-left x/y). */
function Rotated({ el, children }: { el: SlideElement; children: ReactNode }) {
  if (!el.rotation) return <>{children}</>;
  return (
    <Group x={el.x + el.width / 2} y={el.y + el.height / 2} rotation={el.rotation} offsetX={el.x + el.width / 2} offsetY={el.y + el.height / 2}>
      {children}
    </Group>
  );
}

function ElementNode({ el }: { el: SlideElement }) {
  if (el.hidden) return null;
  return (
    <Rotated el={el}>
      <ElementBody el={el} />
    </Rotated>
  );
}

function ElementBody({ el }: { el: SlideElement }) {
  const fillOrNone = (f?: string) => (f && f !== 'transparent' ? f : undefined);
  switch (el.kind) {
    case 'text':
      return <RichText el={el} />;
    case 'rect':
      return <Rect x={el.x} y={el.y} width={el.width} height={el.height} opacity={el.opacity} fill={fillOrNone(el.fill)} stroke={el.stroke} strokeWidth={el.strokeWidth} cornerRadius={el.cornerRadius} dash={el.dash} {...shadowProps(el.shadow)} />;
    case 'ellipse':
      return <Ellipse x={el.x + el.width / 2} y={el.y + el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} opacity={el.opacity} fill={fillOrNone(el.fill)} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} {...shadowProps(el.shadow)} />;
    case 'line':
      return <Line x={el.x} y={el.y} points={el.points} opacity={el.opacity} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} lineCap="round" />;
    case 'path':
      return <PathNode el={el} />;
    case 'group':
      return (
        <Group x={el.x} y={el.y} opacity={el.opacity}>
          {(el as GroupElement).children.map((c) => (
            <ElementNode key={c.id} el={c} />
          ))}
        </Group>
      );
    case 'image':
      return null; // Phase 3: image elements (assets table)
  }
}

function PathNode({ el }: { el: PathElement }) {
  const sx = el.width / el.viewBox[0];
  const sy = el.height / el.viewBox[1];
  return (
    <Group x={el.x} y={el.y} opacity={el.opacity}>
      {el.data.map((d, i) => (
        <Path
          key={i}
          data={d}
          scaleX={sx}
          scaleY={sy}
          fill={el.fill}
          stroke={el.stroke}
          // strokeWidth is in output pixels; convert to path units so it scales with the stage zoom.
          strokeWidth={(el.strokeWidth ?? 0) / ((sx + sy) / 2)}
          lineCap="round"
          lineJoin="round"
        />
      ))}
    </Group>
  );
}

/** Draws text from layoutText() runs so emphasis (color/highlight/underline/box) works per word. */
function RichText({ el }: { el: TextElement }) {
  const text = applyCase(el.text, el.textCase);
  const layout = useMemo(
    () =>
      layoutText(
        text,
        { fontId: el.fontId, size: el.fontSize, weight: el.fontWeight, italic: el.italic, letterSpacing: el.letterSpacing },
        el.width,
        el.lineHeight,
        el.emphasis?.words,
        emphasisFont(el.fontId, el.emphasis),
      ),
    [text, el.fontId, el.fontSize, el.fontWeight, el.italic, el.letterSpacing, el.width, el.lineHeight, el.emphasis],
  );
  const offsetY = el.verticalAlign === 'middle' ? (el.height - layout.height) / 2 : el.verticalAlign === 'bottom' ? el.height - layout.height : 0;
  const family = cssFamily(el.fontId);
  const em = el.emphasis;
  const pad = el.fontSize * 0.08;
  return (
    <Group x={el.x} y={el.y + offsetY} opacity={el.opacity}>
      {layout.lines.map((line, li) => {
        const lx = el.align === 'center' ? (el.width - line.width) / 2 : el.align === 'right' ? el.width - line.width : 0;
        return (
          <Fragment key={li}>
            {line.runs.map((run, ri) => {
              const isEm = Boolean(run.emphasized && em);
              const weight = isEm && em!.style === 'bold' ? nearestWeight(el.fontId, 800) : el.fontWeight;
              const italic = el.italic || (isEm && em!.style === 'italic');
              const x = lx + run.x;
              const y = line.y;
              const fill = isEm && (em!.style === 'color' || em!.style === 'italic') ? em!.color : isEm && em!.style === 'box' ? em!.textColor ?? el.fill : el.fill;
              return (
                <Fragment key={ri}>
                  {isEm && em!.style === 'highlight' && (
                    <Rect x={x - pad} y={y + layout.lineHeightPx * 0.12} width={run.width + pad * 2} height={layout.lineHeightPx * 0.8} fill={em!.color} cornerRadius={pad} />
                  )}
                  {isEm && em!.style === 'box' && <Rect x={x - pad * 1.5} y={y + layout.lineHeightPx * 0.04} width={run.width + pad * 3} height={layout.lineHeightPx * 0.94} fill={em!.color} />}
                  {isEm && em!.style === 'underline' && (
                    <Rect x={x} y={y + layout.lineHeightPx * 0.84} width={run.width} height={Math.max(4, el.fontSize * 0.09)} fill={em!.color} />
                  )}
                  <Text
                    x={x}
                    y={y}
                    text={run.text}
                    fontFamily={family}
                    fontSize={el.fontSize}
                    fontStyle={`${italic ? 'italic ' : ''}${weight}`}
                    letterSpacing={el.letterSpacing}
                    lineHeight={el.lineHeight}
                    height={layout.lineHeightPx}
                    verticalAlign="middle"
                    fill={fill}
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
