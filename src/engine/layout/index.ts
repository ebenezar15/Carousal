import { getStyle } from '@/styles';
import { ensureFonts } from '@/styles/fontLoader';
import type { Carousel } from '@/model/types';
import { buildCarousel, type LayoutInput } from './basic';

export { buildCarousel, type LayoutInput };

/**
 * Loads the fonts the layout will measure with, then lays out. Always use this in the app: measuring
 * before the webfonts load would size text with the fallback font and cause overflow/overlap.
 */
export async function layoutCarousel(input: LayoutInput): Promise<Carousel> {
  const style = getStyle(input.styleId);
  const f = input.fonts ?? style.fonts;
  await ensureFonts([f.heading, f.body]);
  return buildCarousel(input);
}
