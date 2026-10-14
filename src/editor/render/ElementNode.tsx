import { Ellipse, Group, Line, Path, Rect } from 'react-konva';
import type { GroupElement, PathElement, Shadow, SlideElement } from '@/model/types';
import { RichText } from './RichText';
import { ImageNode } from './ImageNode';
import { ChartNode } from './Chart';
import { QRNode, TableNode } from './TableQR';

export const shadowProps = (s?: Shadow) =>
  s ? { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: s.opacity } : {};

const fillOrNone = (f?: string) => (f && f !== 'transparent' ? f : undefined);

/**
 * Every element is a Group placed at its center with offset = half size, so rotation pivots on the
 * center and the editor's Transformer maps 1:1 to the model (x/y = top-left, rotation in degrees).
 * The element body draws in local coordinates (0,0)–(width,height). The group's `name` is the element id.
 */
export function ElementNode({ el, interactive }: { el: SlideElement; interactive?: boolean }) {
  if (el.hidden) return null;
  return (
    <Group
      id={el.id}
      name={interactive ? 'element' : undefined}
      x={el.x + el.width / 2}
      y={el.y + el.height / 2}
      offsetX={el.width / 2}
      offsetY={el.height / 2}
      rotation={el.rotation}
      opacity={el.opacity}
      listening={interactive ?? false}
      draggable={interactive && !el.locked}
    >
      {interactive && <Rect width={el.width} height={el.height} fill="transparent" name="hit" />}
      <ElementBody el={el} interactive={interactive} />
    </Group>
  );
}

function ElementBody({ el, interactive }: { el: SlideElement; interactive?: boolean }) {
  switch (el.kind) {
    case 'text':
      return <RichText el={el} />;
    case 'rect':
      return <Rect width={el.width} height={el.height} fill={fillOrNone(el.fill)} stroke={el.stroke} strokeWidth={el.strokeWidth} cornerRadius={el.cornerRadius} dash={el.dash} {...shadowProps(el.shadow)} />;
    case 'ellipse':
      return <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} fill={fillOrNone(el.fill)} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} {...shadowProps(el.shadow)} />;
    case 'line':
      return <LineNode el={el} />;
    case 'path':
      return <PathNode el={el} />;
    case 'image':
      return <ImageNode el={el} />;
    case 'chart':
      return <ChartNode el={el} />;
    case 'table':
      return <TableNode el={el} />;
    case 'qr':
      return <QRNode el={el} />;
    case 'group':
      return (
        <>
          {(el as GroupElement).children.map((c) => (
            <ElementNode key={c.id} el={c} interactive={false} />
          ))}
        </>
      );
  }
  void interactive;
  return null;
}

function LineNode({ el }: { el: Extract<SlideElement, { kind: 'line' }> }) {
  const n = el.points.length;
  const head = el.arrowEnd && n >= 4;
  const size = Math.max(10, el.strokeWidth * 3.2);
  let arrow = null;
  if (head) {
    const [x1, y1, x2, y2] = el.points.slice(n - 4) as [number, number, number, number];
    const a = Math.atan2(y2 - y1, x2 - x1);
    arrow = (
      <Line
        points={[x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45), x2, y2, x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45)]}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        lineCap="round"
        lineJoin="round"
      />
    );
  }
  return (
    <>
      <Line points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(20, el.strokeWidth)} />
      {arrow}
    </>
  );
}

function PathNode({ el }: { el: PathElement }) {
  const sx = el.width / el.viewBox[0];
  const sy = el.height / el.viewBox[1];
  return (
    <>
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
    </>
  );
}
