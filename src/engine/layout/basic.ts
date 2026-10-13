// Phase 1 layout: turns a CarouselPlan + style system + platform preset into a plain-JSON scene graph.
// One flow layout per role family (stacked blocks, auto-fit to the safe content box). Phase 2 replaces
// this with the full layout catalog (split, giant-type, timeline, panoramic…), keeping the same output model.
import { getPalette, getPreset, getStyle, nearestWeight, patterns, type Palette, type StyleSystem } from '@/styles';
import { contrast, mix, pickReadable } from '@/styles/color';
import { newId } from '@/model/id';
import type { Background, Carousel, Slide, SlideElement, TextElement, TextEmphasis } from '@/model/types';
import type { CarouselPlan, SlidePlan } from '../schema';
import { applyCase, emphasisFont, layoutText } from './textLayout';

export interface LayoutInput {
  plan: CarouselPlan;
  presetId: string;
  styleId: string;
  paletteId?: string;
  fonts?: { heading: string; body: string };
}

interface Ctx {
  W: number;
  H: number;
  k: number; // scale vs. 1080-wide reference
  style: StyleSystem;
  pal: Palette['colors'];
  heading: string;
  body: string;
  box: { x: number; y: number; w: number; h: number };
  emphasis: Omit<TextEmphasis, 'words'>;
}

/** A text block before positioning: max/min sizes let the fitter shrink everything together. */
interface Block {
  slot: string;
  text: string;
  font: string;
  weight: number;
  italic: boolean;
  max: number;
  min: number;
  lineHeight: number;
  color: string;
  textCase: TextElement['textCase'];
  letterSpacing: number;
  emphasis?: TextEmphasis;
  gapAfter: number; // in units of the block's own font size
}

export function buildCarousel(input: LayoutInput): Carousel {
  const preset = getPreset(input.presetId);
  const style = getStyle(input.styleId);
  const paletteId = input.paletteId ?? style.palettes[0]!;
  const pal = getPalette(paletteId).colors;
  const W = preset.width;
  const H = preset.height;
  const k = W / 1080;
  const fonts = input.fonts ?? { heading: style.fonts.heading, body: style.fonts.body };

  const margin = Math.round((W * style.layout.marginPct) / 100);
  const sz = preset.safeZone;
  const chrome = Math.round(90 * k); // slide number / swipe cue strips (design-patterns chromeStripPx)
  const left = Math.max(margin, sz.left);
  const right = Math.max(margin, sz.right);
  const top = Math.max(margin, sz.top) + chrome;
  const bottom = Math.max(margin, sz.bottom) + chrome;
  const box = { x: left, y: top, w: W - left - right, h: H - top - bottom };

  const ctx: Ctx = { W, H, k, style, pal, heading: fonts.heading, body: fonts.body, box, emphasis: emphasisFor(style, pal) };
  const total = input.plan.slides.length;
  const slides = input.plan.slides.map((s, i) => buildSlide(ctx, s, i, total));
  return { id: newId('car_'), presetId: preset.id, theme: { styleId: style.id, paletteId, headingFont: fonts.heading, bodyFont: fonts.body }, slides };
}

function emphasisFor(style: StyleSystem, pal: Palette['colors']): Omit<TextEmphasis, 'words'> {
  const accentColor = pickReadable(pal.bg, [pal.primary, pal.accent, pal.text].filter((c) => c.toLowerCase() !== pal.text.toLowerCase()).concat(pal.text), 3);
  switch (style.layout.emphasis) {
    case 'highlight':
    case 'marker':
    case 'sticker':
    case 'box':
      return { style: 'highlight', color: contrast(pal.text, pal.highlight) >= 3 ? pal.highlight : mix(pal.primary, pal.bg, 0.6) };
    case 'underline-thick':
      return { style: 'underline', color: pal.primary };
    case 'italic':
      return { style: 'italic', color: accentColor };
    case 'bold':
      return { style: 'bold', color: pal.text };
    default:
      return { style: 'color', color: accentColor };
  }
}

function background(ctx: Ctx): Background {
  const { pal, style } = ctx;
  switch (style.background.type) {
    case 'linear-gradient':
    case 'panoramic':
      return { type: 'linear', angle: Number(style.background.angle ?? 135), stops: [{ offset: 0, color: pal.bg }, { offset: 1, color: mix(pal.bg, pal.surface, 0.9) }] };
    case 'radial-gradient':
      return { type: 'radial', cx: 0.2, cy: 0.15, radius: 1.1, stops: [{ offset: 0, color: mix(pal.highlight, pal.bg, 0.2) }, { offset: 1, color: pal.bg }] };
    case 'mesh-gradient':
      return { type: 'radial', cx: 0.8, cy: 0.2, radius: 1.2, stops: [{ offset: 0, color: mix(pal.primary, pal.bg, 0.65) }, { offset: 1, color: pal.bg }] };
    default:
      return { type: 'solid', color: pal.bg };
  }
}

