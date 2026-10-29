// The layout catalog (research/styles.json → layoutCatalog). Each layout places a slide's content inside
// the safe box; backgrounds, decorations and chrome are added by the engine around it.
import type { SlideElement, TextElement } from '@/model/types';
import { contrast, mix } from '@/styles/color';
import { getIcon, iconForKeywords, iconsLoaded } from '@/styles/icons';
import type { SlidePlan } from '../schema';
import type { Box, Ctx } from './context';
import { ellipse, fitStack, label, line, measureSpec, path, rect, textEl, type TextSpec } from './primitives';
import { SHAPES } from './shapes';

export interface LayoutResult { elements: SlideElement[]; overflow: boolean }
export type LayoutFn = (ctx: Ctx, s: SlidePlan, index: number) => LayoutResult;

// ---------- text spec helpers ----------

function headSpec(ctx: Ctx, s: SlidePlan, text: string, max: number, extra: Partial<TextSpec> = {}): TextSpec {
  return {
    slot: 'headline', text, font: ctx.fonts.heading, weight: ctx.headline.weight, max, min: Math.min(max, ctx.sizes.minHead),
    lineHeight: ctx.headline.lineHeight, color: ctx.pal.text, textCase: ctx.headline.textCase,
    letterSpacing: ctx.headline.tracking * max, emphasis: s.emphasis.length ? { ...ctx.emphasis, words: s.emphasis } : undefined,
    gapAfter: 0.42, rotation: ctx.headline.rotateDeg, ...headlineEffect(ctx), ...extra,
  };
}

/** Style-specific headline treatment (styles.json layout.headline.effect). */
function headlineEffect(ctx: Ctx): Partial<TextSpec> {
  const { k, pal } = ctx;
  if (ctx.mod.decoration === 'none') return {};
  switch (ctx.style.layout.headline.effect) {
    case 'spray': // Graffiti: a soft spray-paint glow around the letters.
      return { shadow: { color: pal.primary, blur: Math.round(26 * k), offsetX: 0, offsetY: 0, opacity: ctx.dark ? 0.9 : 0.55 } };
    case 'clay': // Puffy clay letters: a short soft shadow underneath.
      return { shadow: { color: '#000000', blur: Math.round(10 * k), offsetX: 0, offsetY: Math.round(6 * k), opacity: 0.18 } };
    case 'paper': // Cut-paper letters lifted off the page.
      return { shadow: { color: '#000000', blur: Math.round(6 * k), offsetX: Math.round(3 * k), offsetY: Math.round(5 * k), opacity: 0.2 } };
    case 'offset': // Maximalist hard offset shadow in the accent color.
      return { shadow: { color: pal.accent, blur: 0, offsetX: Math.round(6 * k), offsetY: Math.round(6 * k), opacity: 0.9 } };
    default:
      return {};
  }
}

function bodySpec(ctx: Ctx, text: string, slot = 'body', extra: Partial<TextSpec> = {}): TextSpec {
  return {
    slot, text, font: ctx.fonts.body, weight: ctx.body.weight, max: ctx.sizes.body, min: ctx.sizes.minBody,
    lineHeight: ctx.body.lineHeight, color: slot === 'subline' ? ctx.pal.mutedText : ctx.pal.text, gapAfter: 0.8, ...extra,
  };
}

function kickerText(ctx: Ctx, index: number): string | null {
  const d = ctx.style.layout.decorations;
  if (ctx.decoration === 'none') return null;
  const n = String(index).padStart(2, '0');
  if (d.includes('code-tag')) return `// ${n}`;
  if (d.includes('terminal-prompt')) return `> ${n}`;
  if (d.includes('kicker-label') || d.includes('small-caps-kicker')) return `No. ${n}`;
  return null;
}

function kickerSpec(ctx: Ctx, text: string): TextSpec {
  const mono = ctx.style.layout.decorations.some((x) => x === 'code-tag' || x === 'terminal-prompt');
  return {
    slot: 'kicker', text, font: mono ? ctx.fonts.accent : ctx.fonts.body, weight: ctx.body.weight, max: ctx.sizes.small, min: ctx.sizes.small,
    lineHeight: 1.3, color: ctx.accentText, textCase: 'upper', letterSpacing: 3 * ctx.k, gapAfter: 0.9,
  };
}

const shift = (els: SlideElement[], dy: number) => els.forEach((e) => (e.y += Math.round(dy)));
const bottomOf = (els: SlideElement[]) => els.reduce((m, e) => Math.max(m, e.y + e.height), 0);
const topOf = (els: SlideElement[]) => els.reduce((m, e) => Math.min(m, e.y), Infinity);

/** Vertically centers a group of elements inside a box (used after composing multi-part layouts). */
function centerIn(els: SlideElement[], box: Box) {
  if (!els.length) return;
  const t = topOf(els);
  const h = bottomOf(els) - t;
  shift(els, box.y + Math.max(0, (box.h - h) / 2) - t);
}

// ---------- list rows ----------

type Marker = 'dot' | 'number' | 'check' | 'dash';

