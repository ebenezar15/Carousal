// Illustrated layouts: a scene, a character or a symbolic object that tells the slide's story, with the
// text beside it. What to draw comes from the slide's words (art/topics.ts); the art itself is generated
// (art/), so every carousel — and every "New designs" seed — gets fresh compositions.
import type { SlideElement, TextElement } from '@/model/types';
import { mix } from '@/styles/color';
import { artPalette, character, prop, randomCharacter, scene } from '../art';
import { artFor, FALLBACK_SCENES, type ArtChoice } from '../art/topics';
import type { SceneKind } from '../art/types';
import type { SlidePlan } from '../schema';
import { artToElement } from './artElements';
import type { Box, Ctx } from './context';
import { bodySpec, headSpec, type LayoutFn, type LayoutResult } from './layouts';
import { fitStack, rect, type TextSpec } from './primitives';

export type IllustrationDensity = 'none' | 'some' | 'rich' | 'story';

const density = (ctx: Ctx): IllustrationDensity =>
  (ctx.mod.illustrations as IllustrationDensity | undefined) ?? (ctx.style.layout.illustrations as IllustrationDensity | undefined) ?? 'none';

/** Per-carousel choices, computed once per layout context so scenes don't repeat across slides. */
const memo = new WeakMap<Ctx, (ArtChoice | null)[]>();

function choices(ctx: Ctx): (ArtChoice | null)[] {
  const hit = memo.get(ctx);
  if (hit) return hit;
  const d = density(ctx);
  const used: SceneKind[] = [];
  let sinceLast = 9;
  const seed = ctx.seed;
  const out = ctx.plan.slides.map((s, i): ArtChoice | null => {
    if (d === 'none' || s.role === 'stat' || s.role === 'comparison') return null;
    if (s.bullets.length > 3 && d !== 'story') return null; // lists read better as lists (or diagrams)
    let c = artFor(s, used);
    if (!c && (d === 'story' || (s.role === 'hook' && d !== 'some'))) {
      const fb = FALLBACK_SCENES.filter((k) => !used.includes(k));
      c = { kind: 'scene', scene: fb[(seed + i) % Math.max(1, fb.length)] ?? 'sunrise', why: 'story' };
    }
    // Story styles: every picture is a scene; a person acting something out stands in it.
    if (c && d === 'story' && c.kind !== 'scene') {
      const fb = FALLBACK_SCENES.filter((k) => !used.includes(k));
      c = { kind: 'scene', scene: fb[(seed + i) % Math.max(1, fb.length)] ?? 'road', pose: c.kind === 'character' ? c.pose : 'stand', people: 1, why: c.why };
    }
    if (!c) return null;
    // 'some': covers, quotes and the closing slide, plus an occasional middle slide; never back to back.
    if (d === 'some' && !['hook', 'cta', 'quote'].includes(s.role) && (sinceLast < 2 || (seed + i) % 3 !== 0)) {
      sinceLast++;
      return null;
    }
    sinceLast = 0;
    if (c.kind === 'scene') used.push(c.scene);
    return c;
  });
  memo.set(ctx, out);
  return out;
}

export function illustratedFor(s: SlidePlan, ctx: Ctx, index: number): string | null {
  const c = choices(ctx)[index];
  if (!c) return null;
  if (density(ctx) === 'story' && c.kind === 'scene' && s.role !== 'hook') return 'illus-panel';
  return c.kind === 'scene' ? 'illus-scene' : c.kind === 'character' ? 'illus-character' : 'illus-prop';
}

