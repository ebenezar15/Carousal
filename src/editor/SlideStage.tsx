// Static render of one Slide (thumbnails, previews, export). The interactive editor canvas uses the
// same ElementNode/BackgroundNode, so all of them are pixel-identical.
import { forwardRef } from 'react';
import { Group, Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Slide } from '@/model/types';
import { BackgroundNode } from './render/Background';
import { ElementNode } from './render/ElementNode';

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
        <SlideContent slide={slide} width={width} height={height} />
      </Layer>
    </Stage>
  );
});

export function SlideContent({ slide, width, height, interactive }: { slide: Slide; width: number; height: number; interactive?: boolean }) {
  return (
    <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      <BackgroundNode bg={slide.background} width={width} height={height} />
      {slide.elements.map((el) => (
        <ElementNode key={el.id} el={el} interactive={interactive} />
      ))}
    </Group>
  );
}