function textBlocks(ctx: Ctx, s: SlidePlan, isCover: boolean): Block[] {
  const { style, pal, k } = ctx;
  const hl = style.layout.headline;
  const headWeight = nearestWeight(ctx.heading, hl.weight);
  const bodyWeight = nearestWeight(ctx.body, style.layout.body.weight);
  const T = patterns.typography;
  const minBody = T['minBodyPx@1080'] * k;
  const minHead = T['minHeadlinePx@1080'] * k;
  const headCase: TextElement['textCase'] = hl.case === 'upper' ? 'upper' : hl.case === 'title' ? 'title' : 'none';
  const emph = (words: string[]): TextEmphasis | undefined => (words.length ? { ...ctx.emphasis, words } : undefined);

  const head = (text: string, max: number, min = minHead): Block => ({
    slot: 'headline', text, font: ctx.heading, weight: headWeight, italic: false, max: max * hl.scale * k, min, lineHeight: hl.lineHeight,
    color: pal.text, textCase: headCase, letterSpacing: hl.tracking * max * k, emphasis: emph(s.emphasis), gapAfter: 0.45,
  });
  const body = (text: string, slot = 'body', max = 46): Block => ({
    slot, text, font: ctx.body, weight: bodyWeight, italic: false, max: max * k, min: minBody, lineHeight: style.layout.body.lineHeight,
    color: slot === 'subline' ? pal.mutedText : pal.text, textCase: 'none', letterSpacing: 0, gapAfter: 0.8,
  });

  const blocks: Block[] = [];
  switch (s.role) {
    case 'hook':
      blocks.push(head(s.headline, 132, 72 * k));
      if (s.body) blocks.push(body(s.body, 'subline', 46));
      break;
    case 'stat':
      if (s.stat) {
        blocks.push({ ...head(s.stat.value, 240, 120 * k), slot: 'stat-value', color: ctx.emphasis.style === 'color' ? ctx.emphasis.color : pal.primary, emphasis: undefined, textCase: 'none', letterSpacing: -4 * k, gapAfter: 0.15 });
        blocks.push(body(s.stat.label, 'stat-label', 48));
      }
      if (s.headline && !s.stat) blocks.push(head(s.headline, 84));
      if (s.body) blocks.push(body(s.body, 'body', 40));
      break;
    case 'quote':
      if (s.quote) {
        blocks.push({ ...head(`“${s.quote.text}”`, 68, 44 * k), slot: 'quote', font: ctx.heading, textCase: 'none', emphasis: undefined, lineHeight: 1.2 });
        if (s.quote.attribution) blocks.push({ ...body(`— ${s.quote.attribution}`, 'attribution', 34), color: pal.mutedText, min: 26 * k });
      } else {
        blocks.push(head(s.headline, 84));
        if (s.body) blocks.push(body(s.body));
      }
      break;
    default: {
      const headMax = s.role === 'cta' ? 100 : 92;
      if (s.headline) blocks.push(head(s.headline, headMax));
      if (s.body) blocks.push(body(s.body));
      if (s.bullets.length) {
        const numbered = style.roleLayouts.list === 'list-numbered-rows' || s.role === 'step';
        const marker = (i: number) => (numbered ? `${String(i + 1).padStart(2, '0')}  ` : style.roleLayouts.list === 'list-checklist' ? '✓  ' : '•  ');
        blocks.push({ ...body(s.bullets.map((b, i) => marker(i) + b).join('\n'), 'bullets', 42), lineHeight: Math.max(1.5, style.layout.body.lineHeight) });
      }
    }
  }
  if (isCover && !blocks.length) blocks.push(head('Untitled', 132));
  return blocks;
}

/** Shrinks all blocks by a shared factor until the stack fits the content box. */
function fitBlocks(ctx: Ctx, blocks: Block[], align: TextElement['align']) {
  const width = ctx.box.w;
  let f = 1;
  for (let iter = 0; iter < 30; iter++) {
    const sized = blocks.map((b) => {
      const size = Math.max(b.min, Math.round(b.max * f));
      const text = applyCase(b.text, b.textCase);
      const lay = layoutText(text, { fontId: b.font, size, weight: b.weight, italic: b.italic, letterSpacing: b.letterSpacing }, width, b.lineHeight, b.emphasis?.words, emphasisFont(b.font, b.emphasis));
      return { b, size, height: Math.ceil(lay.height), lineWidth: lay.width };
    });
    const total = sized.reduce((t, x, i) => t + x.height + (i < sized.length - 1 ? x.size * x.b.gapAfter : 0), 0);
    const atFloor = sized.every((x) => x.size <= x.b.min);
    if (total <= ctx.box.h || atFloor) return { sized, total, align, overflow: total > ctx.box.h };
    f *= 0.94;
  }
  throw new Error('unreachable');
}

