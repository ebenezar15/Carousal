import type { SlideElement, TextElement } from '@/model/types';
import { useDocument } from '@/app/store';
import { useEditor } from './store';
import { updateElements } from './ops';
import { CommonProps, ChartProps, ImageProps, LineProps, QRProps, ShapeProps, TableProps } from './panels/ElementProps';
import { TextProps, patchText } from './panels/TextProps';
import { SlideProps } from './panels/SlideProps';

/** Right-hand properties panel: the selection's properties, or the slide/background when nothing is selected. */
export function Inspector() {
  const carousel = useDocument((s) => s.carousel)!;
  const apply = useDocument((s) => s.apply);
  const { slideIndex, selection } = useEditor();
  const slide = carousel.slides[slideIndex]!;
  const selected = slide.elements.filter((e) => selection.includes(e.id));
  if (!selected.length) return <SlideProps />;
  const el = selected[0]!;
  const multi = selected.length > 1;
  const set = (patch: Partial<SlideElement>) => apply((d) => updateElements(d, slideIndex, selection, patch));
  const setText = (patch: Partial<TextElement>, refit = false) => apply((d) => updateElements(d, slideIndex, [el.id], (e) => patchText(e as TextElement, patch, refit)));
  return (
    <div data-testid="inspector">
      <CommonProps el={el} set={set} multi={multi} />
      {!multi && el.kind === 'text' && <TextProps el={el} set={setText} />}
      {!multi && (el.kind === 'rect' || el.kind === 'ellipse' || el.kind === 'path') && <ShapeProps el={el} set={set as never} />}
      {!multi && el.kind === 'line' && <LineProps el={el} set={set as never} />}
      {!multi && el.kind === 'image' && <ImageProps el={el} set={set as never} />}
      {!multi && el.kind === 'chart' && <ChartProps el={el} set={set as never} />}
      {!multi && el.kind === 'table' && <TableProps el={el} set={set as never} />}
      {!multi && el.kind === 'qr' && <QRProps el={el} set={set as never} />}
    </div>
  );
}
