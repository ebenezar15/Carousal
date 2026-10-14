// ZIP of slide images and multi-page PDF (LinkedIn document carousels).
import { zipSync, strToU8 } from 'fflate';
import type { Slide, TextElement } from '@/model/types';
import { renderSlideToCanvas } from './render';
import { canvasToBlob, prepareSlides } from './images';

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const f of files) entries[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: /\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(f.name) ? 0 : 6 }];
  const zipped = zipSync(entries as never);
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export const textFile = (s: string) => new Blob([strToU8(s) as BlobPart], { type: 'text/plain' });

export interface PdfOptions {
  /** Page size in points = output pixels (1 px → 1 pt), so the PDF matches the preset exactly. */
  width: number;
  height: number;
  /** Image resolution multiplier inside the page. */
  scale: 1 | 2;
  /** JPEG keeps LinkedIn uploads small; PNG is lossless. */
  imageFormat: 'jpg' | 'png';
  quality: number;
  title: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  onProgress?: (done: number, total: number) => void;
}

const slideText = (s: Slide) => {
  const out: string[] = [];
  const walk = (els: Slide['elements']) => els.forEach((e) => (e.kind === 'text' ? out.push((e as TextElement).text) : e.kind === 'group' ? walk(e.children) : undefined));
  walk(s.elements);
  return out.join('\n');
};

export async function slidesToPdf(slides: Slide[], o: PdfOptions): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  await prepareSlides(slides);
  const pdf = await PDFDocument.create();
  pdf.setTitle(o.title);
  if (o.author) pdf.setAuthor(o.author);
  if (o.subject) pdf.setSubject(o.subject);
  if (o.keywords?.length) pdf.setKeywords(o.keywords);
  pdf.setCreator('CarouselForge');
  pdf.setProducer('CarouselForge (pdf-lib)');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [i, s] of slides.entries()) {
    const canvas = renderSlideToCanvas(s, o.width, o.height, o.scale);
    const blob = await canvasToBlob(canvas, o.imageFormat === 'jpg' ? 'image/jpeg' : 'image/png', o.quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = o.imageFormat === 'jpg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const page = pdf.addPage([o.width, o.height]);
    // Invisible text layer: keeps the document searchable/accessible; non-Latin text is skipped (standard font).
    const text = slideText(s);
    if (text) {
      try {
        page.drawText(text.slice(0, 2000), { x: 8, y: o.height - 24, size: 10, font, opacity: 0, lineHeight: 12, maxWidth: o.width - 16 });
      } catch {
        /* characters outside WinAnsi — image-only page */
      }
    }
    page.drawImage(img, { x: 0, y: 0, width: o.width, height: o.height });
    o.onProgress?.(i + 1, slides.length);
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Reads page sizes back from a generated PDF (verification). */
export async function pdfPageSizes(blob: Blob): Promise<{ width: number; height: number }[]> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  return doc.getPages().map((p) => p.getSize());
}
