// Style decorations ("recurring motifs"). Each style lists decoration ids in styles.json; we draw the
// ones we know and ignore the rest. Density (none/minimal/normal/rich) comes from style + modifiers.
import type { SlideElement, TextElement } from '@/model/types';
import { mix } from '@/styles/color';
import type { SlidePlan } from '../schema';
import type { Ctx } from './context';
import { isPanoramic } from './backgrounds';
import { ellipse, label, line, path, rect } from './primitives';
import { SHAPES, starburst, wave } from './shapes';

export interface Decor { back: SlideElement[]; front: SlideElement[] }

const firstSlot = (els: SlideElement[], slot: string) => els.find((e) => e.slot === slot) as TextElement | undefined;

export function decorate(ctx: Ctx, s: SlidePlan, index: number, content: SlideElement[], layoutId: string): Decor {
  const back: SlideElement[] = [];
  const front: SlideElement[] = [];
  const { pal, k, W, H, box, margin } = ctx;
  if (ctx.decoration === 'none') return { back, front };
  let ids = [...ctx.style.layout.decorations];
  if (ctx.decoration === 'minimal') ids = ids.slice(0, 1);
  if (ctx.decoration === 'rich' && !ids.includes('sparkle')) ids.push('sparkle');
  const headline = firstSlot(content, 'headline');
  const soft = (t: number) => mix(pal.primary, pal.bg, t);

  // Default motif for left-aligned styles without their own: short accent bar above the headline.
  const ownMotif = ids.some((d) => ['thin-rule-top', 'kicker-label', 'small-caps-kicker', 'code-tag', 'terminal-prompt', 'brand-bar', 'window-chrome', 'avatar-row'].includes(d));
  if (!ownMotif && headline && ctx.align === 'left' && !['hook-split', 'quote-big-marks', 'compare-split', 'hook-tweet'].includes(layoutId)) {
    front.push(rect('accent-bar', headline.x, headline.y - Math.round(44 * k), Math.round(88 * k), Math.round(10 * k), pal.primary, { cornerRadius: 5 * k }));
  }

  for (const id of ids) {
    switch (id) {
      case 'thin-rule-top':
        back.push(line('rule-top', [box.x, box.y - Math.round(10 * k), box.x + box.w, box.y - Math.round(10 * k)], mix(pal.text, pal.bg, 0.6), Math.max(1, 2 * k)));
        break;
      case 'corner-index':
        if (s.role !== 'hook') back.push(label(ctx, 'corner-index', String(index + 1).padStart(2, '0'), box.x, H - margin.bottom - Math.round(330 * k), box.w, { size: Math.round(300 * k), color: mix(pal.text, pal.bg, 0.92), weight: ctx.headline.weight, font: ctx.fonts.heading, align: 'right', lineHeight: 1 }));
        break;
      case 'blob-corner':
      case 'organic-blob': {
        const r = Math.round(W * 0.42);
        const flip = index % 2 === 1;
        back.push(path('blob', (flip ? SHAPES.blob2 : SHAPES.blob).d, [100, 100], flip ? -r * 0.45 : W - r * 0.6, flip ? H - r * 0.6 : -r * 0.35, r, r, { fill: soft(ctx.dark ? 0.75 : 0.82), opacity: 0.9 }));
        break;
      }
      case 'double-rule':
      case 'hairline-divider':
      case 'thin-divider':
        if (headline && s.role !== 'hook') {
          const y = headline.y + headline.height + Math.round(14 * k);
          const x0 = ctx.align === 'center' ? box.x + box.w / 2 - 60 * k : headline.x;
          back.push(line('divider', [x0, y, x0 + 120 * k, y], mix(pal.text, pal.bg, 0.55), Math.max(1, 2 * k)));
          if (id === 'double-rule') back.push(line('divider', [x0, y + 8 * k, x0 + 120 * k, y + 8 * k], mix(pal.text, pal.bg, 0.55), Math.max(1, 2 * k)));
        }
        break;
      case 'thick-border':
        front.push(rect('border', Math.round(18 * k), Math.round(18 * k), W - Math.round(36 * k), H - Math.round(36 * k), 'transparent', { stroke: pal.text, strokeWidth: Math.round(10 * k) }));
        break;
      case 'thin-frame':
        back.push(rect('frame', Math.round(28 * k), Math.round(28 * k), W - Math.round(56 * k), H - Math.round(56 * k), 'transparent', { stroke: mix(pal.primary, pal.bg, 0.3), strokeWidth: Math.max(1, 2 * k) }));
        break;
      case 'barcode-strip': {
        const x0 = box.x;
        const y0 = H - margin.bottom - Math.round(20 * k);
        let x = x0;
        [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 2].forEach((w, n) => {
          if (n % 2 === 0) back.push(rect('barcode', x, y0, w * 3 * k, 26 * k, pal.text));
          x += w * 3 * k;
        });
        break;
      }
      case 'sticker-tag':
        if (s.role === 'hook') {
          const t = label(ctx, 'sticker', 'NEW', 0, 0, 200 * k, { size: Math.round(30 * k), weight: ctx.headline.weight, color: ctx.onPrimary, align: 'center', font: ctx.fonts.heading });
          const bw = 170 * k;
          const bh = t.height + 20 * k;
          const bx = box.x + box.w - bw;
          const by = box.y;
          front.push(rect('sticker-bg', bx, by, bw, bh, pal.primary, { rotation: 0, stroke: pal.text, strokeWidth: Math.round(4 * k) }));
          t.x = Math.round(bx); t.y = Math.round(by + 10 * k); t.width = Math.round(bw);
          front.push(t);
        }
        break;
      case 'sparkle':
      case 'tiny-stars': {
        const spots = [[0.86, 0.2], [0.12, 0.78], [0.78, 0.86]] as const;
        spots.slice(0, s.role === 'hook' ? 3 : 1).forEach(([fx, fy], n) => {
          const sz = (n === 0 ? 64 : 40) * k;
          back.push(path('sparkle', SHAPES.sparkle.d, SHAPES.sparkle.viewBox, W * fx, H * fy, sz, sz, { fill: n === 1 ? pal.accent : pal.primary, opacity: 0.85 }));
        });
        break;
      }
      case 'squiggle':
      case 'underline-squiggle':
        if (headline && (s.role === 'hook' || id === 'underline-squiggle')) {
          const w = Math.min(headline.width, 320 * k);
          const wv = wave(200, 8, 40);
          const x0 = ctx.align === 'center' ? headline.x + headline.width / 2 - w / 2 : headline.x;
          front.push(path('squiggle', wv.d, wv.viewBox, x0, headline.y + headline.height + 6 * k, w, 26 * k, { stroke: pal.primary, strokeWidth: Math.round(6 * k) }));
        }
        break;
      case 'brand-bar':
        back.push(rect('brand-bar', 0, 0, Math.round(16 * k), H, pal.primary));
        break;
      case 'logo-footer':
        if (ctx.handle && s.role !== 'cta') back.push(label(ctx, 'footer-handle', ctx.handle.startsWith('@') ? ctx.handle : `@${ctx.handle}`, box.x, ctx.chromeBottomY - ctx.sizes.small * 0.65, box.w / 2, { color: pal.mutedText }));
        break;
      case 'starburst':
        if (s.role === 'hook' || s.role === 'stat') {
          const sb = starburst(14, 0.8);
          const sz = Math.round(220 * k);
          back.push(path('starburst', sb.d, sb.viewBox, W - sz * 0.8, box.y - sz * 0.35, sz, sz, { fill: pal.accent, opacity: 0.9, rotation: 0 }));
        }
        break;
      case 'stamp-circle':
        if (s.role === 'hook') back.push(ellipse('stamp', W - 150 * k, H - 260 * k, 95 * k, 95 * k, 'transparent', { stroke: pal.primary, strokeWidth: Math.round(5 * k), dash: [14 * k, 10 * k] }));
        break;
      case 'doodle-arrow':
        if (s.role === 'hook' && headline) front.push(path('doodle-arrow', SHAPES.handArrow.d, SHAPES.handArrow.viewBox, box.x + box.w * 0.55, headline.y + headline.height + 70 * k, 220 * k, 120 * k, { stroke: pal.primary, strokeWidth: Math.round(6 * k) }));
        break;
      case 'scribble-circle':
        if (headline && s.emphasis.length && s.role === 'hook') {
          // Loosely circle the first headline line where emphasis usually sits.
          front.push(path('scribble', SHAPES.scribbleCircle.d, SHAPES.scribbleCircle.viewBox, headline.x - 24 * k, headline.y - 18 * k, Math.min(headline.width, 460 * k), headline.fontSize * headline.lineHeight + 36 * k, { stroke: pal.accent, strokeWidth: Math.round(5 * k), opacity: 0.9 }));
        }
        break;
      case 'tape-corner':
        back.push(rect('tape', W - 220 * k, 34 * k, 210 * k, 56 * k, mix(pal.highlight, pal.bg, 0.2), { rotation: 18, opacity: 0.75 }));
        break;
      case 'step-tracker': {
        const steps = ctx.plan.slides.filter((x) => x.role === 'step').length;
        if (s.role === 'step' && steps > 1) {
          const idx = ctx.plan.slides.slice(0, index + 1).filter((x) => x.role === 'step').length - 1;
          const segW = Math.min(90 * k, (box.w - (steps - 1) * 12 * k) / steps);
          for (let n = 0; n < steps; n++) back.push(rect('step-tracker', box.x + n * (segW + 12 * k), box.y - 44 * k, segW, 10 * k, n <= idx ? pal.primary : mix(pal.text, pal.bg, 0.85), { cornerRadius: 5 * k }));
        }
        break;
      }
      case 'horizon-sun': {
        if (s.role === 'hook' || s.role === 'cta') {
          const r = W * 0.28;
          const cy = H * 0.78;
          back.push(ellipse('sun', W / 2, cy, r, r, safeAccent(ctx), { opacity: 0.55 }));
          for (let n = 0; n < 5; n++) back.push(rect('sun-stripe', W / 2 - r, cy + n * r * 0.18 - r * 0.1, 2 * r, (4 + n * 3) * k, pal.bg));
        }
        break;
      }
      case 'scanlines':
        for (let y = 0; y < H; y += Math.round(8 * k)) back.push(rect('scanline', 0, y, W, Math.max(1, k), '#000000', { opacity: 0.08 }));
        break;
      case 'glow-orb':
        back.push(ellipse('glow-orb', W * (index % 2 ? 0.15 : 0.85), H * 0.25, W * 0.35, W * 0.35, pal.primary, { opacity: 0.18, shadow: { color: pal.primary, blur: 120 * k, offsetX: 0, offsetY: 0, opacity: 0.6 } }));
        break;
      case 'source-footnote':
        if (s.role === 'stat') back.push(label(ctx, 'source', 'Source: your data', box.x, box.y + box.h - ctx.sizes.small * 1.3, box.w, { color: pal.mutedText, size: Math.round(26 * k) }));
        break;
      default:
        break; // handled by layouts (cards, quote marks, avatar rows…) or not drawn yet
    }
  }

  if (isPanoramic(ctx)) back.push(...panoramicSlice(ctx, index));
  return { back, front };
}

