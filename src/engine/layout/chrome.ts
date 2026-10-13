// Slide numbers, progress indicators and swipe cues, drawn in the chrome strips outside the content box.
// Rules from design-patterns.json: the hook always gets a cue, the last slide never does, ≤ 2 cues per slide.
import type { SlideElement, TextElement } from '@/model/types';
import { contrast, mix } from '@/styles/color';
import type { Ctx } from './context';
import { ellipse, label, path, rect } from './primitives';
import { SHAPES } from './shapes';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

type Pos = { v: 'top' | 'bottom' | 'middle'; h: 'left' | 'center' | 'right' };
const parsePos = (p: string): Pos => ({
  v: p.startsWith('bottom') || p === 'bottom' ? 'bottom' : p.includes('middle') || p === 'right-edge' ? 'middle' : 'top',
  h: p.endsWith('left') ? 'left' : p.endsWith('center') || p === 'bottom' || p === 'top' ? 'center' : 'right',
});

export function chrome(ctx: Ctx, index: number): SlideElement[] {
  const out: SlideElement[] = [];
  const { pal, k, box, total } = ctx;
  const n = index + 1;
  const pad = (x: number) => String(x).padStart(2, '0');
  const numStyle = ctx.style.layout.slideNumber;
  const numPos = parsePos(numStyle.position);
  const cueStyle = ctx.style.layout.swipeCue;
  let cuePos = parsePos(cueStyle.position);
  const cueColor = contrast(pal.primary, pal.bg) >= 3 ? pal.primary : pal.text;
  const yFor = (v: Pos['v'], h: number) => Math.round((v === 'bottom' ? ctx.chromeBottomY : ctx.chromeTopY) - h / 2);
  const mono = ctx.fonts.accent;

  // Avoid putting a cue where the slide number is.
  if (numStyle.style !== 'none' && cuePos.v === numPos.v && cuePos.h === numPos.h) cuePos = { v: numPos.v === 'top' ? 'bottom' : 'top', h: 'right' };
  // Progress bar and dots are full-width bottom indicators; keep numbers off the bottom when used.

  // ---- slide number ----
  const place = (el: TextElement, pos: Pos) => {
    el.align = pos.h;
    el.y = yFor(pos.v, el.height);
    return el;
  };
  switch (numStyle.style) {
    case 'none':
    case 'no-label':
      break;
    case 'dots':
      out.push(...dots(ctx, index, numPos));
      break;
    case 'roman':
      out.push(place(label(ctx, 'slide-number', ROMAN[index] ?? String(n), box.x, 0, box.w, { font: ctx.fonts.heading, letterSpacing: 2 * k }), numPos));
      break;
    case 'mono-index':
      out.push(place(label(ctx, 'slide-number', `[${pad(n)}/${pad(total)}]`, box.x, 0, box.w, { font: mono }), numPos));
      break;
    case 'thread-index':
      out.push(place(label(ctx, 'slide-number', `${n}/${total}`, box.x, 0, box.w), numPos));
      break;
    case 'step-label':
      out.push(place(label(ctx, 'slide-number', `${pad(n)} — ${pad(total)}`, box.x, 0, box.w, { color: ctx.accentText, weight: ctx.headline.weight }), numPos));
      break;
    case 'small-caps-fraction':
      out.push(place(label(ctx, 'slide-number', `${pad(n)}  /  ${pad(total)}`, box.x, 0, box.w, { letterSpacing: 4 * k, size: Math.round(26 * k) }), numPos));
      break;
    case 'handwritten':
      out.push(place(label(ctx, 'slide-number', `${n} of ${total}`, box.x, 0, box.w, { font: ctx.fonts.accent, size: Math.round(36 * k), color: ctx.accentText }), numPos));
      break;
    case 'boxed-number':
    case 'circle-badge':
    case 'pill': {
      const t = label(ctx, 'slide-number', numStyle.style === 'pill' ? `${n} / ${total}` : pad(n), 0, 0, 400 * k, { weight: ctx.headline.weight, color: ctx.onPrimary, font: ctx.fonts.heading, align: 'center' });
      const bh = t.height + 18 * k;
      const bw = numStyle.style === 'circle-badge' ? bh : numStyle.style === 'pill' ? t.text.length * ctx.sizes.small * 0.62 + 44 * k : t.text.length * ctx.sizes.small * 0.7 + 30 * k;
      const bx = numPos.h === 'right' ? box.x + box.w - bw : numPos.h === 'center' ? box.x + box.w / 2 - bw / 2 : box.x;
      const by = yFor(numPos.v, bh);
      out.push(
        numStyle.style === 'circle-badge'
          ? ellipse('slide-number-bg', bx + bw / 2, by + bh / 2, bw / 2, bh / 2, pal.primary)
          : rect('slide-number-bg', bx, by, bw, bh, pal.primary, { cornerRadius: numStyle.style === 'pill' ? bh / 2 : 0 }),
      );
      Object.assign(t, { x: Math.round(bx), y: Math.round(by + 9 * k), width: Math.round(bw) });
      out.push(t);
      break;
    }
    default: // fraction
      out.push(place(label(ctx, 'slide-number', `${pad(n)} / ${pad(total)}`, box.x, 0, box.w, { letterSpacing: 1 * k }), numPos));
  }

  // ---- swipe cue / progress ----
  const isLast = index === total - 1;
  if (cueStyle.style === 'progress-bar') {
    const h = Math.round(8 * k);
    const y = Math.round(ctx.H - ctx.margin.bottom * 0.5 - h / 2);
    out.push(rect('progress-track', box.x, y, box.w, h, mix(pal.text, pal.bg, 0.85), { cornerRadius: h / 2 }));
    out.push(rect('progress-fill', box.x, y, (box.w * n) / total, h, pal.primary, { cornerRadius: h / 2 }));
  }
  if (isLast || cueStyle.style === 'progress-bar') return out;
  // design-patterns: the hook always gets a cue, even in styles that otherwise skip them.
  if (cueStyle.style === 'none' && index !== 0) return out;
  if (cueStyle.style === 'dots' && numStyle.style !== 'dots') {
    out.push(...dots(ctx, index, cuePos));
    return out;
  }
  if (cueStyle.style === 'bleed-shape' || cueStyle.style === 'dots') return out; // panorama/dots already signal "more"

  const hook = index === 0;
  const s = ctx.sizes.small;
  const right = box.x + box.w;
  const cy = cuePos.v === 'middle' ? ctx.H / 2 : cuePos.v === 'bottom' ? ctx.chromeBottomY : ctx.chromeTopY;
  const arrow = (shape: { d: string[]; viewBox: [number, number] }, w: number, h: number, x = right - w) =>
    path('swipe-cue', shape.d, shape.viewBox, x, cy - h / 2, w, h, { stroke: cueColor, strokeWidth: Math.max(2, 4 * k) });

  switch (cueStyle.style) {
    case 'pill-swipe-text':
    case 'pointing-hand-badge': {
      if (!hook) {
        out.push(arrow(SHAPES.arrowRight, s * 1.4, s * 1.4));
        break;
      }
      const t = label(ctx, 'swipe-cue', 'Swipe  →', 0, 0, 400 * k, { weight: ctx.headline.weight, color: ctx.onPrimary, font: ctx.fonts.heading, align: 'center' });
      const bw = 230 * k;
      const bh = t.height + 24 * k;
      out.push(rect('swipe-pill', right - bw, cy - bh / 2, bw, bh, pal.primary, { cornerRadius: bh / 2 }));
      Object.assign(t, { x: Math.round(right - bw), y: Math.round(cy - bh / 2 + 12 * k), width: Math.round(bw) });
      out.push(t);
      break;
    }
    case 'text-continue':
    case 'next-step-label':
    case 'text-arrow-mono': {
      const txt = cueStyle.style === 'text-arrow-mono' ? (hook ? 'swipe →' : 'next →') : cueStyle.style === 'next-step-label' ? (hook ? "Let's go  →" : 'Next  →') : hook ? 'Continue  →' : '→';
      const el = label(ctx, 'swipe-cue', txt, box.x, 0, box.w, { color: cueColor, align: 'right', italic: cueStyle.style === 'text-continue', font: cueStyle.style === 'text-arrow-mono' ? ctx.fonts.accent : ctx.fonts.body, weight: ctx.headline.weight });
      el.y = Math.round(cy - el.height / 2);
      out.push(el);
      break;
    }
    case 'big-arrow':
      out.push(arrow(SHAPES.arrowRight, (hook ? 96 : 60) * k, (hook ? 96 : 60) * k));
      break;
    case 'chevron-glass':
    case 'soft-chevron': {
      const d = (hook ? 92 : 72) * k;
      const x = cuePos.h === 'right' && cuePos.v === 'middle' ? ctx.W - ctx.margin.right * 0.5 - d / 2 : right - d / 2;
      out.push(ellipse('swipe-bubble', x, cy, d / 2, d / 2, cueStyle.style === 'chevron-glass' ? '#FFFFFF' : mix(pal.primary, pal.bg, 0.8), { opacity: cueStyle.style === 'chevron-glass' ? 0.22 : 1 }));
      out.push(path('swipe-cue', SHAPES.chevronRight.d, SHAPES.chevronRight.viewBox, x - d * 0.24, cy - d * 0.26, d * 0.52, d * 0.52, { stroke: cueStyle.style === 'chevron-glass' ? pal.text : cueColor, strokeWidth: Math.max(2, 4 * k) }));
      break;
    }
    case 'hand-arrow':
    case 'doodle-arrow':
      out.push(arrow(SHAPES.handArrow, (hook ? 150 : 100) * k, (hook ? 82 : 55) * k));
      break;
    case 'hairline-arrow':
      out.push(arrow(SHAPES.hairlineArrow, (hook ? 220 : 140) * k, 28 * k));
      break;
    case 'chevrons-triple':
      out.push(path('swipe-cue', SHAPES.chevronsTriple.d, SHAPES.chevronsTriple.viewBox, box.x + box.w / 2 - 50 * k, cy - 20 * k, 100 * k, 40 * k, { stroke: cueColor, strokeWidth: Math.max(2, 4 * k) }));
      break;
    default: {
      // arrow-line and anything unknown: "Swipe" label + arrow on the hook, arrow alone afterwards.
      out.push(arrow(SHAPES.arrowRight, s * 1.5, s * 1.5));
      if (hook) {
        const el = label(ctx, 'swipe-cue-label', 'Swipe', box.x, 0, box.w - s * 2, { color: cueColor, align: 'right', weight: ctx.headline.weight, letterSpacing: 1 * k });
        el.y = Math.round(cy - el.height / 2);
        out.push(el);
      }
    }
  }
  return out;
}

function dots(ctx: Ctx, index: number, pos: Pos): SlideElement[] {
  const { k, pal, box, total } = ctx;
  const r = Math.round(7 * k);
  const gap = Math.round(24 * k);
  const width = (total - 1) * gap + r * 4;
  const x0 = pos.h === 'center' ? box.x + box.w / 2 - width / 2 : pos.h === 'right' ? box.x + box.w - width : box.x;
  const cy = pos.v === 'bottom' ? ctx.chromeBottomY : ctx.chromeTopY;
  const out: SlideElement[] = [];
  let x = x0;
  for (let i = 0; i < total; i++) {
    const active = i === index;
    const w = active ? r * 5 : r * 2;
    out.push(rect('progress-dot', x, cy - r, w, r * 2, active ? pal.primary : mix(pal.text, pal.bg, 0.7), { cornerRadius: r }));
    x += w + gap - r * 2;
  }
  return out;
}