/** Bullet rows with drawn markers; all rows share one font size, fitted to the region. */
function rows(ctx: Ctx, items: string[], region: Box, marker: Marker, opts: { separators?: boolean; startAt?: number } = {}): LayoutResult {
  const { pal, k } = ctx;
  let size = Math.round(ctx.sizes.body * 0.98);
  const min = ctx.sizes.minBody;
  const lh = Math.max(1.3, ctx.body.lineHeight - 0.05);
  for (let iter = 0; iter < 30; iter++) {
    const markerW = marker === 'number' ? size * 1.9 : size * 1.25;
    const gap = Math.round(size * (opts.separators ? 0.9 : 0.6));
    const textW = region.w - markerW;
    const specs = items.map((t): TextSpec => ({ slot: 'bullet', text: t, font: ctx.fonts.body, weight: ctx.body.weight, max: size, min: size, lineHeight: lh, color: pal.text }));
    const heights = specs.map((sp) => Math.ceil(measureSpec(sp, size, textW).height));
    const total = heights.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    if (total <= region.h || size <= min) {
      const els: SlideElement[] = [];
      let y = region.y;
      specs.forEach((sp, i) => {
        const lineH = size * lh;
        const cy = y + lineH / 2;
        const mx = region.x;
        if (marker === 'dot') els.push(ellipse('bullet-marker', mx + size * 0.3, cy, size * 0.17, size * 0.17, pal.primary));
        else if (marker === 'dash') els.push(rect('bullet-marker', mx, cy - 2 * k, size * 0.6, 4 * k, pal.primary));
        else if (marker === 'check') {
          const b = size * 0.82;
          els.push(rect('bullet-marker', mx, cy - b / 2, b, b, 'transparent', { stroke: pal.primary, strokeWidth: Math.max(2, 3 * k), cornerRadius: b * 0.22 }));
          els.push(path('bullet-check', SHAPES.check.d, SHAPES.check.viewBox, mx + b * 0.12, cy - b * 0.38, b * 0.76, b * 0.76, { stroke: pal.primary, strokeWidth: Math.max(2, 3.5 * k) }));
        } else {
          els.push(textEl({ slot: 'bullet-number', text: String((opts.startAt ?? 1) + i).padStart(2, '0'), font: ctx.fonts.heading, weight: ctx.headline.weight, max: size, min: size, lineHeight: lh, color: ctx.accentText }, mx, Math.round(y), Math.round(markerW), Math.ceil(lineH), size, 0, 'left'));
        }
        els.push(textEl(sp, Math.round(region.x + markerW), Math.round(y), Math.round(textW), heights[i]!, size, 0, 'left'));
        y += heights[i]!;
        if (opts.separators && i < specs.length - 1) {
          els.push(line('row-separator', [region.x, y + gap / 2, region.x + region.w, y + gap / 2], mix(pal.text, pal.bg, 0.8), Math.max(1, 2 * k)));
        }
        y += gap;
      });
      return { elements: els, overflow: total > region.h + 1 };
    }
    size = Math.max(min, Math.round(size * 0.94));
  }
  return { elements: [], overflow: true };
}

const listMarker = (ctx: Ctx, layoutId: string): Marker =>
  layoutId === 'list-numbered-rows' ? 'number' : layoutId === 'list-checklist' ? 'check' : ctx.style.layout.decorations.includes('brand-bar') ? 'dash' : 'dot';

// ---------- shared compositions ----------

/** Headline (+kicker) on top, then body and/or rows; whole group positioned by valign. */
function standard(ctx: Ctx, s: SlidePlan, index: number, opts: { valign: 'top' | 'middle'; align: TextElement['align']; marker?: Marker; region?: Box; headMax?: number }): LayoutResult {
  const region = opts.region ?? ctx.box;
  const kick = kickerText(ctx, index);
  const specs: TextSpec[] = [];
  if (kick) specs.push(kickerSpec(ctx, kick));
  if (s.headline) specs.push(headSpec(ctx, s, s.headline, opts.headMax ?? ctx.sizes.head));
  if (s.body) specs.push(bodySpec(ctx, s.body));
  const hasRows = s.bullets.length > 0;
  const headRegion = hasRows ? { ...region, h: Math.round(region.h * 0.42) } : region;
  const head = fitStack(specs, headRegion, 'top', opts.align);
  const els: SlideElement[] = [...head.elements];
  let overflow = head.overflow;
  if (hasRows) {
    const top = head.elements.length ? bottomOf(head.elements) + Math.round(ctx.sizes.body * 0.9) : region.y;
    const r = rows(ctx, s.bullets, { x: region.x, y: top, w: region.w, h: region.y + region.h - top }, opts.marker ?? 'dot');
    els.push(...r.elements);
    overflow ||= r.overflow;
  }
  if (opts.valign === 'middle') centerIn(els, region);
  return { elements: els, overflow };
}

function iconChip(ctx: Ctx, s: SlidePlan, x: number, y: number, size: number, align: TextElement['align']): SlideElement[] {
  if (!iconsLoaded()) return [];
  const icon = iconForKeywords(s.iconKeywords.length ? s.iconKeywords : [s.headline]) ?? getIcon('sparkles');
  if (!icon) return [];
  const cx = align === 'center' ? x - size / 2 : x;
  const bg = mix(ctx.pal.primary, ctx.pal.bg, ctx.dark ? 0.75 : 0.85);
  return [
    rect('icon-chip', cx, y, size, size, bg, { cornerRadius: size * 0.28 }),
    path('icon', icon.d, [24, 24], cx + size * 0.22, y + size * 0.22, size * 0.56, size * 0.56, { stroke: ctx.accentText, strokeWidth: Math.max(2, 4 * ctx.k) }),
  ];
}

