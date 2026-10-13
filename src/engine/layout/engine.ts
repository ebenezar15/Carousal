// The layout engine: plan + design (style, palette, fonts, modifiers) + platform preset → scene graph.
import { newId } from '@/model/id';
import type { Carousel, CarouselTheme, Slide } from '@/model/types';
import type { CarouselPlan, SlidePlan } from '../schema';
import { buildBackground } from './backgrounds';
import { chrome } from './chrome';
import { makeCtx, type Ctx } from './context';
import { decorate } from './decorations';
import { LAYOUTS, ROLE_LAYOUTS, type LayoutResult } from './layouts';

export interface BuildInput {
  plan: CarouselPlan;
  presetId: string;
  theme: CarouselTheme;
}

/** Picks the layout for each slide: explicit override → style's role layout, avoiding long runs of the same layout. */
export function chooseLayouts(ctx: Ctx, overrides: Record<number, string> = {}): string[] {
  const chosen: string[] = [];
  ctx.plan.slides.forEach((s, i) => {
    const override = overrides[i];
    if (override && LAYOUTS[override]) {
      chosen.push(override);
      return;
    }
    let id = ctx.style.roleLayouts[s.role] ?? 'body-top-left';
    // design-patterns: maxConsecutiveSameLayout = 3 → switch to the next layout for this role.
    if (chosen.length >= 3 && chosen.slice(-3).every((x) => x === id)) {
      const alts = ROLE_LAYOUTS[s.role].filter((x) => x !== id);
      id = alts[(i + 1) % alts.length] ?? id;
    }
    chosen.push(LAYOUTS[id] ? id : 'body-top-left');
  });
  return chosen;
}

/** How far (px) a layout's text spills outside the safe box; 0 = fits. */
function spill(ctx: Ctx, r: LayoutResult): number {
  const { box } = ctx;
  let out = 0;
  for (const e of r.elements) {
    if (e.kind !== 'text') continue;
    out += Math.max(0, box.y - e.y - 2) + Math.max(0, e.y + e.height - (box.y + box.h) - 2);
  }
  return out + (r.overflow ? 1 : 0);
}

function runLayout(ctx: Ctx, s: SlidePlan, index: number, id: string): LayoutResult | null {
  try {
    return LAYOUTS[id]!(ctx, s, index);
  } catch (e) {
    console.warn(`Layout ${id} failed`, e);
    return null;
  }
}

/**
 * Lays out a slide with the requested layout; if its text doesn't fit the safe box (dense content on a
 * short canvas), tries the role's other layouts and keeps the first that fits — or the least-bad one.
 */
export function buildSlide(ctx: Ctx, s: SlidePlan, index: number, requested: string): Slide {
  const candidates = [requested, ...ROLE_LAYOUTS[s.role].filter((x) => x !== requested), 'body-top-left'];
  let best: { id: string; r: LayoutResult; spill: number } | null = null;
  for (const id of candidates) {
    const r = runLayout(ctx, s, index, id);
    if (!r) continue;
    const sp = spill(ctx, r);
    if (!best || sp < best.spill) best = { id, r, spill: sp };
    if (sp === 0) break;
  }
  const layoutId = best!.id;
  const result = best!.r;
  const deco = decorate(ctx, s, index, result.elements, layoutId);
  return {
    id: newId('sl_'),
    role: s.role,
    layoutId,
    background: buildBackground(ctx, index),
    elements: [...deco.back, ...result.elements, ...deco.front, ...chrome(ctx, index)],
    notes: best!.spill > 0 ? 'Text exceeds the safe area at the minimum readable size — shorten it.' : undefined,
  };
}

export function buildCarousel(input: BuildInput): Carousel {
  const ctx = makeCtx(input.plan, input.presetId, input.theme);
  const layouts = chooseLayouts(ctx, input.theme.layoutOverrides);
  return {
    id: newId('car_'),
    presetId: input.presetId,
    theme: input.theme,
    slides: input.plan.slides.map((s, i) => buildSlide(ctx, s, i, layouts[i]!)),
  };
}

/** Rebuilds a single slide (e.g. after "new layout" or rewriting its copy) with the carousel's design. */
export function rebuildSlide(plan: CarouselPlan, presetId: string, theme: CarouselTheme, index: number): Slide {
  const ctx = makeCtx(plan, presetId, theme);
  const layouts = chooseLayouts(ctx, theme.layoutOverrides);
  return buildSlide(ctx, plan.slides[index]!, index, layouts[index]!);
}
