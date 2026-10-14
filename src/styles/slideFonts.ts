// Which fonts and characters a set of slides draws, so callers can load exactly those fonts (including
// script fallbacks for Tamil, Arabic, …) before measuring or rendering.
import type { Slide, SlideElement } from '@/model/types';
import { ensureTextFonts } from './fontLoader';

function walk(els: SlideElement[], fonts: Set<string>, texts: string[]) {
  for (const e of els) {
    if (e.kind === 'text') {
      fonts.add(e.fontId);
      e.spans?.forEach((s) => s.fontId && fonts.add(s.fontId));
      texts.push(e.text);
    } else if (e.kind === 'chart') {
      fonts.add(e.fontId);
      texts.push(e.labels.join(' '), e.series.map((s) => s.name).join(' '));
    } else if (e.kind === 'table') {
      fonts.add(e.fontId);
      texts.push(e.rows.flat().join(' '));
    } else if (e.kind === 'group') walk(e.children, fonts, texts);
  }
}

/** Fonts used by text elements (incl. rich-text spans), recursively. */
export function slideFonts(slides: Slide[]): string[] {
  const fonts = new Set<string>();
  slides.forEach((s) => walk(s.elements, fonts, []));
  return [...fonts];
}

/** Loads every font and script subset the slides need. */
export function ensureSlideFonts(slides: Slide[]): Promise<void> {
  const fonts = new Set<string>();
  const texts: string[] = [];
  slides.forEach((s) => walk(s.elements, fonts, texts));
  return ensureTextFonts(fonts, texts);
}