// ---------- layouts ----------

const hookGiantType: LayoutFn = (ctx, s) => {
  const r = fitStack(
    [headSpec(ctx, s, s.headline, Math.round(ctx.sizes.hook * 1.12), { min: Math.round(72 * ctx.k), gapAfter: 0.35 }), bodySpec(ctx, s.body, 'subline', { max: Math.round(48 * ctx.k) })],
    ctx.box,
    ctx.align === 'center' ? 'middle' : 'bottom',
    ctx.align,
  );
  // Left-aligned giant type sits in the lower-middle third so the top breathes (never above the box).
  if (ctx.align !== 'center' && r.elements.length) shift(r.elements, -Math.min(Math.round(ctx.box.h * 0.12), topOf(r.elements) - ctx.box.y));
  return r;
};

const hookCentered: LayoutFn = (ctx, s) =>
  fitStack([headSpec(ctx, s, s.headline, ctx.sizes.hook), bodySpec(ctx, s.body, 'subline', { max: Math.round(48 * ctx.k) })], ctx.box, 'middle', ctx.align === 'left' ? 'left' : 'center');

const hookSplit: LayoutFn = (ctx, s) => {
  const { W, H, pal, margin } = ctx;
  const splitY = Math.round(H * 0.58);
  const els: SlideElement[] = [rect('split-block', 0, 0, W, splitY, pal.primary)];
  const headRegion = { x: ctx.box.x, y: ctx.box.y, w: ctx.box.w, h: splitY - ctx.box.y - Math.round(48 * ctx.k) };
  // The headline sits on the primary block: an emphasis color that vanishes there (e.g. italic in the
  // primary color) switches to a readable one.
  const onBlock = (c: string) => (contrast(c, pal.primary) >= 3 ? c : contrast(pal.bg, pal.primary) >= 3 ? pal.bg : ctx.onPrimary);
  const em = s.emphasis.length
    ? { ...ctx.emphasis, words: s.emphasis, ...(ctx.emphasis.style === 'color' ? { color: onBlock(pal.bg) } : ctx.emphasis.style === 'highlight' || ctx.emphasis.style === 'box' ? {} : { color: onBlock(ctx.emphasis.color) }) }
    : undefined;
  const head = fitStack([headSpec(ctx, s, s.headline, ctx.sizes.hook, { color: ctx.onPrimary, emphasis: contrast(ctx.onPrimary, pal.primary) >= 4.5 ? em : undefined })], headRegion, 'bottom', 'left');
  els.push(...head.elements);
  const sub = fitStack([bodySpec(ctx, s.body, 'subline', { max: Math.round(50 * ctx.k), color: pal.text })], { x: ctx.box.x, y: splitY + Math.round(56 * ctx.k), w: ctx.box.w, h: H - margin.bottom - splitY - Math.round(140 * ctx.k) }, 'top', 'left');
  els.push(...sub.elements);
  return { elements: els, overflow: head.overflow || sub.overflow };
};

const NUM_RE = /^(\D{0,3}?)(\d+(?:[.,]\d+)?%?)\s*(.*)$/;

const hookNumber: LayoutFn = (ctx, s, i) => {
  const m = NUM_RE.exec(s.headline);
  if (!m || m[2]!.length > 4) return hookGiantType(ctx, s, i);
  const num = m[2]!;
  const rest = `${m[1] ?? ''}${m[3] ?? ''}`.trim();
  const numSize = Math.round(Math.min(ctx.box.h * 0.42, 380 * ctx.k * ctx.headline.scale));
  const numSpec: TextSpec = { slot: 'hook-number', text: num, font: ctx.fonts.heading, weight: ctx.headline.weight, max: numSize, min: Math.round(numSize * 0.6), lineHeight: 0.92, color: ctx.accentText, letterSpacing: -0.04 * numSize, gapAfter: 0.12 };
  const r = fitStack([numSpec, headSpec(ctx, { ...s, emphasis: s.emphasis.filter((w) => w !== num) }, rest, ctx.sizes.hook), bodySpec(ctx, s.body, 'subline', { max: Math.round(46 * ctx.k) })], ctx.box, 'middle', ctx.align);
  return r;
};

