// Picks built-in templates for a carousel: ones made for the chosen carousel type first, faith
// templates for Christian content, then greedily for variety (different styles, light and dark).
import type { CarouselTheme } from '@/model/types';
import { FAITH_CATEGORIES, TEMPLATES, getTemplate, themeFromTemplate, type CarouselTemplate } from '@/styles/templates';
import { getPalette } from '@/styles';
import { getCarouselType } from './carouselTypes';
import type { CarouselPlan } from './schema';
import { isFaithContent, remix, rng, type Variation } from './variations';

export interface TemplatePickOptions {
  count: number;
  seed?: number;
  /** Carousel type id (engine/carouselTypes.ts); 'auto'/undefined = none. */
  typeId?: string;
  /** A template the user chose: it comes first. */
  templateId?: string;
  handle?: string;
  series?: string;
  /** Recently shown style ids (step back so designs keep changing). */
  recent?: string[];
}

function score(t: CarouselTemplate, plan: CarouselPlan, faith: boolean, o: TemplatePickOptions, jitter: number): number {
  let s = jitter;
  if (o.typeId && t.types.includes(o.typeId)) s += 4 - t.types.indexOf(o.typeId) * 0.4;
  const isFaith = FAITH_CATEGORIES.includes(t.category);
  if (faith) s += isFaith ? 2 : -1.5;
  else s += isFaith ? -2 : 0.5;
  if (t.category === 'tech' && !plan.slides.some((x) => x.role === 'stat')) s -= 0.5;
  s -= (o.recent ?? []).slice(0, 12).filter((r) => r === t.styleId).length * 0.8;
  return s;
}

/** Applies a carousel type's picture wishes to a template theme (a story type wants pictures). */
function withType(theme: CarouselTheme, typeId?: string): CarouselTheme {
  const type = getCarouselType(typeId);
  if (!type?.illustrations || theme.modifiers?.illustrations) return theme;
  if (type.illustrations === 'story' || type.illustrations === 'rich') return { ...theme, modifiers: { ...theme.modifiers, illustrations: type.illustrations } };
  return theme;
}

export function templateVariations(plan: CarouselPlan, o: TemplatePickOptions): Variation[] {
  const rand = rng((o.seed ?? 0) * 104729 + 31);
  const faith = isFaithContent(plan) || Boolean(getCarouselType(o.typeId) && ['faith', 'story'].includes(getCarouselType(o.typeId)!.group));
  const scored = TEMPLATES.map((t) => ({ t, s: score(t, plan, faith, o, rand() * 2.2) })).sort((a, b) => b.s - a.s);
  const picked: CarouselTemplate[] = [];
  const first = getTemplate(o.templateId);
  if (first) picked.push(first);
  const n = Math.max(1, Math.min(6, o.count));
  for (const { t } of scored) {
    if (picked.length >= n) break;
    if (picked.some((p) => p.styleId === t.styleId)) continue;
    // Keep a mix of light and dark grounds.
    const dark = getPalette(t.paletteId).scheme === 'dark';
    const darks = picked.filter((p) => getPalette(p.paletteId).scheme === 'dark').length;
    if (picked.length >= 2 && (dark ? darks > picked.length / 2 : darks === 0 && picked.length >= 3)) continue;
    picked.push(t);
  }
  // Not enough after the light/dark rule: fill with the best remaining distinct styles.
  for (const { t } of scored) {
    if (picked.length >= n) break;
    if (!picked.some((p) => p.styleId === t.styleId)) picked.push(t);
  }
  return picked.map((t, i) => {
    let theme = withType(themeFromTemplate(t, { handle: o.handle, ...(o.series ? { series: o.series } : {}) }), o.typeId);
    // "New designs" (seed > 0) remixes every pick except the one the user chose.
    if ((o.seed ?? 0) > 0 && !(i === 0 && first)) theme = { ...remix(theme, plan, rand, getPalette(t.paletteId).scheme === 'dark'), templateId: t.id };
    return { theme, label: theme.label ?? t.name };
  });
}
