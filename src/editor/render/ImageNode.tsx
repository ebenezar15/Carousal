import { Group, Image as KImage, Rect, Text } from 'react-konva';
import type { ImageElement } from '@/model/types';
import { cssFamily } from '@/styles/fontLoader';
import { useImage } from './images';
import { useFilters } from './filters';
import { coverCrop, traceMask } from './shapes';

/** Image in element-local coords with cover/contain fit, crop (zoom + focal point), mask and filters. */
export function ImageNode({ el }: { el: ImageElement }) {
  const img = useImage(el.src || undefined);
  const ref = useFilters(el.filters, img, el.width, el.height);
  const w = el.width;
  const h = el.height;
  const needsClip = (el.mask && el.mask !== 'none') || (el.cornerRadius ?? 0) > 0;
  const clip = needsClip ? (ctx: Parameters<typeof traceMask>[0]) => traceMask(ctx, el.mask ?? 'none', w, h, el.cornerRadius ?? 0) : undefined;

  let body;
  if (!img) {
    // Placeholder (empty src, loading, or AI-image prompt): tinted box with the prompt text.
    body = (
      <>
        <Rect width={w} height={h} fill="#E4E4E7" />
        <Rect width={w} height={h} stroke="#A1A1AA" strokeWidth={Math.max(2, w / 200)} dash={[w / 40, w / 60]} />
        <Text
          x={w * 0.08}
          y={h * 0.08}
          width={w * 0.84}
          height={h * 0.84}
          align="center"
          verticalAlign="middle"
          text={el.prompt ? `🖼  ${el.prompt}` : el.src ? 'Loading image…' : 'Image'}
          fontFamily={cssFamily('inter')}
          fontSize={Math.max(14, Math.min(w, h) / 14)}
          fill="#52525B"
        />
      </>
    );
  } else if (el.fit === 'contain') {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    body = <KImage ref={ref} image={img} x={(w - dw) / 2} y={(h - dh) / 2} width={dw} height={dh} />;
  } else if (el.fit === 'fill') {
    body = <KImage ref={ref} image={img} width={w} height={h} />;
  } else {
    body = <KImage ref={ref} image={img} width={w} height={h} crop={coverCrop(img.naturalWidth, img.naturalHeight, w, h, el.crop)} />;
  }
  return (
    <Group>
      <Group clipFunc={clip as never}>{body}</Group>
      {el.stroke && el.strokeWidth ? (
        <Group>
          <RectOrMask el={el} />
        </Group>
      ) : null}
    </Group>
  );
}

function RectOrMask({ el }: { el: ImageElement }) {
  // Border follows the mask outline.
  return (
    <Rect
      width={el.width}
      height={el.height}
      sceneFunc={(ctx, shape) => {
        traceMask(ctx as never, el.mask ?? 'none', el.width, el.height, el.cornerRadius ?? 0);
        ctx.strokeShape(shape);
      }}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
    />
  );
}