const hookTweet: LayoutFn = (ctx, s, i) => {
  const { k, pal, box } = ctx;
  const avatar = Math.round(96 * k);
  const name = ctx.handle ? ctx.handle.replace(/^@/, '') : 'Your Name';
  const handle = ctx.handle ? (ctx.handle.startsWith('@') ? ctx.handle : `@${ctx.handle}`) : '@yourhandle';
  const header: SlideElement[] = [
    ellipse('avatar', box.x + avatar / 2, 0, avatar / 2, avatar / 2, mix(pal.primary, pal.bg, 0.3)),
    label(ctx, 'avatar-initial', name[0]!.toUpperCase(), box.x, 0, avatar, { size: Math.round(avatar * 0.45), color: ctx.onPrimary, weight: ctx.headline.weight, align: 'center', font: ctx.fonts.heading }),
    label(ctx, 'author-name', name, box.x + avatar + 24 * k, 0, box.w - avatar, { size: Math.round(36 * k), color: pal.text, weight: ctx.headline.weight, font: ctx.fonts.heading }),
    label(ctx, 'author-handle', handle, box.x + avatar + 24 * k, 0, box.w - avatar, { size: Math.round(32 * k), color: pal.mutedText }),
  ];
  // position header row: avatar centered at row center
  header[0]!.y = 0;
  header[1]!.y = Math.round(avatar / 2 - header[1]!.height / 2);
  header[2]!.y = Math.round(avatar * 0.08);
  header[3]!.y = Math.round(avatar * 0.08 + header[2]!.height + 4 * k);
  if (ctx.style.layout.decorations.includes('verified-badge-generic')) {
    header.push(path('verified', SHAPES.verified.d, SHAPES.verified.viewBox, box.x + avatar + 24 * k + Math.min(box.w * 0.6, name.length * 20 * k) + 12 * k, avatar * 0.1, 34 * k, 34 * k, { fill: pal.primary }));
  }
  const text = [s.headline, s.body, ...s.bullets.map((b) => `• ${b}`), s.quote ? `“${s.quote.text}”` : '', s.stat ? `${s.stat.value} ${s.stat.label}` : ''].filter(Boolean).join('\n\n');
  const textTop = avatar + Math.round(40 * k);
  const body = fitStack([{ ...bodySpec(ctx, text, 'tweet-text'), max: Math.round(54 * k), lineHeight: 1.35, emphasis: s.emphasis.length ? { ...ctx.emphasis, words: s.emphasis } : undefined }], { x: box.x, y: textTop, w: box.w, h: box.h - textTop - Math.round(110 * k) }, 'top', 'left');
  const els = [...header, ...body.elements];
  if (ctx.style.layout.decorations.includes('metrics-row') && ctx.decoration !== 'none') {
    const my = bottomOf(body.elements) + Math.round(48 * k);
    els.push(line('metrics-divider', [box.x, my, box.x + box.w, my], mix(pal.text, pal.bg, 0.85), Math.max(1, 2 * k)));
    const icons = [SHAPES.comment, SHAPES.share, SHAPES.heart, SHAPES.bookmark];
    icons.forEach((ic, n) => els.push(path('metric-icon', ic.d, ic.viewBox, box.x + n * (box.w / 4), my + 28 * k, 40 * k, 40 * k, { stroke: pal.mutedText, strokeWidth: Math.max(2, 3 * k) })));
  }
  centerIn(els, box);
  void i;
  return { elements: els, overflow: body.overflow };
};

const bodyTopLeft: LayoutFn = (ctx, s, i) => standard(ctx, s, i, { valign: 'top', align: ctx.align === 'center' ? 'left' : ctx.align, marker: 'dot' });

const bodyCentered: LayoutFn = (ctx, s, i) => standard(ctx, s, i, { valign: 'middle', align: 'center', marker: 'dot' });

const bodyCard: LayoutFn = (ctx, s, i) => {
  const { pal, k, box } = ctx;
  const pad = Math.round(64 * k);
  const decos = ctx.style.layout.decorations;
  const glass = decos.includes('glass-panel');
  const brutal = decos.includes('hard-shadow') || decos.includes('outline-offset-shadow');
  const windowChrome = decos.includes('window-chrome');
  const chromeH = windowChrome ? Math.round(64 * k) : 0;
  const inner = { x: box.x + pad, y: box.y + pad + chromeH, w: box.w - 2 * pad, h: box.h - 2 * pad - chromeH };
  const content = standard(ctx, s, i, { valign: 'top', align: ctx.align, region: inner, marker: 'dot', headMax: Math.round(ctx.sizes.head * 0.92) });
  const cTop = content.elements.length ? topOf(content.elements) : inner.y;
  const cBottom = content.elements.length ? bottomOf(content.elements) : inner.y;
  const cardH = Math.min(box.h, cBottom - cTop + 2 * pad + chromeH);
  const cardY = box.y + (box.h - cardH) / 2;
  shift(content.elements, cardY + pad + chromeH - cTop);
  const clay = decos.includes('clay-card');
  const paper = decos.includes('paper-layers');
  const radius = brutal ? 0 : clay ? Math.round(64 * k) : paper ? Math.round(10 * k) : Math.round(36 * k);
  const fill = glass ? (ctx.dark ? '#FFFFFF' : '#FFFFFF') : pal.surface;
  const card = rect('card', box.x, cardY, box.w, cardH, fill, {
    cornerRadius: radius,
    opacity: glass ? (ctx.dark ? 0.12 : 0.55) : 1,
    stroke: brutal ? pal.text : glass ? '#FFFFFF' : undefined,
    strokeWidth: brutal ? Math.round(5 * k) : glass ? Math.max(1, 2 * k) : undefined,
    shadow: brutal
      ? undefined
      : clay
        ? { color: mix(pal.primary, '#000000', 0.35), blur: 60 * k, offsetX: 0, offsetY: 26 * k, opacity: ctx.dark ? 0.45 : 0.22 }
        : paper
          ? { color: '#000000', blur: 18 * k, offsetX: 6 * k, offsetY: 10 * k, opacity: ctx.dark ? 0.4 : 0.18 }
          : { color: '#000000', blur: 40 * k, offsetX: 0, offsetY: 14 * k, opacity: ctx.dark ? 0.35 : 0.1 },
  });
  const els: SlideElement[] = [];
  if (brutal) els.push(rect('card-shadow', box.x + 16 * k, cardY + 16 * k, box.w, cardH, pal.text));
  els.push(card);
  if (windowChrome) {
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, n) => els.push(ellipse('window-dot', box.x + pad + n * 34 * k, cardY + pad * 0.75, 10 * k, 10 * k, c)));
  }
  els.push(...content.elements);
  return { elements: els, overflow: content.overflow || cBottom - cTop + 2 * pad + chromeH > box.h };
};