function buildSlide(ctx: Ctx, s: SlidePlan, index: number, total: number): Slide {
  const { style, pal, box, k } = ctx;
  const align = style.layout.alignment;
  const elements: SlideElement[] = [];
  const blocks = textBlocks(ctx, s, index === 0);
  const fitted = fitBlocks(ctx, blocks, align);

  const centerRoles = new Set(['hook', 'stat', 'quote', 'cta']);
  const vCenter = centerRoles.has(s.role) || align === 'center';
  let y = vCenter ? box.y + Math.max(0, (box.h - fitted.total) / 2) : box.y + Math.min(box.h * 0.12, Math.max(0, box.h - fitted.total));

  // Recurring motif: short accent bar above the first block on left-aligned layouts.
  if (align === 'left' && s.role !== 'quote') {
    const barH = Math.round(10 * k);
    elements.push(rect('accent-bar', box.x, Math.max(box.y - 40 * k, y - 40 * k), Math.round(88 * k), barH, pal.primary));
  }

  fitted.sized.forEach(({ b, size, height }, i) => {
    const el: TextElement = {
      id: newId('el_'), kind: 'text', slot: b.slot, name: b.slot,
      x: box.x, y: Math.round(y), width: box.w, height, rotation: 0, opacity: 1,
      text: b.text, fontId: b.font, fontSize: size, fontWeight: b.weight, italic: b.italic, fill: b.color,
      align, verticalAlign: 'top', lineHeight: b.lineHeight, letterSpacing: b.letterSpacing, textCase: b.textCase,
      autoFit: true, emphasis: b.emphasis,
    };
    elements.push(el);
    y += height + (i < fitted.sized.length - 1 ? size * b.gapAfter : 0);
  });

  elements.push(...chrome(ctx, index, total));
  return { id: newId('sl_'), role: s.role, background: background(ctx), elements, notes: fitted.overflow ? 'Text exceeds the safe area at minimum size — shorten it.' : undefined };
  function rect(slot: string, x: number, yy: number, w: number, h: number, fill: string): SlideElement {
    return { id: newId('el_'), kind: 'rect', slot, name: slot, x, y: yy, width: w, height: h, rotation: 0, opacity: 1, fill, cornerRadius: h / 2 };
  }
}

/** Slide number + swipe cue, placed in the chrome strips outside the content box. */
function chrome(ctx: Ctx, index: number, total: number): SlideElement[] {
  const { style, pal, box, k, H } = ctx;
  const out: SlideElement[] = [];
  const small = Math.round(30 * k);
  const font = ctx.body;
  const weight = nearestWeight(font, 600);
  const text = (slot: string, t: string, x: number, y: number, w: number, align: TextElement['align'], color = pal.mutedText): TextElement => ({
    id: newId('el_'), kind: 'text', slot, name: slot, x, y, width: w, height: Math.round(small * 1.3), rotation: 0, opacity: 1,
    text: t, fontId: font, fontSize: small, fontWeight: weight, italic: false, fill: color, align, verticalAlign: 'top',
    lineHeight: 1.3, letterSpacing: 1 * k, textCase: 'none', autoFit: false, locked: false,
  });
  const topY = box.y - Math.round(90 * k) + Math.round(20 * k);
  const bottomY = box.y + box.h + Math.round(36 * k);

  const num = style.layout.slideNumber;
  if (num.style !== 'none') {
    const pos = num.position;
    const yPos = pos.startsWith('bottom') ? bottomY : topY;
    const align: TextElement['align'] = pos.endsWith('right') ? 'right' : pos.endsWith('center') ? 'center' : 'left';
    if (num.style === 'dots') {
      const r = Math.round(6 * k);
      const gap = Math.round(22 * k);
      const width = (total - 1) * gap;
      const x0 = align === 'center' ? box.x + box.w / 2 - width / 2 : align === 'right' ? box.x + box.w - width : box.x;
      for (let i = 0; i < total; i++) {
        out.push({ id: newId('el_'), kind: 'ellipse', slot: 'progress-dot', x: x0 + i * gap - r, y: yPos + small / 2 - r, width: 2 * r, height: 2 * r, rotation: 0, opacity: i === index ? 1 : 0.35, fill: i === index ? pal.primary : pal.mutedText });
      }
    } else {
      const label = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      out.push(text('slide-number', label, box.x, yPos, box.w, align));
    }
  }

  const isLast = index === total - 1;
  const cue = style.layout.swipeCue;
  if (!isLast && cue.style !== 'none') {
    const label = index === 0 ? 'Swipe  →' : '→';
    const color = contrast(pal.primary, pal.bg) >= 3 ? pal.primary : pal.text;
    const y = Math.min(H - Math.round(60 * k), bottomY);
    // Avoid colliding with a bottom slide number.
    const pos = num.position.startsWith('bottom') && num.style !== 'none' && cue.position.startsWith('bottom') ? 'top-right' : 'bottom-right';
    out.push(text('swipe-cue', label, box.x, pos === 'top-right' ? topY : y, box.w, 'right', color));
  }
  return out;
}
