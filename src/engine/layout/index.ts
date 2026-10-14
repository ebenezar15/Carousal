import { findFont, getStyle } from '@/styles';
import { ensureTextFonts } from '@/styles/fontLoader';
import { loadIcons } from '@/styles/icons';
import type { Carousel, CarouselTheme } from '@/model/types';
import { buildCarousel, rebuildSlide, chooseLayouts, type BuildInput } from './engine';

export { buildCarousel, rebuildSlide, chooseLayouts, type BuildInput };
export { LAYOUTS, ROLE_LAYOUTS } from './layouts';

/** Default theme for a style: its first palette and primary font pairing. */
export function themeFor(styleId: string, paletteId?: string, fonts?: { heading: string; body: string }): CarouselTheme {
  const style = getStyle(styleId);
  return {
    styleId,
    paletteId: paletteId ?? style.palettes[0]!,
    headingFont: fonts?.heading ?? style.fonts.heading,
    bodyFont: fonts?.body ?? style.fonts.body,
  };
}

/** Fonts that must be loaded before measuring/rendering a theme. */
export function themeFonts(theme: CarouselTheme): string[] {
  const accent = getStyle(theme.styleId).fonts.accent;
  return [theme.headingFont, theme.bodyFont, ...(accent && findFont(accent) ? [accent] : [])];
}

/**
 * Loads fonts and icons the layout measures/uses, then lays out. Always use this in the app: measuring
 * before the webfonts load would size text with the fallback font and cause overflow/overlap.
 */
export async function layoutCarousel(input: BuildInput): Promise<Carousel> {
  // The plan's text decides which script subsets (Tamil, Cyrillic, …) must be loaded before measuring.
  await Promise.all([ensureTextFonts(themeFonts(input.theme), [JSON.stringify(input.plan), input.theme.handle ?? '']), loadIcons()]);
  return buildCarousel(input);
}
