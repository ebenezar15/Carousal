// Brand kits → theme: brand colors become a contrast-checked palette, fonts/handle/watermark carried over.
import type { CarouselTheme } from '@/model/types';
import type { PaletteColors } from '@/styles';
import { contrast, mix } from '@/styles/color';
import type { BrandKit } from '@/storage/db';

/** Maps brand colors onto palette roles, nudging derived colors until text stays readable. */
export function paletteFromBrand(c: BrandKit['colors']): PaletteColors {
  let text = c.text;
  if (contrast(text, c.background) < 4.5) text = contrast('#111111', c.background) > contrast('#FFFFFF', c.background) ? '#111111' : '#FFFFFF';
  let muted = mix(text, c.background, 0.3);
  for (let t = 0.3; t > 0 && contrast(muted, c.background) < 4.5; t -= 0.05) muted = mix(text, c.background, t);
  const surface = mix(c.background, text, 0.05);
  let primary = c.primary;
  if (contrast(primary, c.background) < 3) primary = mix(primary, text, 0.4);
  return { bg: c.background, surface, text, mutedText: contrast(muted, c.background) >= 4.5 ? muted : text, primary, accent: c.accent, highlight: mix(c.primary, c.background, 0.72) };
}

export function applyBrandKit(theme: CarouselTheme, kit: BrandKit): CarouselTheme {
  return {
    ...theme,
    brandKitId: kit.id,
    customPalette: paletteFromBrand(kit.colors),
    headingFont: kit.headingFont,
    bodyFont: kit.bodyFont,
    handle: kit.handle,
    watermark: kit.watermark ? { text: kit.handle, logoSrc: kit.logoSrc, position: kit.watermarkPosition, opacity: 0.85 } : undefined,
    label: `${theme.label?.split(' · ')[0] ?? 'Brand'} · ${kit.name}`,
  };
}

export function removeBrandKit(theme: CarouselTheme): CarouselTheme {
  const { customPalette: _p, brandKitId: _b, watermark: _w, ...rest } = theme;
  void _p;
  void _b;
  void _w;
  return rest;
}
