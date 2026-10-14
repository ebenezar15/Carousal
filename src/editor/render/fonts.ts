// React glue for slide font loading (the helpers live in styles/slideFonts.ts).
import { useEffect } from 'react';
import type { Slide } from '@/model/types';
import { ensureSlideFonts } from '@/styles/slideFonts';

export { ensureSlideFonts, slideFonts } from '@/styles/slideFonts';

/** Loads the slides' fonts on mount/change; RichText re-measures when they arrive (useFontsVersion). */
export function useSlideFonts(slides: Slide[] | undefined): void {
  useEffect(() => {
    if (slides?.length) void ensureSlideFonts(slides);
  }, [slides]);
}