/** Headline + body (or a scripture/quote with its reference) stacked into `region`. */
function textBlock(ctx: Ctx, s: SlidePlan, region: Box, align: TextElement['align'], valign: 'top' | 'middle' | 'bottom', big = false): LayoutResult {
  const specs: TextSpec[] = [];
  if (s.quote?.text) {
    specs.push({ ...headSpec(ctx, s, `“${s.quote.text}”`, Math.round(ctx.sizes.head * 0.82)), slot: 'quote-text', emphasis: undefined });
    if (s.quote.attribution) specs.push(bodySpec(ctx, s.quote.attribution, 'attribution', { color: ctx.pal.mutedText, max: Math.round(ctx.sizes.body * 0.9) }));
  } else {
    if (s.headline) specs.push(headSpec(ctx, s, s.headline, big ? ctx.sizes.hook : ctx.sizes.head));
    if (s.body) specs.push(bodySpec(ctx, s.body, s.role === 'hook' ? 'subline' : 'body'));
    if (s.bullets.length) specs.push(bodySpec(ctx, s.bullets.map((b) => `• ${b}`).join('\n'), 'bullets'));
  }
  const r = fitStack(specs, region, valign, align);
  return { elements: r.elements, overflow: r.overflow };
}

const seedOf = (ctx: Ctx, i: number) => ctx.seed * 31 + i * 7919;

/** Scene across the bottom (portrait/square) or the right half (landscape), text in the rest. */
const illusScene: LayoutFn = (ctx, s, i) => {
  const c = choices(ctx)[i];
  const { W, H, box, k } = ctx;
  const ap = artPalette(ctx.pal);
  const kind: SceneKind = c?.kind === 'scene' ? c.scene : 'sunrise';
  const people = c?.kind === 'scene' && c.pose ? [randomCharacter(seedOf(ctx, i), ap, c.pose)] : undefined;
  const art = scene(kind, ap, seedOf(ctx, i), { people });
  if (ctx.isLandscape) {
    const artX = Math.round(W * 0.5);
    const el = artToElement(art, artX, 0, W - artX, H, 'illustration', `Scene: ${kind}`, 'cover');
    const t = textBlock(ctx, s, { x: box.x, y: box.y, w: artX - box.x - Math.round(48 * k), h: box.h }, 'left', 'middle', s.role === 'hook');
    return { elements: [el, ...t.elements], overflow: t.overflow };
  }
  const bandH = Math.round(H * (s.role === 'hook' ? 0.46 : 0.42));
  const el = artToElement(art, 0, H - bandH, W, bandH, 'illustration', `Scene: ${kind}`, 'cover');
  const textH = H - bandH - box.y - Math.round(32 * k);
  const t = textBlock(ctx, s, { x: box.x, y: box.y, w: box.w, h: textH }, ctx.align === 'right' ? 'left' : ctx.align, s.role === 'hook' ? 'middle' : 'top', s.role === 'hook');
  return { elements: [el, ...t.elements], overflow: t.overflow };
};

/** A character acting out the slide (praying, reading, worshipping…) beside the text. */
const illusCharacter: LayoutFn = (ctx, s, i) => {
  const c = choices(ctx)[i];
  const { box, k } = ctx;
  const ap = artPalette(ctx.pal);
  const pose = c?.kind === 'character' ? c.pose : 'stand';
  const spec = randomCharacter(seedOf(ctx, i), ap, pose);
  const els: SlideElement[] = [];
  const side = ctx.isLandscape || box.w > box.h * 0.95;
  // Soft disc behind the figure so it reads on any background.
  const figH = Math.round(side ? box.h * 0.92 : box.h * 0.56);
  const figW = Math.round((figH * 200) / 320);
  // Portrait: centred under the text (alternating a little left/right between slides for rhythm).
  const fx = side ? box.x + box.w - figW : Math.round(box.x + box.w / 2 - figW / 2 + (i % 2 ? 1 : -1) * box.w * 0.12);
  const fy = box.y + box.h - figH;
  els.push({ ...rect('art-backdrop', fx - figW * 0.15, fy + figH * 0.18, figW * 1.3, figW * 1.3, mix(ctx.pal.primary, ctx.pal.bg, ctx.dark ? 0.8 : 0.86), { cornerRadius: figW }) });
  els.push(artToElement(character(spec), fx, fy, figW, figH, 'illustration', `Character: ${pose}`));
  if (c?.kind === 'character' && c.prop) {
    const ps = Math.round(figW * 0.42);
    // Beside the figure, on the side away from the text when the text is beside it.
    const px = side ? Math.min(box.x + box.w - ps, fx + figW - ps * 0.4) : i % 2 ? fx - ps * 0.9 : fx + figW - ps * 0.1;
    els.push(artToElement(prop(c.prop, ap, seedOf(ctx, i)), px, fy + figH - ps, ps, ps, 'illustration', `Prop: ${c.prop}`));
  }
  const region = side
    ? { x: box.x, y: box.y, w: fx - figW * 0.15 - box.x - Math.round(40 * k), h: box.h }
    : { x: box.x, y: box.y, w: box.w, h: fy - box.y - Math.round(24 * k) };
  const t = textBlock(ctx, s, region, side ? 'left' : ctx.align === 'center' ? 'center' : 'left', side ? 'middle' : 'top');
  return { elements: [...els, ...t.elements], overflow: t.overflow };
};

