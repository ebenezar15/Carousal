// Renders one Slide scene graph with react-konva. Used for the editor canvas, thumbnails and export,
// so all three are pixel-identical. Coordinates in the model are in output pixels (e.g. 1080×1350);
// `displayWidth` only scales the stage.
import { forwardRef, Fragment, useMemo } from 'react';
import { Ellipse, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { Background, GroupElement, Slide, SlideElement, TextElement } from '@/model/types';
import { cssFamily } from '@/styles/fontLoader';
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
        <BackgroundRect bg={slide.background} width={width} height={height} />
        {slide.elements.map((el) => (
          <ElementNode key={el.id} el={el} />
        ))}
      </Layer>
    </Stage>
  );
});

function BackgroundRect({ bg, width, height }: { bg: Background; width: number; height: number }) {
  if (bg.type === 'solid') return <Rect width={width} height={height} fill={bg.color} />;
  const stops = bg.stops.flatMap((s) => [s.offset, s.color]);
  if (bg.type === 'linear') {
    // Angle in degrees, CSS-like (0 = bottom→top, 90 = left→right); endpoints span the diagonal.
    const rad = ((bg.angle - 90) * Math.PI) / 180;
    const half = (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) / 2;
    const cx = width / 2;
    const cy = height / 2;
    return (
      <Rect
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: cx - Math.cos(rad) * half, y: cy - Math.sin(rad) * half }}
        fillLinearGradientEndPoint={{ x: cx + Math.cos(rad) * half, y: cy + Math.sin(rad) * half }}
        fillLinearGradientColorStops={stops}
      />
    );
  }
  const center = { x: bg.cx * width, y: bg.cy * height };
  return (
    <Rect
      width={width}
      height={height}
      fillRadialGradientStartPoint={center}
      fillRadialGradientEndPoint={center}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={bg.radius * Math.max(width, height)}
      fillRadialGradientColorStops={stops}
    />
  );
}

function ElementNode({ el }: { el: SlideElement }) {
  if (el.hidden) return null;
  const common = { x: el.x, y: el.y, rotation: el.rotation, opacity: el.opacity };
  switch (el.kind) {
    case 'text':
      return <RichText el={el} />;
    case 'rect':
      return <Rect {...common} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} cornerRadius={el.cornerRadius} />;
    case 'ellipse':
      return <Ellipse {...common} x={el.x + el.width / 2} y={el.y + el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
    case 'line':
      return <Line {...common} points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} lineCap="round" />;
    case 'group':
      return (
        <Group {...common}>
          {(el as GroupElement).children.map((c) => (
            <ElementNode key={c.id} el={c} />
          ))}
        </Group>
      );
    case 'image':
      return null; // Phase 3: image elements (assets table)
  }
}

/** Draws text from layoutText() runs so emphasis (color/highlight/underline) works per word. */
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
    <Group x={el.x} y={el.y + offsetY} rotation={el.rotation} opacity={el.opacity}>
      {layout.lines.map((line, li) => {
        const lx = el.align === 'center' ? (el.width - line.width) / 2 : el.align === 'right' ? el.width - line.width : 0;
        return (
          <Fragment key={li}>
            {line.runs.map((run, ri) => {
              const isEm = run.emphasized && em;
              const weight = isEm && em.style === 'bold' ? nearestWeight(el.fontId, 800) : el.fontWeight;
              const italic = el.italic || Boolean(isEm && em.style === 'italic');
              const x = lx + run.x;
              const textY = line.y;
              return (
                <Fragment key={ri}>
                  {isEm && em.style === 'highlight' && (
                    <Rect x={x - pad} y={textY + layout.lineHeightPx * 0.12} width={run.width + pad * 2} height={layout.lineHeightPx * 0.8} fill={em.color} cornerRadius={pad} />
                  )}
                  {isEm && em.style === 'underline' && (
                    <Rect x={x} y={textY + layout.lineHeightPx * 0.82} width={run.width} height={Math.max(4, el.fontSize * 0.09)} fill={em.color} />
                  )}
                  <Text
                    x={x}
                    y={textY}
                    text={run.text}
                    fontFamily={family}
                    fontSize={el.fontSize}
                    fontStyle={`${italic ? 'italic ' : ''}${weight}`}
                    letterSpacing={el.letterSpacing}
                    lineHeight={el.lineHeight}
                    height={layout.lineHeightPx}
                    verticalAlign="middle"
                    fill={isEm && (em.style === 'color' || em.style === 'italic') ? em.color : el.fill}
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
