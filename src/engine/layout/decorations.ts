// Style decorations ("recurring motifs"). Each style lists decoration ids in styles.json; we draw the
// ones we know and ignore the rest. Density (none/minimal/normal/rich) comes from style + modifiers.
import type { SlideElement, TextElement } from '@/model/types';
import { mix } from '@/styles/color';
import type { SlidePlan } from '../schema';
import type { Ctx } from './context';
import { isPanoramic } from './backgrounds';
import { ellipse, label, line, path, rect, textEl } from './primitives';
import { measure } from './textLayout';
import { EXTRA_SHAPES, SHAPES, hills, seeded, splat, starburst, wave } from './shapes';

export interface Decor { back: SlideElement[]; front: SlideElement[] }

const firstSlot = (els: SlideElement[], slot: string) => els.find((e) => e.slot === slot) as TextElement | undefined;

export function decorate(ctx: Ctx, s: SlidePlan, index: number, content: SlideElement[], layoutId: string): Decor {
  const back: SlideElement[] = [];
  const front: SlideElement[] = [];
  const { pal, k, W, H, box, margin } = ctx;
  // Continuous (panoramic) drawings are a separate choice from decoration density: they still run
  // across a plain or undecorated carousel when the user turns them on.
  if (ctx.decoration === 'none') return { back: isPanoramic(ctx) ? panoramicSlice(ctx, index) : back, front };
  // Text, icons and charts that decorations must never cover.
  const obstacles = content.filter((e) => e.kind === 'text' || e.kind === 'chart' || e.kind === 'table' || e.kind === 'image' || /icon|avatar|metric/.test(e.slot ?? ''));
  const clear = (x: number, y: number, w: number, h: number) => !obstacles.some((o) => x < o.x + o.width && o.x < x + w && y < o.y + o.height && o.y < y + h);
  let ids = [...ctx.style.layout.decorations];
  if (ctx.decoration === 'minimal') ids = ids.slice(0, 1);
  if (ctx.decoration === 'rich' && !ids.includes('sparkle')) ids.push('sparkle');
  const headline = firstSlot(content, 'headline');
  const soft = (t: number) => mix(pal.primary, pal.bg, t);

  // Default motif for left-aligned styles without their own: short accent bar above the headline.
  const ownMotif = ids.some((d) => ['thin-rule-top', 'kicker-label', 'small-caps-kicker', 'code-tag', 'terminal-prompt', 'brand-bar', 'window-chrome', 'avatar-row', 'masthead', 'spray-drips', 'margin-line', 'swiss-grid', 'whitespace'].includes(d));
  const stepTracker = ids.includes('step-tracker') && s.role === 'step' && ctx.plan.slides.filter((x) => x.role === 'step').length > 1;
  if (!ownMotif && !stepTracker && headline && ctx.align === 'left' && !['hook-split', 'quote-big-marks', 'compare-split', 'hook-tweet'].includes(layoutId)) {
    // Never above the content box, so it can't collide with a top slide number or swipe cue.
    const barY = Math.max(headline.y - Math.round(44 * k), box.y - Math.round(18 * k));
    front.push(rect('accent-bar', headline.x, barY, Math.round(88 * k), Math.round(10 * k), pal.primary, { cornerRadius: 5 * k }));
  }

  for (const id of ids) {
    switch (id) {
      case 'thin-rule-top':
        back.push(line('rule-top', [box.x, box.y - Math.round(10 * k), box.x + box.w, box.y - Math.round(10 * k)], mix(pal.text, pal.bg, 0.6), Math.max(1, 2 * k)));
        break;
      case 'corner-index':
        if (s.role !== 'hook') {
          const ci = label(ctx, 'corner-index', String(index + 1).padStart(2, '0'), box.x, H - margin.bottom - Math.round(330 * k), box.w, { size: Math.round(300 * k), color: mix(pal.text, pal.bg, 0.92), weight: ctx.headline.weight, font: ctx.fonts.heading, align: 'right', lineHeight: 1 });
          // Only where it doesn't sit under text or icons (the glyphs fill roughly the right 45%).
          if (clear(ci.x + ci.width * 0.55, ci.y, ci.width * 0.45, ci.height)) back.push(ci);
        }
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
          // First free spot: top-right or top-left of the content box, or the bottom-left corner.
          const spot = [
            [box.x + box.w - bw, box.y],
            [box.x, box.y],
            [box.x, box.y + box.h - bh],
          ].find(([x, y]) => clear(x!, y!, bw, bh));
          if (spot) {
            const [bx, by] = spot as [number, number];
            front.push(rect('sticker-bg', bx, by, bw, bh, pal.primary, { rotation: 0, stroke: pal.text, strokeWidth: Math.round(4 * k) }));
            t.x = Math.round(bx); t.y = Math.round(by + 10 * k); t.width = Math.round(bw);
            front.push(t);
          }
        }
        break;
      case 'sparkle':
      case 'tiny-stars': {
        // Candidate spots, used in order where they don't touch text or icons.
        const spots = [[0.86, 0.2], [0.12, 0.78], [0.78, 0.86], [0.08, 0.14], [0.9, 0.55], [0.05, 0.5]] as const;
        let placed = 0;
        for (const [fx, fy] of spots) {
          if (placed >= (s.role === 'hook' ? 3 : 1)) break;
          const sz = (placed === 0 ? 64 : 40) * k;
          const x = Math.min(W - sz, W * fx);
          const y = Math.min(H - sz, H * fy);
          if (!clear(x - 8 * k, y - 8 * k, sz + 16 * k, sz + 16 * k)) continue;
          back.push(path('sparkle', SHAPES.sparkle.d, SHAPES.sparkle.viewBox, x, y, sz, sz, { fill: placed === 1 ? pal.accent : pal.primary, opacity: 0.85 }));
          placed++;
        }
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
          // Just above the content box, below the chrome strip (never under the slide number).
          for (let n = 0; n < steps; n++) back.push(rect('step-tracker', box.x + n * (segW + 12 * k), box.y - 18 * k, segW, 8 * k, n <= idx ? pal.primary : mix(pal.text, pal.bg, 0.85), { cornerRadius: 5 * k }));
        }
        break;
      }
      case 'horizon-sun': {
        if (s.role === 'hook' || s.role === 'cta') {
          // Mostly below the bottom edge: a horizon arc that stays clear of the text.
          const r = W * 0.3;
          const cy = H + r * 0.3;
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
      case 'confetti-shapes': {
        // Maximalism: a scatter of loud shapes in the outer band, clear of the text and the chrome corners.
        const rnd = seeded(index * 97 + 13);
        const colors = [pal.primary, pal.accent, pal.highlight, pal.text];
        const band = Math.max(margin.left, 60 * k);
        const n = s.role === 'hook' || s.role === 'cta' ? 12 : 7;
        for (let i = 0; i < n; i++) {
          const side = i % 4;
          const t = 0.08 + rnd() * 0.84;
          let x = side === 0 ? W * t : side === 2 ? W * t : side === 1 ? W - band * (0.2 + rnd() * 0.6) : band * (0.2 + rnd() * 0.6);
          let y = side === 1 || side === 3 ? H * t : side === 0 ? band * (0.2 + rnd() * 0.5) : H - band * (0.2 + rnd() * 0.5);
          // Keep the top-right (slide number) and bottom-right (swipe cue) corners clear.
          if (x > W * 0.7 && (y < H * 0.18 || y > H * 0.82)) x -= W * 0.4;
          y = Math.max(-10 * k, Math.min(H + 10 * k, y));
          const sz = (34 + rnd() * 50) * k;
          const color = colors[i % colors.length]!;
          const kind = i % 6;
          const rot = Math.round(rnd() * 90 - 45);
          if (kind === 0) back.push(ellipse('confetti', x, y, sz / 2, sz / 2, color));
          else if (kind === 1) back.push(path('confetti', EXTRA_SHAPES.triangle.d, EXTRA_SHAPES.triangle.viewBox, x - sz / 2, y - sz / 2, sz, sz, { fill: color, rotation: rot }));
          else if (kind === 2) back.push(path('confetti', EXTRA_SHAPES.zigzagLine.d, EXTRA_SHAPES.zigzagLine.viewBox, x - sz, y - sz * 0.15, sz * 2, sz * 0.3, { stroke: color, strokeWidth: Math.round(6 * k), rotation: rot }));
          else if (kind === 3) back.push(path('confetti', EXTRA_SHAPES.plus.d, EXTRA_SHAPES.plus.viewBox, x - sz / 2, y - sz / 2, sz, sz, { fill: color, rotation: rot }));
          else if (kind === 4) back.push(ellipse('confetti', x, y, sz / 2, sz / 2, 'transparent', { stroke: color, strokeWidth: Math.round(7 * k) }));
          else back.push(path('confetti', SHAPES.sparkle.d, SHAPES.sparkle.viewBox, x - sz / 2, y - sz / 2, sz, sz, { fill: color }));
        }
        break;
      }
      case 'floating-orbs': {
        // Surreal: glossy spheres lit from the top-left, drifting mostly off the edges.
        const orb = (cx: number, cy: number, r: number, color: string) =>
          ellipse('orb', cx, cy, r, r, color, {
            radial: { stops: [{ offset: 0, color: mix(pal.highlight, '#FFFFFF', 0.5) }, { offset: 0.45, color }, { offset: 1, color: mix(color, '#000000', 0.25) }], cx: 0.35, cy: 0.3 },
            shadow: { color: mix(pal.primary, '#000000', 0.4), blur: 50 * k, offsetX: 0, offsetY: 28 * k, opacity: ctx.dark ? 0.5 : 0.25 },
          });
        const left = index % 2 === 1;
        back.push(orb(left ? W * 0.02 : W * 0.98, -H * 0.01, W * 0.19, pal.primary));
        back.push(orb(left ? W * 0.93 : W * 0.07, H * 0.97, W * 0.09, pal.accent));
        if (s.role === 'hook' || s.role === 'cta') back.push(orb(left ? W * 0.97 : W * 0.03, H * 0.55, W * 0.05, mix(pal.accent, pal.highlight, 0.5)));
        break;
      }
      case 'arch-portal':
        if (s.role === 'hook' || s.role === 'cta' || s.role === 'quote') {
          const aw = Math.min(W * 0.86, box.w + 80 * k);
          const ah = Math.min(H * 0.86, aw * 1.3);
          back.push(path('arch', EXTRA_SHAPES.arch.d, EXTRA_SHAPES.arch.viewBox, W / 2 - aw / 2, H / 2 - ah / 2 + 20 * k, aw, ah, { fill: mix(pal.highlight, pal.bg, ctx.dark ? 0.88 : 0.7), stroke: mix(pal.primary, pal.bg, 0.45), strokeWidth: Math.max(2, Math.round(3 * k)), opacity: 0.8 }));
        }
        break;
      case 'swiss-grid': {
        // The column grid made visible: hairlines at every column edge.
        const cols = 6;
        for (let c = 0; c <= cols; c++) {
          const x = box.x + (box.w * c) / cols;
          back.push(line('swiss-grid', [x, 0, x, H], mix(pal.text, pal.bg, 0.9), Math.max(1, Math.round(1.5 * k))));
        }
        break;
      }
      case 'giant-circle': {
        const r = s.role === 'hook' || s.role === 'cta' ? W * 0.3 : W * 0.16;
        back.push(ellipse('giant-circle', W * 0.08, H + r * 0.15, r, r, pal.primary));
        break;
      }
      case 'vertical-label': {
        const text = (ctx.plan.title || 'Carousel').toUpperCase().slice(0, 32);
        const len = Math.round(H * 0.5);
        const t = label(ctx, 'vertical-label', text, 0, 0, len, { size: Math.round(22 * k), color: pal.mutedText, letterSpacing: Math.round(4 * k), weight: ctx.headline.weight, font: ctx.fonts.heading });
        const cx = W - margin.right / 2;
        t.x = Math.round(cx - len / 2);
        t.y = Math.round(H / 2 - t.height / 2);
        t.rotation = 90;
        t.autoFit = false;
        // Single line only, and only where the right margin can hold it.
        if (margin.right >= t.height * 1.6 && t.height <= Math.round(22 * k) * 1.4) back.push(t);
        break;
      }
      case 'masthead': {
        // Newspaper masthead in the top chrome strip: title, issue number, double rule.
        const size = Math.round(24 * k);
        const y = ctx.chromeTopY - size * 0.75;
        // On a split cover the masthead sits on the colored block: draw it on top, in the block's text color.
        const onBlock = layoutId === 'hook-split';
        const target = onBlock ? front : back;
        const ink = onBlock ? ctx.onPrimary : pal.text;
        target.push(label(ctx, 'masthead-title', (ctx.plan.title || '').toUpperCase(), box.x, y, box.w * 0.7, { size, color: ink, letterSpacing: Math.round(3 * k), weight: ctx.headline.weight, font: ctx.fonts.heading }));
        target.push(label(ctx, 'masthead-issue', `No. ${String(index + 1).padStart(2, '0')} / ${String(ctx.total).padStart(2, '0')}`, box.x + box.w * 0.6, y, box.w * 0.4, { size, color: onBlock ? ctx.onPrimary : pal.mutedText, align: 'right', italic: true }));
        const ry = y + size * 1.7;
        target.push(line('masthead-rule', [box.x, ry, box.x + box.w, ry], ink, Math.max(1, Math.round(3 * k))));
        target.push(line('masthead-rule', [box.x, ry + 7 * k, box.x + box.w, ry + 7 * k], ink, Math.max(1, Math.round(1.2 * k))));
        break;
      }
      case 'paper-layers': {
        // Three stacked paper-cut hills along the bottom, each casting a soft shadow upward.
        const band = Math.max(H * 0.15, margin.bottom + 70 * k);
        const colors = [mix(pal.accent, pal.bg, 0.55), mix(pal.primary, pal.bg, 0.45), mix(pal.primary, pal.accent, 0.5)];
        for (let i = 0; i < 3; i++) {
          const h = band * (1 - i * 0.3);
          const hl = hills(W, h, 14 * k * (1 + (2 - i) * 0.3), W * (0.55 + i * 0.18), index * 1.7 + i * 2.1);
          back.push(path('paper-layer', hl.d, hl.viewBox, 0, H - h, W, h, { fill: colors[i], shadow: { color: '#000000', blur: 18 * k, offsetX: 0, offsetY: -5 * k, opacity: ctx.dark ? 0.45 : 0.2 } }));
        }
        break;
      }
      case 'paper-sun':
        if (s.role === 'hook' || s.role === 'cta' || s.role === 'stat') {
          const r = W * 0.1;
          back.push(ellipse('paper-sun', W * 0.06, H * 0.05, r, r, mix(pal.highlight, pal.bg, 0.15), { shadow: { color: '#000000', blur: 16 * k, offsetX: 4 * k, offsetY: 8 * k, opacity: 0.2 } }));
        }
        break;
      case 'clay-blobs': {
        // Puffy clay shapes: lit from the top-left, deep soft shadow below.
        const clay = (slot: string, el: SlideElement, color: string) =>
          Object.assign(el, {
            radial: { stops: [{ offset: 0, color: mix(color, '#FFFFFF', 0.55) }, { offset: 0.55, color }, { offset: 1, color: mix(color, '#000000', 0.08) }], cx: 0.3, cy: 0.25 },
            shadow: { color: mix(color, '#000000', 0.55), blur: 46 * k, offsetX: 0, offsetY: 22 * k, opacity: ctx.dark ? 0.5 : 0.3 },
            slot, name: slot,
          });
        const c1 = mix(pal.accent, pal.bg, 0.2);
        const c2 = mix(pal.highlight, pal.bg, 0.15);
        const c3 = mix(pal.primary, pal.bg, 0.35);
        const flip = index % 2 === 1;
        back.push(clay('clay-blob', ellipse('clay', flip ? W * 0.94 : W * 0.06, H * 0.96, W * 0.17, W * 0.17, c1), c1));
        back.push(clay('clay-pill', rect('clay', flip ? -W * 0.04 : W * 0.78, H * 0.02, W * 0.26, W * 0.11, c2, { cornerRadius: W * 0.055, rotation: flip ? 12 : -12 }), c2));
        if (s.role === 'hook' || s.role === 'cta') back.push(clay('clay-ball', ellipse('clay', flip ? W * 0.08 : W * 0.92, H * 0.5, W * 0.045, W * 0.045, c3), c3));
        break;
      }
      case 'vector-scene':
        if (s.role === 'hook' || s.role === 'cta') {
          const band = Math.max(H * 0.15, margin.bottom + 70 * k);
          const far = hills(W, band, 18 * k, W * 0.9, index + 0.5);
          const near = hills(W, band * 0.65, 14 * k, W * 0.6, index + 2.2);
          back.push(ellipse('vector-sun', W * 0.86, H - band * 0.95, W * 0.07, W * 0.07, pal.highlight));
          back.push(path('vector-hill', far.d, far.viewBox, 0, H - band, W, band, { fill: mix(pal.primary, pal.bg, 0.55) }));
          back.push(path('vector-hill', near.d, near.viewBox, 0, H - band * 0.65, W, band * 0.65, { fill: mix(pal.primary, pal.bg, 0.25) }));
          const cw = W * 0.14;
          back.push(path('vector-cloud', EXTRA_SHAPES.cloud.d, EXTRA_SHAPES.cloud.viewBox, W * 0.04, H * 0.03, cw, cw * 0.64, { fill: ctx.dark ? mix(pal.text, pal.bg, 0.7) : '#FFFFFF', opacity: 0.95 }));
        }
        break;
      case 'geo-shapes':
        if (s.role !== 'hook' && s.role !== 'cta') {
          // A small flat-vector cluster in the bottom-left corner.
          const u = W * 0.07;
          const x0 = -u * 0.3;
          const y0 = H - u * 1.4;
          back.push(ellipse('vector-shape', x0 + u, y0 + u * 0.6, u * 0.9, u * 0.9, mix(pal.accent, pal.bg, 0.15)));
          back.push(path('vector-shape', EXTRA_SHAPES.triangle.d, EXTRA_SHAPES.triangle.viewBox, x0 + u * 1.5, y0 + u * 0.3, u * 1.2, u * 1.2, { fill: mix(pal.primary, pal.bg, 0.2), rotation: 12 }));
          back.push(path('vector-shape', EXTRA_SHAPES.halfCircle.d, EXTRA_SHAPES.halfCircle.viewBox, x0 + u * 2.4, y0 + u * 1.05, u * 1.1, u * 0.55, { fill: mix(pal.highlight, pal.bg, 0.1) }));
        }
        break;
      case 'margin-line': {
        const x = Math.max(12 * k, box.x - Math.round(34 * k));
        back.push(line('margin-line', [x, 0, x, H], mix(pal.accent, pal.bg, 0.35), Math.max(1, Math.round(2.5 * k))));
        break;
      }
      case 'paper-clip':
        if (s.role === 'hook' || s.role === 'cta') back.push(path('paper-clip', EXTRA_SHAPES.paperClip.d, EXTRA_SHAPES.paperClip.viewBox, W * 0.62, -24 * k, 64 * k, 140 * k, { stroke: mix(pal.mutedText, pal.bg, 0.2), strokeWidth: Math.round(6 * k), rotation: 10 }));
        break;
      case 'spray-drips': {
        // A sprayed stripe along the top edge with paint dripping down (kept inside the top chrome strip).
        const rnd = seeded(index * 31 + 7);
        const top = Math.round(14 * k);
        back.push(rect('drip-band', 0, 0, W * 0.72, top, pal.primary));
        const maxLen = Math.max(30 * k, box.y - top - 24 * k);
        for (let i = 0; i < 7; i++) {
          const w = (8 + rnd() * 10) * k;
          const x = W * (0.03 + i * 0.1) + rnd() * 20 * k;
          const len = maxLen * (0.35 + rnd() * 0.65);
          back.push(path('drip', [`M0 0H${w.toFixed(1)}V${len.toFixed(1)}A${(w / 2).toFixed(1)} ${(w / 2).toFixed(1)} 0 0 1 0 ${len.toFixed(1)}Z`], [w, len + w / 2], x, top - 2, w, len + w / 2, { fill: pal.primary }));
        }
        break;
      }
      case 'spray-halo':
        if (headline) {
          // Soft spray-paint cloud behind the headline (radial fade to transparent).
          const size = Math.min(W * 1.1, Math.max(headline.width, headline.height) * 1.15);
          back.push(rect('spray-halo', headline.x + headline.width / 2 - size / 2, headline.y + headline.height / 2 - size / 2, size, size, 'transparent', {
            radial: { stops: [{ offset: 0, color: withAlpha(pal.accent, ctx.dark ? 0.3 : 0.2) }, { offset: 0.55, color: withAlpha(pal.accent, ctx.dark ? 0.12 : 0.08) }, { offset: 1, color: withAlpha(pal.accent, 0) }], cx: 0.5, cy: 0.5, r: 0.5 },
          }));
        }
        break;
      case 'paint-splat': {
        const rnd = seeded(index * 53 + 3);
        const sz = (s.role === 'hook' ? 0.3 : 0.2) * W;
        const sp = splat(rnd);
        back.push(path('splat', sp.d, sp.viewBox, -sz * 0.3, H - sz * 0.75, sz, sz, { fill: index % 2 ? pal.accent : pal.highlight, opacity: 0.9, rotation: Math.round(rnd() * 360) }));
        break;
      }
      case 'light-rays': {
        // Soft rays of light from above the top edge (Sunday light, stained glass).
        const cx = W * (index % 2 ? 0.7 : 0.3);
        const n = 7;
        const len = H * 0.95;
        for (let r = 0; r < n; r++) {
          const a = (-60 + (120 * r) / (n - 1)) * (Math.PI / 180);
          const w = W * 0.05;
          const x2 = cx + Math.sin(a) * len;
          const y2 = Math.cos(a) * len;
          const nx = Math.cos(a) * w;
          const ny = -Math.sin(a) * w;
          const d = `M${cx} -10 L${(x2 - nx).toFixed(1)} ${(y2 - ny).toFixed(1)} L${(x2 + nx).toFixed(1)} ${(y2 + ny).toFixed(1)} Z`;
          back.push(path('light-ray', [d], [W, H], 0, 0, W, H, { fill: ctx.dark ? pal.highlight : '#FFFFFF', opacity: ctx.dark ? 0.06 : 0.35 }));
        }
        break;
      }
      case 'stained-glass': {
        // Jewel-toned glass panes with dark leading, in two corners (clear of the text box).
        const rnd = seeded(ctx.seed + index * 13);
        const colors = [pal.primary, pal.accent, pal.highlight, mix(pal.primary, pal.accent, 0.5)];
        const lead = ctx.dark ? '#0A0A12' : pal.text;
        const pane = (cx: number, cy: number, r: number) => {
          const sides = 5 + Math.floor(rnd() * 3);
          const pts = Array.from({ length: sides }, (_, n) => {
            const a = (n / sides) * Math.PI * 2 + rnd() * 0.4;
            const rr = r * (0.75 + rnd() * 0.35);
            return `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
          });
          return `M${pts.join(' L')} Z`;
        };
        const cell = W * 0.075;
        const corners: [number, number][] = [[0, 0], [W, H]];
        corners.forEach(([ox, oy]) => {
          for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3 - gx; gy++) {
            const cx = ox === 0 ? cell * (gx + 0.5) * 1.6 : W - cell * (gx + 0.5) * 1.6;
            const cy = oy === 0 ? cell * (gy + 0.5) * 1.6 : H - cell * (gy + 0.5) * 1.6;
            if (!clear(cx - cell, cy - cell, cell * 2, cell * 2)) continue;
            back.push(path('glass-pane', [pane(cx, cy, cell)], [W, H], 0, 0, W, H, { fill: colors[(gx + gy + index) % colors.length], stroke: lead, strokeWidth: Math.round(5 * k), opacity: ctx.dark ? 0.85 : 0.7 }));
          }
        });
        break;
      }
      case 'ornament-divider':
        if (headline && s.role !== 'hook') {
          // A small symmetric flourish under the headline: line – diamond – line.
          const w = Math.min(260 * k, headline.width * 0.6);
          const cx = ctx.align === 'center' ? headline.x + headline.width / 2 : headline.x + w / 2;
          const y = headline.y + headline.height + Math.round(18 * k);
          const c = mix(pal.primary, pal.bg, 0.2);
          back.push(line('ornament', [cx - w / 2, y, cx - 14 * k, y], c, Math.max(1, Math.round(2 * k))));
          back.push(line('ornament', [cx + 14 * k, y, cx + w / 2, y], c, Math.max(1, Math.round(2 * k))));
          back.push(path('ornament', ['M10 0 L20 10 L10 20 L0 10 Z'], [20, 20], cx - 9 * k, y - 9 * k, 18 * k, 18 * k, { fill: c }));
        }
        break;
      case 'verse-frame': {
        // Thin double frame with corner brackets (scripture cards).
        const inset = Math.round(30 * k);
        const c = mix(pal.primary, pal.bg, 0.35);
        back.push(rect('frame', inset, inset, W - 2 * inset, H - 2 * inset, 'transparent', { stroke: c, strokeWidth: Math.max(1, Math.round(2 * k)) }));
        back.push(rect('frame', inset + 10 * k, inset + 10 * k, W - 2 * inset - 20 * k, H - 2 * inset - 20 * k, 'transparent', { stroke: c, strokeWidth: Math.max(1, Math.round(1 * k)), opacity: 0.6 }));
        break;
      }
      case 'starfield': {
        const rnd = seeded(ctx.seed + index * 101);
        for (let n = 0; n < 26; n++) {
          const x = rnd() * W;
          const y = rnd() * H * 0.55;
          const r = (1.5 + rnd() * 3.5) * k;
          if (!clear(x - r, y - r, 2 * r, 2 * r)) continue;
          const star = ellipse('star', x, y, r, r, n % 5 === 0 ? pal.highlight : '#FFFFFF', { opacity: 0.5 + rnd() * 0.5 });
          star.anim = { enter: 'fade', delay: rnd() * 1.5, duration: 0.6, loop: 'twinkle', phase: rnd() * 3 };
          back.push(star);
        }
        break;
      }
      case 'candle-glow': {
        const r = W * 0.45;
        back.push(rect('candle-glow', W / 2 - r, H - r * 0.9, 2 * r, 2 * r, 'transparent', {
          radial: { stops: [{ offset: 0, color: withAlpha(pal.highlight, ctx.dark ? 0.32 : 0.25) }, { offset: 1, color: withAlpha(pal.highlight, 0) }], cx: 0.5, cy: 0.5, r: 0.5 },
        }));
        break;
      }
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

/** #RRGGBB + alpha → rgba() (gradient stops that fade to transparent). */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function safeAccent(ctx: Ctx) {
  return ctx.pal.accent;
}

/**
 * Decorations defined in panorama coordinates (count × W wide) and sliced per slide, so shapes cross
 * slide seams and the carousel reads as one continuous canvas when swiped.
 */
export function panoramicSlice(ctx: Ctx, index: number): SlideElement[] {
  const { W, H, k, pal, total, margin } = ctx;
  const out: SlideElement[] = [];
  const kind = ctx.mod.continuous ?? 'flow';
  const faint = (c: string, t: number) => mix(c, pal.bg, ctx.dark ? t - 0.15 : t);
  // Everything below is drawn in panorama coordinates (total × W wide) and shifted by -index × W,
  // so each slide shows its window of one continuous drawing and shapes line up at every seam.
  const shift = -index * W;
  if (kind === 'flow') {
    const seamShape = ctx.style.layout.decorations.includes('bleed-shape') || ctx.style.layout.swipeCue.style === 'bleed-shape';
    // Circles centered on every seam: right half shows on slide i, left half on slide i+1.
    for (let seam = 1; seam < total; seam++) {
      if (seam !== index && seam !== index + 1) continue;
      const r = (seamShape ? 0.2 : 0.14) * W;
      const cy = seam % 2 ? H * 0.22 : H * 0.8;
      out.push(ellipse('seam-shape', seam * W + shift, cy, r, r, faint(pal.primary, 0.7), { opacity: 0.6 }));
    }
    const wv = wave(W * total, 14 * k, W * 0.6);
    out.push(path('panorama-line', wv.d, wv.viewBox, shift, H - margin.bottom * 0.55 - 14 * k, W * total, 28 * k, { stroke: mix(pal.primary, pal.bg, 0.35), strokeWidth: Math.round(4 * k), opacity: 0.8 }));
  } else if (kind === 'ribbon') {
    // A wide band that weaves from top to bottom across the whole carousel.
    const pts: string[] = [];
    const band = H * 0.11;
    const yAt = (x: number) => H * (0.5 + 0.32 * Math.sin((x / (W * 1.6)) * Math.PI));
    const step = W / 8;
    for (let x = 0; x <= W * total; x += step) pts.push(`${x.toFixed(1)} ${(yAt(x) - band / 2).toFixed(1)}`);
    const back: string[] = [];
    for (let x = W * total; x >= 0; x -= step) back.push(`${x.toFixed(1)} ${(yAt(x) + band / 2).toFixed(1)}`);
    const d = `M${pts.join(' L')} L${back.join(' L')} Z`;
    out.push(path('panorama-ribbon', [d], [W * total, H], shift, 0, W * total, H, { fill: faint(pal.primary, 0.78), opacity: 0.55 }));
  } else if (kind === 'path') {
    // A dashed journey route with one stop per slide (good for steps, timelines, stories).
    // Along the bottom edge of the content area, above the slide-number / swipe strip.
    const base = ctx.box.y + ctx.box.h;
    const yAt = (i: number) => base + (i % 2 ? 10 : -14) * k;
    const xs = Array.from({ length: total }, (_, i) => i * W + W * 0.5);
    const points = [0, yAt(0), ...xs.flatMap((x, i) => [x, yAt(i)]), W * total, yAt(total - 1)].map((v, i) => (i % 2 === 0 ? v + shift : v));
    out.push(line('panorama-route', points, faint(pal.primary, 0.45), Math.max(2, Math.round(5 * k)), { dash: [18 * k, 14 * k] }));
    xs.forEach((x, i) => {
      if (Math.abs(i - index) > 1) return;
      const r = 16 * k;
      out.push(ellipse('route-stop', x + shift, yAt(i), r, r, i === index ? pal.accent : faint(pal.accent, 0.5)));
    });
  } else if (kind === 'blocks') {
    // Big shapes cut in half by each seam, alternating colors and positions.
    for (let seam = 1; seam < total; seam++) {
      if (seam !== index && seam !== index + 1) continue;
      const top = seam % 2 === 1;
      const size = W * 0.36;
      const color = faint(seam % 3 === 0 ? pal.accent : seam % 3 === 1 ? pal.primary : pal.highlight, 0.72);
      const x = seam * W + shift - size / 2;
      const y = top ? -size * 0.35 : H - size * 0.65;
      out.push(seam % 2 ? rect('seam-block', x, y, size, size, color, { opacity: 0.7, cornerRadius: size * 0.18, rotation: 0 }) : ellipse('seam-block', x + size / 2, y + size / 2, size / 2, size / 2, color, { opacity: 0.7 }));
    }
  } else {
    // The carousel's title as one giant outlined word running across every slide.
    const word = (ctx.plan.title || ctx.plan.slides[0]?.headline || '').toUpperCase();
    // Size the word so it runs across (almost) the whole carousel, capped by the slide height.
    const at100 = measure(word, { fontId: ctx.fonts.heading, size: 100, weight: 800, italic: false, letterSpacing: 0 });
    const size = Math.round(Math.min(H * 0.8, Math.max(H * 0.3, ((W * total * 0.9) / Math.max(1, at100)) * 100)));
    out.push({
      ...textEl({ slot: 'panorama-word', text: word, font: ctx.fonts.heading, weight: 800, max: size, min: size, lineHeight: 1, color: 'transparent' }, Math.round(shift + W * total * 0.05), Math.round(H * 0.5 - size * 0.55), Math.round(W * total), Math.round(size * 1.1), size, 0, 'left'),
      stroke: { color: faint(pal.text, 0.8), width: Math.max(2, Math.round(3 * k)) },
      autoFit: false,
      opacity: 0.6,
    } as TextElement);
  }
  return out;
}