/** A symbolic object above the text (a dove for the Spirit, a lamp for the Word…). */
const illusProp: LayoutFn = (ctx, s, i) => {
  const c = choices(ctx)[i];
  const { box, k } = ctx;
  const ap = artPalette(ctx.pal);
  const kind = c?.kind === 'prop' ? c.prop : 'star';
  const size = Math.round(Math.min(box.w * 0.42, box.h * 0.32));
  const center = ctx.align === 'center';
  const x = center ? box.x + box.w / 2 - size / 2 : box.x;
  const disc = rect('art-backdrop', x, box.y, size, size, mix(ctx.pal.primary, ctx.pal.bg, ctx.dark ? 0.78 : 0.85), { cornerRadius: size / 2 });
  const art = artToElement(prop(kind, ap, seedOf(ctx, i)), x + size * 0.14, box.y + size * 0.14, size * 0.72, size * 0.72, 'illustration', `Prop: ${kind}`);
  const top = box.y + size + Math.round(40 * k);
  const t = textBlock(ctx, s, { x: box.x, y: top, w: box.w, h: box.y + box.h - top }, center ? 'center' : 'left', 'top');
  return { elements: [disc, art, ...t.elements], overflow: t.overflow };
};

/** Story style: the scene framed like a comic/storybook panel with a caption box underneath. */
const illusPanel: LayoutFn = (ctx, s, i) => {
  const c = choices(ctx)[i];
  const { box, k, pal } = ctx;
  const ap = artPalette(pal);
  const kind: SceneKind = c?.kind === 'scene' ? c.scene : 'road';
  const people = c?.kind === 'scene' && c.pose ? [randomCharacter(seedOf(ctx, i), ap, c.pose)] : [randomCharacter(seedOf(ctx, i), ap, 'walk')];
  const panelW = box.w;
  const panelH = Math.round(Math.min(box.h * 0.6, panelW * 0.6));
  const stroke = Math.max(3, Math.round(6 * k));
  const frame = rect('panel-frame', box.x, box.y, panelW, panelH, ap.softer, { stroke: pal.text, strokeWidth: stroke, cornerRadius: Math.round(14 * k) });
  const art = artToElement(scene(kind, ap, seedOf(ctx, i), { people }), box.x + stroke, box.y + stroke, panelW - 2 * stroke, panelH - 2 * stroke, 'illustration', `Scene: ${kind}`);
  const capTop = box.y + panelH + Math.round(28 * k);
  const cap = rect('panel-caption', box.x, capTop, panelW, box.y + box.h - capTop, pal.surface, { stroke: pal.text, strokeWidth: stroke, cornerRadius: Math.round(14 * k) });
  const pad = Math.round(36 * k);
  const t = textBlock(ctx, s, { x: box.x + pad, y: capTop + pad, w: panelW - 2 * pad, h: box.y + box.h - capTop - 2 * pad }, 'left', 'top');
  return { elements: [frame, art, cap, ...t.elements], overflow: t.overflow };
};

export const ILLUSTRATED_LAYOUTS: Record<string, LayoutFn> = {
  'illus-scene': illusScene,
  'illus-character': illusCharacter,
  'illus-prop': illusProp,
  'illus-panel': illusPanel,
};
