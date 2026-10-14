import type { ReactNode } from 'react';
import { Group, Image as KImage, Rect, Shape } from 'react-konva';
import type { Background, BackgroundPattern } from '@/model/types';
import { hexToRgb } from '@/styles/color';
import { coverCrop } from './shapes';
import { useImage } from './images';
import { useFilters } from './filters';

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Backgrounds are drawn on a canvas `count` slides wide and offset, so panoramic spans line up at seams. */
export function BackgroundNode({ bg, width, height }: { bg: Background; width: number; height: number }) {
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
  } else if (bg.type === 'mesh') {
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
  } else {
    fill = <ImageBackground bg={bg} width={W} height={height} />;
  }
  return (
    <Group x={offset}>
      {fill}
      {bg.pattern && <PatternNode pattern={bg.pattern} width={W} height={height} />}
      {bg.noise ? <NoiseNode amount={bg.noise} width={W} height={height} /> : null}
    </Group>
  );
}

function ImageBackground({ bg, width, height }: { bg: Extract<Background, { type: 'image' }>; width: number; height: number }) {
  const img = useImage(bg.src);
  const ref = useFilters(bg.filters, img, width, height);
  return (
    <>
      <Rect width={width} height={height} fill={bg.color} />
      {img && <KImage ref={ref} image={img} width={width} height={height} crop={coverCrop(img.naturalWidth, img.naturalHeight, width, height)} />}
      {bg.overlay && <Rect width={width} height={height} fill={bg.overlay.color} opacity={bg.overlay.opacity} />}
    </>
  );
}

export function PatternNode({ pattern: p, width, height }: { pattern: BackgroundPattern; width: number; height: number }) {
  return (
    <Shape
      opacity={p.opacity}
      listening={false}
      sceneFunc={(c) => {
        const ctx = c._context;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        const s = p.size;
        ctx.lineWidth = Math.max(1, s / 28);
        if (p.kind === 'dots' || p.kind === 'halftone') {
          for (let y = s / 2, row = 0; y < height; y += s, row++) {
            for (let x = p.kind === 'halftone' && row % 2 ? s : s / 2; x < width; x += s) {
              const r = p.kind === 'halftone' ? s * 0.32 * (0.35 + 0.65 * (y / height)) : Math.max(1.5, s / 14);
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
          if (p.kind === 'grid')
            for (let x = s; x < width; x += s) {
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
    />
  );
}

let noiseTileCanvas: HTMLCanvasElement | null | undefined;
/** Deterministic grain tile, repeated across the background. */
function noiseTile(): HTMLCanvasElement | null {
  if (noiseTileCanvas !== undefined) return noiseTileCanvas;
  if (typeof document === 'undefined') return null;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return (noiseTileCanvas = null);
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (noiseTileCanvas = c);
}

function NoiseNode({ amount, width, height }: { amount: number; width: number; height: number }) {
  const tile = noiseTile();
  if (!tile) return null;
  return <Rect width={width} height={height} fillPatternImage={tile as unknown as HTMLImageElement} fillPatternRepeat="repeat" opacity={amount} globalCompositeOperation="overlay" listening={false} />;
}
