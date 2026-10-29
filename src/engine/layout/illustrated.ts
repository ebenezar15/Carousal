// Illustrated layouts: a scene or character that tells the slide's story, with the text beside it.
import type { LayoutFn } from './layouts';
import type { SlidePlan } from '../schema';
import type { Ctx } from './context';

export const ILLUSTRATED_LAYOUTS: Record<string, LayoutFn> = {};

/** The illustrated layout id for a slide, or null. */
export function illustratedFor(_s: SlidePlan, _ctx: Ctx, _index: number): string | null {
  return null;
}