const bodyTwoColumn: LayoutFn = (ctx, s, i) => {
  if (!ctx.isLandscape && ctx.W / ctx.H < 0.95) return bodyTopLeft(ctx, s, i);
  const { box, k } = ctx;
  const gap = Math.round(64 * k);
  const leftW = Math.round((box.w - gap) * 0.45);
  const kick = kickerText(ctx, i);
  const left = fitStack([...(kick ? [kickerSpec(ctx, kick)] : []), headSpec(ctx, s, s.headline, ctx.sizes.head)], { x: box.x, y: box.y, w: leftW, h: box.h }, 'middle', 'left');
  const rightRegion = { x: box.x + leftW + gap, y: box.y, w: box.w - leftW - gap, h: box.h };
  const right = s.bullets.length ? rows(ctx, s.bullets, rightRegion, 'dot') : fitStack([bodySpec(ctx, s.body)], rightRegion, 'middle', 'left');
  if (s.bullets.length) centerIn(right.elements, rightRegion);
  const divider = line('column-rule', [box.x + leftW + gap / 2, box.y + box.h * 0.2, box.x + leftW + gap / 2, box.y + box.h * 0.8], mix(ctx.pal.text, ctx.pal.bg, 0.75), Math.max(1, 2 * k));
  return { elements: [...left.elements, divider, ...right.elements], overflow: left.overflow || right.overflow };
};

const bodyIconTop: LayoutFn = (ctx, s, i) => {
  const size = Math.round(132 * ctx.k);
  const align = ctx.align;
  const region = { ...ctx.box, y: ctx.box.y + size + Math.round(48 * ctx.k), h: ctx.box.h - size - Math.round(48 * ctx.k) };
  const content = standard(ctx, s, i, { valign: 'top', align, region, marker: 'dot' });
  const chipX = align === 'center' ? ctx.box.x + ctx.box.w / 2 : ctx.box.x;
  const chip = iconChip(ctx, s, chipX, ctx.box.y, size, align);
  const els = [...chip, ...content.elements];
  centerIn(els, ctx.box);
  return { elements: els, overflow: content.overflow };
};

const listLayout = (id: string): LayoutFn => (ctx, s, i) => {
  const items = s.bullets.length ? s.bullets : s.body ? [s.body] : [];
  const sep = id === 'list-numbered-rows';
  const kick = kickerText(ctx, i);
  const head = fitStack([...(kick ? [kickerSpec(ctx, kick)] : []), headSpec(ctx, s, s.headline, ctx.sizes.head)], { ...ctx.box, h: Math.round(ctx.box.h * 0.38) }, 'top', ctx.align === 'center' ? 'center' : 'left');
  const top = head.elements.length ? bottomOf(head.elements) + Math.round(56 * ctx.k) : ctx.box.y;
  const r = rows(ctx, items, { x: ctx.box.x, y: top, w: ctx.box.w, h: ctx.box.y + ctx.box.h - top }, listMarker(ctx, id), { separators: sep });
  const els = [...head.elements, ...r.elements];
  if (ctx.align === 'center') centerIn(els, ctx.box);
  return { elements: els, overflow: head.overflow || r.overflow };
};

const STEP_RE = /^(?:step\s*)?(\d+)[.):\s-]+\s*(.*)$/i;

const stepBigNumber: LayoutFn = (ctx, s, i) => {
  const m = STEP_RE.exec(s.headline);
  const num = m ? m[1]! : String(i);
  const title = m ? m[2]! : s.headline;
  const numSize = Math.round(Math.min(ctx.box.h * 0.32, 300 * ctx.k));
  const specs: TextSpec[] = [
    { slot: 'step-number', text: num.padStart(2, '0'), font: ctx.fonts.heading, weight: ctx.headline.weight, max: numSize, min: Math.round(numSize * 0.6), lineHeight: 0.95, color: ctx.accentText, letterSpacing: -0.03 * numSize, gapAfter: 0.18 },
    headSpec(ctx, s, title, ctx.sizes.head),
    bodySpec(ctx, s.body),
  ];
  const r = fitStack(specs, ctx.box, ctx.align === 'center' ? 'middle' : 'top', ctx.align);
  if (s.bullets.length) {
    const top = bottomOf(r.elements) + Math.round(40 * ctx.k);
    const rr = rows(ctx, s.bullets, { x: ctx.box.x, y: top, w: ctx.box.w, h: ctx.box.y + ctx.box.h - top }, 'check');
    return { elements: [...r.elements, ...rr.elements], overflow: r.overflow || rr.overflow };
  }
  return r;
};

