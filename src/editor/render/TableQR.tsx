import { Fragment, useMemo } from 'react';
import { Group, Rect, Shape, Text } from 'react-konva';
import qrcode from 'qrcode-generator';
import type { QRElement, TableElement } from '@/model/types';
import { fontStack } from '@/styles/fontLoader';
import { layoutText } from '@/engine/layout/textLayout';

/** Row heights from wrapped cell text; shared with the editor to size the element. */
export function tableMetrics(el: TableElement) {
  const cols = Math.max(1, ...el.rows.map((r) => r.length));
  const colW = el.width / cols;
  const pad = el.fontSize * 0.55;
  const heights = el.rows.map((row, ri) =>
    Math.max(
      el.fontSize * 1.35 + pad * 2,
      ...row.map((cell) => layoutText(cell, { fontId: el.fontId, size: el.fontSize, weight: el.header && ri === 0 ? 700 : 400, italic: false, letterSpacing: 0 }, colW - pad * 2, 1.3).height + pad * 2),
    ),
  );
  return { cols, colW, pad, heights, total: heights.reduce((a, b) => a + b, 0) };
}

export function TableNode({ el }: { el: TableElement }) {
  const m = useMemo(() => tableMetrics(el), [el]);
  const tops = m.heights.map((_, i) => m.heights.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <Group>
      {el.rows.map((row, ri) => {
        const h = m.heights[ri]!;
        const y = tops[ri]!;
        const isHead = el.header && ri === 0;
        const node = (
          <Fragment key={ri}>
            <Rect y={y} width={el.width} height={h} fill={isHead ? el.headerFill : el.stripeFill && ri % 2 === 0 ? el.stripeFill : 'transparent'} />
            {Array.from({ length: m.cols }).map((_, ci) => (
              <Text
                key={ci}
                x={ci * m.colW + m.pad}
                y={y + m.pad}
                width={m.colW - m.pad * 2}
                height={h - m.pad * 2}
                verticalAlign="middle"
                align={el.align}
                text={row[ci] ?? ''}
                fontFamily={fontStack(el.fontId)}
                fontSize={el.fontSize}
                fontStyle={isHead ? '700' : '400'}
                lineHeight={1.3}
                fill={isHead ? el.headerTextColor : el.textColor}
              />
            ))}
            <Rect y={y + h - 1} width={el.width} height={Math.max(1, el.fontSize / 18)} fill={el.borderColor} />
          </Fragment>
        );
        return node;
      })}
    </Group>
  );
}

export function qrMatrix(data: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(data || ' ');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export function QRNode({ el }: { el: QRElement }) {
  const matrix = useMemo(() => qrMatrix(el.data), [el.data]);
  const size = Math.min(el.width, el.height);
  const quiet = 2;
  const cell = size / (matrix.length + quiet * 2);
  return (
    <Group>
      <Rect width={size} height={size} fill={el.bg} />
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          matrix.forEach((row, r) => row.forEach((dark, c) => dark && ctx.rect((c + quiet) * cell, (r + quiet) * cell, cell + 0.4, cell + 0.4)));
          ctx.fillShape(shape);
        }}
        fill={el.fg}
      />
    </Group>
  );
}