function safeAccent(ctx: Ctx) {
  return ctx.pal.accent;
}

/**
 * Decorations defined in panorama coordinates (count × W wide) and sliced per slide, so shapes cross
 * slide seams and the carousel reads as one continuous canvas when swiped.
 */
function panoramicSlice(ctx: Ctx, index: number): SlideElement[] {
  const { W, H, k, pal, total, margin } = ctx;
  const out: SlideElement[] = [];
  const seamShape = ctx.style.layout.decorations.includes('bleed-shape') || ctx.style.layout.swipeCue.style === 'bleed-shape';
  // Circles centered on every seam: right half shows on slide i, left half on slide i+1.
  for (let seam = 1; seam < total; seam++) {
    if (seam !== index && seam !== index + 1) continue;
    const r = (seamShape ? 0.2 : 0.14) * W;
    const cy = seam % 2 ? H * 0.22 : H * 0.8;
    const cxGlobal = seam * W;
    const cx = cxGlobal - index * W;
    out.push(ellipse('seam-shape', cx, cy, r, r, mix(pal.primary, pal.bg, ctx.dark ? 0.55 : 0.7), { opacity: 0.6 }));
  }
  // One continuous wave line across the whole panorama, inside the bottom margin.
  const wv = wave(W * total, 14 * k, W * 0.6);
  out.push(path('panorama-line', wv.d, wv.viewBox, -index * W, H - margin.bottom * 0.55 - 14 * k, W * total, 28 * k, { stroke: mix(pal.primary, pal.bg, 0.35), strokeWidth: Math.round(4 * k), opacity: 0.8 }));
  return out;
}