const stepTimeline: LayoutFn = (ctx, s, i) => {
  const { k, pal, box } = ctx;
  const railX = box.x + Math.round(28 * k);
  const contentX = box.x + Math.round(96 * k);
  const m = STEP_RE.exec(s.headline);
  const title = m ? m[2]! : s.headline;
  const region = { x: contentX, y: box.y, w: box.w - (contentX - box.x), h: box.h };
  const stepLabel: TextSpec = { slot: 'step-label', text: `Step ${m ? m[1] : i}`, font: ctx.fonts.body, weight: ctx.body.weight, max: ctx.sizes.small, min: ctx.sizes.small, lineHeight: 1.3, color: ctx.accentText, textCase: 'upper', letterSpacing: 3 * k, gapAfter: 0.8 };
  const r = fitStack([stepLabel, headSpec(ctx, s, title, ctx.sizes.head), bodySpec(ctx, s.body)], region, 'middle', 'left');
  const els: SlideElement[] = [line('timeline-rail', [railX, 0, railX, ctx.H], mix(pal.primary, pal.bg, 0.55), Math.round(6 * k))];
  const nodeY = r.elements[0] ? r.elements[0].y + r.elements[0].height / 2 : box.y + box.h / 2;
  els.push(ellipse('timeline-node', railX, nodeY, 22 * k, 22 * k, pal.primary, { stroke: pal.bg, strokeWidth: Math.round(8 * k) }));
  els.push(...r.elements);
  if (s.bullets.length) {
    const top = bottomOf(r.elements) + Math.round(32 * k);
    const rr = rows(ctx, s.bullets, { x: contentX, y: top, w: region.w, h: box.y + box.h - top }, 'check');
    els.push(...rr.elements);
  }
  return { elements: els, overflow: r.overflow };
};

const statHero: LayoutFn = (ctx, s, i) => {
  if (!s.stat) return standard(ctx, s, i, { valign: 'middle', align: ctx.align });
  const value: TextSpec = { slot: 'stat-value', text: s.stat.value, font: ctx.fonts.heading, weight: ctx.headline.weight, max: ctx.sizes.stat, min: Math.round(ctx.sizes.stat * 0.5), lineHeight: 1, color: ctx.accentText, letterSpacing: -0.03 * ctx.sizes.stat, gapAfter: 0.15 };
  const specs: TextSpec[] = [value, bodySpec(ctx, s.stat.label, 'stat-label', { max: Math.round(50 * ctx.k), weight: ctx.headline.weight > 600 ? ctx.body.weight : ctx.body.weight })];
  if (s.headline && s.headline !== s.stat.label) specs.unshift({ ...kickerSpec(ctx, s.headline), slot: 'stat-title', textCase: 'none', letterSpacing: 0, max: Math.round(40 * ctx.k), min: ctx.sizes.minBody, color: ctx.pal.mutedText });
  if (s.body) specs.push(bodySpec(ctx, s.body, 'body', { max: Math.round(40 * ctx.k), color: ctx.pal.mutedText }));
  return fitStack(specs, ctx.box, 'middle', ctx.align);
};

const statChart: LayoutFn = (ctx, s, i) => {
  const pct = s.stat ? /^(\d+(?:\.\d+)?)%$/.exec(s.stat.value.trim()) : null;
  const r = statHero(ctx, s, i);
  if (!pct) return r;
  // Percentage → progress bar under the number (a real chart arrives with the Phase 3 chart element).
  const { k, pal, box } = ctx;
  const v = Math.min(100, Number(pct[1])) / 100;
  const valueEl = r.elements.find((e) => e.slot === 'stat-value');
  if (!valueEl) return r;
  const barH = Math.round(28 * k);
  const barY = valueEl.y + valueEl.height + Math.round(20 * k);
  const below = r.elements.filter((e) => e.y > valueEl.y);
  shift(below, barH + Math.round(40 * k));
  const els = [...r.elements, rect('bar-track', box.x, barY, box.w, barH, mix(pal.primary, pal.bg, 0.8), { cornerRadius: barH / 2 }), rect('bar-fill', box.x, barY, box.w * v, barH, pal.primary, { cornerRadius: barH / 2 })];
  centerIn(els, box);
  return { elements: els, overflow: r.overflow };
};

const quoteBigMarks: LayoutFn = (ctx, s, i) => {
  const q = s.quote ?? (s.headline ? { text: s.headline, attribution: '' } : null);
  if (!q) return standard(ctx, s, i, { valign: 'middle', align: ctx.align });
  const { k, pal } = ctx;
  const markW = Math.round(150 * k);
  const markH = Math.round(markW * 0.8);
  const region = { ...ctx.box, y: ctx.box.y + markH + Math.round(40 * k), h: ctx.box.h - markH - Math.round(40 * k) };
  const specs: TextSpec[] = [
    headSpec(ctx, { ...s, emphasis: [] }, q.text, Math.round(76 * k * ctx.headline.scale), { slot: 'quote', textCase: 'none', lineHeight: Math.max(1.15, ctx.headline.lineHeight), gapAfter: 0.7, rotation: 0 }),
  ];
  if (q.attribution) specs.push(bodySpec(ctx, `— ${q.attribution}`, 'attribution', { max: Math.round(36 * k), min: Math.round(28 * k), color: pal.mutedText }));
  const align = ctx.align === 'right' ? 'right' : ctx.align;
  const r = fitStack(specs, region, 'top', align);
  const markX = align === 'center' ? ctx.box.x + ctx.box.w / 2 - markW / 2 : ctx.box.x;
  const els: SlideElement[] = [path('quote-mark', SHAPES.quoteMark.d, SHAPES.quoteMark.viewBox, markX, ctx.box.y, markW, markH, { fill: ctx.accentText }), ...r.elements];
  centerIn(els, ctx.box);
  return { elements: els, overflow: r.overflow };
};

const quoteCard: LayoutFn = (ctx, s, i) => {
  const q = s.quote ?? (s.headline ? { text: s.headline, attribution: '' } : null);
  if (!q) return bodyCard(ctx, s, i);
  return bodyCard(ctx, { ...s, headline: `“${q.text}”`, body: q.attribution ? `— ${q.attribution}` : '', bullets: [], emphasis: [] }, i);
};

const compareSplit: LayoutFn = (ctx, s, i) => {
  const { box, k, pal } = ctx;
  let left: string[] = [];
  let right: string[] = [];
  let labels = ['Before', 'After'];
  const vs = s.headline.split(/\s+(?:vs\.?|versus|→|->)\s+/i);
  if (vs.length === 2) labels = [vs[0]!, vs[1]!];
  if (s.bullets.length >= 2) {
    const half = Math.ceil(s.bullets.length / 2);
    left = s.bullets.slice(0, half);
    right = s.bullets.slice(half);
  } else if (s.body) {
    const parts = s.body.split(/\s*(?:\bvs\.?\b|;|\bbut\b|\binstead\b)\s*/i).filter(Boolean);
    if (parts.length >= 2) {
      left = [parts[0]!];
      right = [parts.slice(1).join(' ')];
    }
  }
  if (!left.length || !right.length) return bodyTopLeft(ctx, s, i);
  const head = vs.length === 2 ? null : fitStack([headSpec(ctx, s, s.headline, ctx.sizes.head)], { ...box, h: Math.round(box.h * 0.3) }, 'top', ctx.align);
  const top = head ? bottomOf(head.elements) + Math.round(56 * k) : box.y;
  const gap = Math.round(32 * k);
  const colW = (box.w - gap) / 2;
  const colH = box.y + box.h - top;
  const els: SlideElement[] = head ? [...head.elements] : [];
  let overflow = head?.overflow ?? false;
  [left, right].forEach((items, c) => {
    const x = box.x + c * (colW + gap);
    const tinted = c === 1;
    els.push(rect('compare-panel', x, top, colW, colH, tinted ? mix(pal.primary, pal.bg, ctx.dark ? 0.7 : 0.82) : pal.surface, { cornerRadius: Math.round(28 * k) }));
    const pad = Math.round(36 * k);
    const lab = label(ctx, 'compare-label', labels[c]!, x + pad, top + pad, colW - 2 * pad, { size: Math.round(34 * k), color: tinted ? ctx.accentText : pal.mutedText, weight: ctx.headline.weight, textCase: 'upper', letterSpacing: 2 * k });
    els.push(lab);
    const r = rows(ctx, items, { x: x + pad, y: lab.y + lab.height + Math.round(28 * k), w: colW - 2 * pad, h: colH - lab.height - 2 * pad - Math.round(28 * k) }, c === 1 ? 'check' : 'dash');
    els.push(...r.elements);
    overflow ||= r.overflow;
  });
  return { elements: els, overflow };
};

const ctaCentered: LayoutFn = (ctx, s) => {
  const { k, pal, box } = ctx;
  const specs: TextSpec[] = [headSpec(ctx, s, s.headline, Math.round(ctx.sizes.head * 1.15)), bodySpec(ctx, s.body, 'body')];
  if (ctx.handle) specs.push(bodySpec(ctx, ctx.handle.startsWith('@') ? ctx.handle : `@${ctx.handle}`, 'handle', { color: ctx.accentText, weight: ctx.headline.weight, font: ctx.fonts.heading }));
  const r = fitStack(specs, { ...box, h: box.h - Math.round(150 * k) }, 'top', 'center');
  const iconSize = Math.round(64 * k);
  const icons = [SHAPES.heart, SHAPES.comment, SHAPES.share, SHAPES.bookmark];
  const rowW = icons.length * iconSize + (icons.length - 1) * iconSize * 0.9;
  const iy = bottomOf(r.elements) + Math.round(72 * k);
  const els: SlideElement[] = [...r.elements];
  icons.forEach((ic, n) => els.push(path('action-icon', ic.d, ic.viewBox, box.x + box.w / 2 - rowW / 2 + n * iconSize * 1.9, iy, iconSize, iconSize, { stroke: n === 3 ? ctx.accentText : pal.text, strokeWidth: Math.max(2, 4 * k) })));
  centerIn(els, box);
  return { elements: els, overflow: r.overflow };
};

const ctaProfile: LayoutFn = (ctx, s) => {
  const { k, pal, box } = ctx;
  const avatar = Math.round(180 * k);
  const handle = ctx.handle ? (ctx.handle.startsWith('@') ? ctx.handle : `@${ctx.handle}`) : '';
  const els: SlideElement[] = [];
  const cx = box.x + box.w / 2;
  els.push(ellipse('avatar', cx, box.y + avatar / 2, avatar / 2, avatar / 2, pal.primary));
  const initial = (handle.replace('@', '')[0] ?? s.headline[0] ?? '★').toUpperCase();
  const ini = label(ctx, 'avatar-initial', initial, box.x, 0, box.w, { size: Math.round(avatar * 0.42), color: ctx.onPrimary, weight: ctx.headline.weight, font: ctx.fonts.heading, align: 'center' });
  ini.y = Math.round(box.y + avatar / 2 - ini.height / 2);
  els.push(ini);
  const textTop = box.y + avatar + Math.round(56 * k);
  const specs: TextSpec[] = [];
  if (handle) specs.push(bodySpec(ctx, handle, 'handle', { color: pal.mutedText, gapAfter: 0.6 }));
  specs.push(headSpec(ctx, s, s.headline, Math.round(ctx.sizes.head * 1.05)), bodySpec(ctx, s.body));
  const r = fitStack(specs, { x: box.x, y: textTop, w: box.w, h: box.h - avatar - Math.round(56 * k) - Math.round(140 * k) }, 'top', 'center');
  els.push(...r.elements);
  const btnW = Math.round(300 * k);
  const btnH = Math.round(92 * k);
  const by = bottomOf(r.elements) + Math.round(56 * k);
  els.push(rect('follow-button', cx - btnW / 2, by, btnW, btnH, pal.primary, { cornerRadius: btnH / 2 }));
  const bl = label(ctx, 'follow-label', 'Follow', cx - btnW / 2, 0, btnW, { size: Math.round(38 * k), color: ctx.onPrimary, weight: ctx.headline.weight, font: ctx.fonts.heading, align: 'center' });
  bl.y = Math.round(by + btnH / 2 - bl.height / 2);
  els.push(bl);
  centerIn(els, box);
  return { elements: els, overflow: r.overflow };
};

const ctaRecap: LayoutFn = (ctx, s, i) => {
  // Recap previous slide headlines, then the CTA line.
  const recap = ctx.plan.slides
    .filter((x) => !['hook', 'cta', 'summary', 'quote'].includes(x.role) && x.headline)
    .map((x) => x.headline.replace(/ \(cont\.\)$/, '').replace(/^\d+[.)]\s*/, ''))
    .slice(0, 4);
  if (s.role !== 'cta' || recap.length < 2) return ctaCentered(ctx, s, i);
  const { k, box } = ctx;
  const head = fitStack([{ ...kickerSpec(ctx, 'Quick recap'), slot: 'recap-kicker' }], { ...box, h: Math.round(60 * k) }, 'top', 'left');
  const top = bottomOf(head.elements) + Math.round(16 * k);
  const r = rows(ctx, recap, { x: box.x, y: top, w: box.w, h: Math.round(box.h * 0.48) }, 'check');
  const ctaTop = bottomOf(r.elements) + Math.round(64 * k);
  const cta = fitStack([headSpec(ctx, s, s.headline, ctx.sizes.head), bodySpec(ctx, s.body)], { x: box.x, y: ctaTop, w: box.w, h: box.y + box.h - ctaTop }, 'top', 'left');
  const els = [...head.elements, ...r.elements, line('recap-rule', [box.x, ctaTop - Math.round(32 * k), box.x + box.w, ctaTop - Math.round(32 * k)], mix(ctx.pal.text, ctx.pal.bg, 0.8), Math.max(1, 2 * k)), ...cta.elements];
  centerIn(els, box);
  return { elements: els, overflow: r.overflow || cta.overflow };
};

const hookImageOverlay: LayoutFn = (ctx, s, i) => {
  // No photo yet: a bold color field with a scrim-like gradient band carries the headline (Phase 3 adds images).
  return hookSplit(ctx, s, i);
};

export const LAYOUTS: Record<string, LayoutFn> = {
  'hook-giant-type': hookGiantType,
  'hook-split': hookSplit,
  'hook-centered': hookCentered,
  'hook-image-overlay': hookImageOverlay,
  'hook-number': hookNumber,
  'hook-tweet': hookTweet,
  'body-top-left': bodyTopLeft,
  'body-card': bodyCard,
  'body-two-column': bodyTwoColumn,
  'body-centered': bodyCentered,
  'body-icon-top': bodyIconTop,
  'list-bullets': listLayout('list-bullets'),
  'list-numbered-rows': listLayout('list-numbered-rows'),
  'list-checklist': listLayout('list-checklist'),
  'step-big-number': stepBigNumber,
  'step-timeline': stepTimeline,
  'stat-hero': statHero,
  'stat-chart': statChart,
  'quote-big-marks': quoteBigMarks,
  'quote-card': quoteCard,
  'compare-split': compareSplit,
  'cta-centered': ctaCentered,
  'cta-profile': ctaProfile,
  'cta-recap': ctaRecap,
};

/** Layouts that make sense for a role — used by "new layout" and anti-repetition. */
export const ROLE_LAYOUTS: Record<SlidePlan['role'], string[]> = {
  hook: ['hook-giant-type', 'hook-centered', 'hook-split', 'hook-number'],
  intro: ['body-top-left', 'body-card', 'body-centered', 'body-icon-top', 'body-two-column'],
  body: ['body-top-left', 'body-card', 'body-centered', 'body-icon-top', 'body-two-column'],
  list: ['list-bullets', 'list-numbered-rows', 'list-checklist', 'body-card'],
  step: ['step-big-number', 'step-timeline', 'body-card', 'body-icon-top'],
  stat: ['stat-hero', 'stat-chart', 'body-card'],
  quote: ['quote-big-marks', 'quote-card', 'body-centered'],
  comparison: ['compare-split', 'body-card', 'list-bullets'],
  summary: ['list-numbered-rows', 'list-checklist', 'list-bullets', 'body-card'],
  cta: ['cta-centered', 'cta-profile', 'cta-recap'],
};
