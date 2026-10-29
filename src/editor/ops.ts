// Pure document operations on a Carousel (+ its CarouselPlan). The editor store applies these with undo
// history; keeping them pure makes them easy to test.
import { newId } from '@/model/id';
import type { Carousel, CarouselTheme, GroupElement, Slide, SlideElement, TextElement } from '@/model/types';
import { emptySlide, type CarouselPlan, type SlidePlan } from '@/engine/schema';
import { buildCarousel } from '@/engine/layout/engine';
import { makeCtx } from '@/engine/layout/context';
import { chrome } from '@/engine/layout/chrome';
import { isPanoramic } from '@/engine/layout/backgrounds';
import { panoramicSlice } from '@/engine/layout/decorations';

export interface Doc { carousel: Carousel; plan: CarouselPlan }

// ---------- geometry ----------

export interface Rect { x: number; y: number; width: number; height: number }

/** Axis-aligned bounds of an element, accounting for rotation about its center. */
export function bounds(el: Pick<SlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Rect {
  if (!el.rotation) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const r = (el.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const w = el.width * c + el.height * s;
  const h = el.width * s + el.height * c;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

export function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width));
  const y2 = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

// ---------- element helpers ----------

/** Deep copy with fresh ids (children too). Engine slots are dropped: copies are user content. */
export function cloneElement<T extends SlideElement>(el: T, dx = 0, dy = 0): T {
  const copy = structuredClone(el) as T;
  const reid = (e: SlideElement) => {
    e.id = newId('el_');
    if (e.kind === 'group') e.children.forEach(reid);
  };
  reid(copy);
  copy.x += dx;
  copy.y += dy;
  delete copy.slot;
  return copy;
}

const mapSlide = (doc: Doc, index: number, fn: (s: Slide) => Slide): Doc => ({
  ...doc,
  carousel: { ...doc.carousel, slides: doc.carousel.slides.map((s, i) => (i === index ? fn(s) : s)) },
});

export function updateElements(doc: Doc, slideIndex: number, ids: string[], patch: Partial<SlideElement> | ((el: SlideElement) => SlideElement)): Doc {
  const set = new Set(ids);
  const apply = (el: SlideElement): SlideElement => {
    if (set.has(el.id)) return typeof patch === 'function' ? patch(el) : ({ ...el, ...patch } as SlideElement);
    if (el.kind === 'group') return { ...el, children: el.children.map(apply) };
    return el;
  };
  let next = mapSlide(doc, slideIndex, (s) => ({ ...s, elements: s.elements.map(apply) }));
  // Keep the plan in step with edited engine text so theme changes keep the user's words.
  const slide = next.carousel.slides[slideIndex]!;
  for (const id of ids) {
    const el = findElement(slide.elements, id);
    if (el?.kind === 'text' && el.slot) next = { ...next, plan: syncPlanText(next.plan, slideIndex, slide, el) };
  }
  return next;
}

export function findElement(els: SlideElement[], id: string): SlideElement | undefined {
  for (const e of els) {
    if (e.id === id) return e;
    if (e.kind === 'group') {
      const hit = findElement(e.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function addElements(doc: Doc, slideIndex: number, els: SlideElement[]): Doc {
  return mapSlide(doc, slideIndex, (s) => ({ ...s, elements: [...s.elements, ...els] }));
}

export function removeElements(doc: Doc, slideIndex: number, ids: string[]): Doc {
  const set = new Set(ids);
  return mapSlide(doc, slideIndex, (s) => ({ ...s, elements: s.elements.filter((e) => !set.has(e.id)) }));
}

export type ZMove = 'forward' | 'backward' | 'front' | 'back';

export function reorder(doc: Doc, slideIndex: number, ids: string[], move: ZMove): Doc {
  return mapSlide(doc, slideIndex, (s) => {
    const set = new Set(ids);
    const els = [...s.elements];
    const picked = els.filter((e) => set.has(e.id));
    const rest = els.filter((e) => !set.has(e.id));
    if (move === 'front') return { ...s, elements: [...rest, ...picked] };
    if (move === 'back') return { ...s, elements: [...picked, ...rest] };
    // forward/backward: swap each picked element with its neighbor
    const order = move === 'forward' ? [...els.keys()].reverse() : [...els.keys()];
    for (const i of order) {
      const j = move === 'forward' ? i + 1 : i - 1;
      if (j < 0 || j >= els.length) continue;
      if (set.has(els[i]!.id) && !set.has(els[j]!.id)) [els[i], els[j]] = [els[j]!, els[i]!];
    }
    return { ...s, elements: els };
  });
}

/** Moves one element to a z-index (used by drag-reordering in the layers panel). */
export function moveElementTo(doc: Doc, slideIndex: number, id: string, toIndex: number): Doc {
  return mapSlide(doc, slideIndex, (s) => {
    const els = s.elements.filter((e) => e.id !== id);
    const el = s.elements.find((e) => e.id === id);
    if (!el) return s;
    els.splice(Math.max(0, Math.min(toIndex, els.length)), 0, el);
    return { ...s, elements: els };
  });
}

export function group(doc: Doc, slideIndex: number, ids: string[]): { doc: Doc; groupId: string | null } {
  const slide = doc.carousel.slides[slideIndex]!;
  const members = slide.elements.filter((e) => ids.includes(e.id));
  if (members.length < 2) return { doc, groupId: null };
  const b = union(members.map(bounds));
  const g: GroupElement = {
    id: newId('el_'), kind: 'group', name: 'Group', x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0, opacity: 1,
    children: members.map((m) => ({ ...m, x: m.x - b.x, y: m.y - b.y })),
  };
  const firstIndex = slide.elements.findIndex((e) => ids.includes(e.id));
  const rest = slide.elements.filter((e) => !ids.includes(e.id));
  rest.splice(firstIndex, 0, g);
  return { doc: mapSlide(doc, slideIndex, (s) => ({ ...s, elements: rest })), groupId: g.id };
}

export function ungroup(doc: Doc, slideIndex: number, id: string): { doc: Doc; ids: string[] } {
  const slide = doc.carousel.slides[slideIndex]!;
  const at = slide.elements.findIndex((e) => e.id === id);
  const g = slide.elements[at];
  if (!g || g.kind !== 'group') return { doc, ids: [] };
  // Children inherit the group's offset (group rotation is baked in only when 0; rotated groups keep child rotation additive).
  const kids = g.children.map((c) => ({ ...c, x: c.x + g.x, y: c.y + g.y, rotation: (c.rotation + g.rotation) % 360, opacity: c.opacity * g.opacity }));
  const els = [...slide.elements];
  els.splice(at, 1, ...kids);
  return { doc: mapSlide(doc, slideIndex, (s) => ({ ...s, elements: els })), ids: kids.map((k) => k.id) };
}

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Aligns elements to their shared bounds, or to the slide when a single element is selected. */
export function align(doc: Doc, slideIndex: number, ids: string[], edge: AlignEdge, canvas: { width: number; height: number }): Doc {
  const slide = doc.carousel.slides[slideIndex]!;
  const els = slide.elements.filter((e) => ids.includes(e.id));
  if (!els.length) return doc;
  const ref = els.length === 1 ? { x: 0, y: 0, width: canvas.width, height: canvas.height } : union(els.map(bounds));
  return updateElements(doc, slideIndex, ids, (el) => {
    const b = bounds(el);
    const dx = edge === 'left' ? ref.x - b.x : edge === 'right' ? ref.x + ref.width - (b.x + b.width) : edge === 'hcenter' ? ref.x + ref.width / 2 - (b.x + b.width / 2) : 0;
    const dy = edge === 'top' ? ref.y - b.y : edge === 'bottom' ? ref.y + ref.height - (b.y + b.height) : edge === 'vcenter' ? ref.y + ref.height / 2 - (b.y + b.height / 2) : 0;
    return { ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) };
  });
}

/** Even spacing between 3+ elements along an axis. */
export function distribute(doc: Doc, slideIndex: number, ids: string[], axis: 'h' | 'v'): Doc {
  const slide = doc.carousel.slides[slideIndex]!;
  const els = slide.elements.filter((e) => ids.includes(e.id));
  if (els.length < 3) return doc;
  const key = axis === 'h' ? 'x' : 'y';
  const size = axis === 'h' ? 'width' : 'height';
  const sorted = [...els].sort((a, b) => bounds(a)[key] - bounds(b)[key]);
  const first = bounds(sorted[0]!);
  const last = bounds(sorted.at(-1)!);
  const total = sorted.reduce((t, e) => t + bounds(e)[size], 0);
  const gap = (last[key] + last[size] - first[key] - total) / (sorted.length - 1);
  const target = new Map<string, number>();
  let pos = first[key];
  for (const e of sorted) {
    const b = bounds(e);
    target.set(e.id, Math.round(e[key] + (pos - b[key])));
    pos += b[size] + gap;
  }
  return updateElements(doc, slideIndex, ids, (el) => ({ ...el, [key]: target.get(el.id) ?? el[key] }));
}

// ---------- slides (kept index-aligned with plan.slides) ----------

export function blankSlide(from: Slide): Slide {
  return { id: newId('sl_'), role: 'body', background: { ...from.background }, elements: [], manual: true };
}

export function addSlide(doc: Doc, afterIndex: number, slide?: Slide, planSlide?: SlidePlan): Doc {
  const slides = [...doc.carousel.slides];
  const ref = slides[Math.max(0, afterIndex)] ?? slides[0]!;
  slides.splice(afterIndex + 1, 0, slide ?? blankSlide(ref));
  const ps = [...doc.plan.slides];
  ps.splice(afterIndex + 1, 0, planSlide ?? emptySlide('body', ''));
  // Per-slide layout choices move with their slides.
  const overrides = shiftOverrides(doc.carousel.theme.layoutOverrides, (i) => (i > afterIndex ? i + 1 : i));
  return refreshSequence({ carousel: { ...doc.carousel, theme: { ...doc.carousel.theme, layoutOverrides: overrides }, slides }, plan: { ...doc.plan, slides: ps } });
}

export function duplicateSlide(doc: Doc, index: number): Doc {
  const s = doc.carousel.slides[index]!;
  // The copy keeps its plan entry, so it follows theme changes like the original (unless that was hand-made).
  const copy: Slide = { ...structuredClone(s), id: newId('sl_'), elements: s.elements.map((e) => ({ ...cloneElement(e), slot: e.slot })) };
  const next = addSlide(doc, index, copy, structuredClone(doc.plan.slides[index]!));
  const o = doc.carousel.theme.layoutOverrides?.[index];
  return o ? { ...next, carousel: { ...next.carousel, theme: { ...next.carousel.theme, layoutOverrides: { ...next.carousel.theme.layoutOverrides, [index + 1]: o } } } } : next;
}

const CHROME_SLOT = /^(slide-number|progress-|swipe-)/;
const PANORAMA_SLOT = /^(panorama-|seam-|route-stop)/;

/**
 * After slides are added, removed or reordered: renumbers slide counters and masthead issue numbers,
 * re-slices continuous (panoramic) backgrounds and drawings, and moves the swipe cue off the new last
 * slide. Hand-made slides are left alone.
 */
export function refreshSequence(doc: Doc): Doc {
  let ctx: ReturnType<typeof makeCtx>;
  try {
    ctx = makeCtx(doc.plan, doc.carousel.presetId, doc.carousel.theme);
  } catch {
    return doc;
  }
  const total = doc.carousel.slides.length;
  const pano = isPanoramic(ctx);
  const slides = doc.carousel.slides.map((s, i) => {
    const background = s.background.span ? { ...s.background, span: { index: i, count: total } } : s.background;
    if (s.manual) return { ...s, background };
    const hadChrome = s.elements.some((e) => e.slot && CHROME_SLOT.test(e.slot));
    let elements = s.elements.filter((e) => !(e.slot && (CHROME_SLOT.test(e.slot) || PANORAMA_SLOT.test(e.slot))));
    if (pano) elements = [...panoramicSlice(ctx, i), ...elements];
    elements = elements.map((e) => (e.slot === 'masthead-issue' && e.kind === 'text' ? { ...e, text: `No. ${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` } : e));
    if (hadChrome) elements = [...elements, ...chrome(ctx, i)];
    return { ...s, background, elements };
  });
  return { ...doc, carousel: { ...doc.carousel, slides } };
}

export function deleteSlide(doc: Doc, index: number): Doc {
  if (doc.carousel.slides.length <= 1) return doc;
  const overrides = shiftOverrides(doc.carousel.theme.layoutOverrides, (i) => (i === index ? null : i > index ? i - 1 : i));
  return refreshSequence({
    carousel: { ...doc.carousel, theme: { ...doc.carousel.theme, layoutOverrides: overrides }, slides: doc.carousel.slides.filter((_, i) => i !== index) },
    plan: { ...doc.plan, slides: doc.plan.slides.filter((_, i) => i !== index) },
  });
}

export function moveSlide(doc: Doc, from: number, to: number): Doc {
  if (from === to) return doc;
  const move = <T,>(arr: T[]) => {
    const a = [...arr];
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x!);
    return a;
  };
  const order = move([...doc.carousel.slides.keys()]);
  const overrides = shiftOverrides(doc.carousel.theme.layoutOverrides, (i) => order.indexOf(i));
  return refreshSequence({
    carousel: { ...doc.carousel, theme: { ...doc.carousel.theme, layoutOverrides: overrides }, slides: move(doc.carousel.slides) },
    plan: { ...doc.plan, slides: move(doc.plan.slides) },
  });
}

function shiftOverrides(o: Record<number, string> | undefined, map: (i: number) => number | null) {
  if (!o) return o;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = map(Number(k));
    if (n !== null && n >= 0) out[n] = v;
  }
  return out;
}

// ---------- plan sync ----------

const stripQuotes = (t: string) => t.replace(/^[“"]|[”"]$/g, '');

/** Copies an edited engine text element back into the plan (so theme rebuilds keep the new words). */
export function syncPlanText(plan: CarouselPlan, slideIndex: number, slide: Slide, el: TextElement): CarouselPlan {
  const ps = plan.slides[slideIndex];
  if (!ps) return plan;
  const next: SlidePlan = { ...ps };
  switch (el.slot) {
    case 'headline':
      if (ps.role === 'quote' && ps.quote) next.quote = { ...ps.quote, text: stripQuotes(el.text) };
      else next.headline = el.text;
      break;
    case 'body':
    case 'subline':
    case 'tweet-text':
      next.body = el.text;
      break;
    case 'bullet': {
      const bulletEls = slide.elements.filter((e): e is TextElement => e.kind === 'text' && e.slot === 'bullet');
      const k = bulletEls.findIndex((b) => b.id === el.id);
      if (k >= 0) next.bullets = ps.bullets.map((b, i) => (i === k ? el.text : b));
      break;
    }
    case 'stat-value':
      if (ps.stat) next.stat = { ...ps.stat, value: el.text };
      break;
    case 'stat-label':
      if (ps.stat) next.stat = { ...ps.stat, label: el.text };
      break;
    case 'quote':
      if (ps.quote) next.quote = { ...ps.quote, text: stripQuotes(el.text) };
      else next.headline = el.text;
      break;
    case 'attribution':
      if (ps.quote) next.quote = { ...ps.quote, attribution: el.text.replace(/^—\s*/, '') };
      break;
    default:
      return plan;
  }
  return { ...plan, slides: plan.slides.map((s, i) => (i === slideIndex ? next : s)) };
}

/**
 * Re-lays out the carousel with a new theme from the (synced) plan. Hand-made slides are kept as they
 * are, and elements the user added (no engine slot) are carried over onto the rebuilt slides.
 */
/**
 * Continues an element that crosses a slide edge onto the neighbouring slide: the copy sits one slide
 * width further along, so both halves line up when swiping (continuous carousels).
 */
export function continueAcross(doc: Doc, slideIndex: number, id: string, direction: 'next' | 'prev', slideWidth: number): Doc {
  const target = slideIndex + (direction === 'next' ? 1 : -1);
  const el = doc.carousel.slides[slideIndex]?.elements.find((e) => e.id === id);
  if (!el || target < 0 || target >= doc.carousel.slides.length) return doc;
  const copy = cloneElement(el, direction === 'next' ? -slideWidth : slideWidth, 0);
  // Already continued there? Don't stack a second copy.
  if (doc.carousel.slides[target]!.elements.some((e) => e.kind === copy.kind && e.x === copy.x && e.y === copy.y && e.width === copy.width && e.height === copy.height)) return doc;
  return addElements(doc, target, [{ ...copy, name: `${el.name ?? el.kind} (continued)` }]);
}

export function applyTheme(doc: Doc, theme: CarouselTheme, presetId = doc.carousel.presetId): Doc {
  const rebuilt = buildCarousel({ plan: doc.plan, presetId, theme });
  const slides = rebuilt.slides.map((s, i) => {
    const old = doc.carousel.slides[i];
    if (!old) return s;
    if (old.manual) return old;
    const userEls = old.elements.filter((e) => !e.slot);
    // The new theme's motion animates the rebuilt slide; animations the user tuned by hand ('custom')
    // carry over to the rebuilt element in the same slot.
    if (theme.motion !== 'custom') return { ...s, id: old.id, elements: [...s.elements, ...userEls] };
    const animBySlot = new Map<string, NonNullable<SlideElement['anim']>[]>();
    old.elements.forEach((e) => e.slot && e.anim && animBySlot.set(e.slot, [...(animBySlot.get(e.slot) ?? []), e.anim]));
    const seen = new Map<string, number>();
    const rebuiltEls = s.elements.map((e) => {
      if (!e.slot || !animBySlot.has(e.slot)) return e;
      const n = seen.get(e.slot) ?? 0;
      seen.set(e.slot, n + 1);
      const list = animBySlot.get(e.slot)!;
      return { ...e, anim: list[Math.min(n, list.length - 1)] };
    });
    return { ...s, id: old.id, elements: [...rebuiltEls, ...userEls] };
  });
  return { ...doc, carousel: { ...rebuilt, id: doc.carousel.id, slides } };
}

/** Find & replace across all text (elements and plan). Returns the new doc and the number of replacements. */
export function findReplace(doc: Doc, find: string, replace: string, opts: { matchCase: boolean; wholeWord: boolean }): { doc: Doc; count: number } {
  if (!find) return { doc, count: 0 };
  const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(opts.wholeWord ? `\\b${esc}\\b` : esc, opts.matchCase ? 'g' : 'gi');
  let count = 0;
  const rep = (t: string) => t.replace(re, () => (count++, replace));
  const walk = (els: SlideElement[]): SlideElement[] =>
    els.map((e) => {
      if (e.kind === 'text') {
        const text = rep(e.text);
        // Spans index into the text; drop them if the length changed.
        return text === e.text ? e : { ...e, text, spans: text.length === e.text.length ? e.spans : undefined };
      }
      if (e.kind === 'table') return { ...e, rows: e.rows.map((r) => r.map(rep)) };
      if (e.kind === 'group') return { ...e, children: walk(e.children) };
      return e;
    });
  const slides = doc.carousel.slides.map((s) => ({ ...s, elements: walk(s.elements) }));
  const elementCount = count;
  const repPlain = (t: string) => t.replace(re, replace);
  const plan: CarouselPlan = {
    ...doc.plan,
    title: repPlain(doc.plan.title),
    caption: repPlain(doc.plan.caption),
    slides: doc.plan.slides.map((p) => ({
      ...p,
      headline: repPlain(p.headline),
      body: repPlain(p.body),
      bullets: p.bullets.map(repPlain),
      stat: p.stat && { value: repPlain(p.stat.value), label: repPlain(p.stat.label) },
      quote: p.quote && { text: repPlain(p.quote.text), attribution: repPlain(p.quote.attribution) },
    })),
  };
  return { doc: { carousel: { ...doc.carousel, slides }, plan }, count: elementCount };
}

/** Scales a hand-made slide's elements to a new canvas size (used when switching platform presets). */
export function scaleSlide(s: Slide, sx: number, sy: number): Slide {
  const k = Math.min(sx, sy);
  const scaleEl = (e: SlideElement): SlideElement => {
    const base = { ...e, x: Math.round(e.x * sx), y: Math.round(e.y * sy), width: Math.round(e.width * sx), height: Math.round(e.height * sy) };
    if (e.kind === 'text') return { ...base, fontSize: Math.round(e.fontSize * k) } as SlideElement;
    if (e.kind === 'line') return { ...base, points: e.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy)) } as SlideElement;
    if (e.kind === 'group') return { ...base, children: e.children.map(scaleEl) } as SlideElement;
    return base as SlideElement;
  };
  return { ...s, elements: s.elements.map(scaleEl) };
}

/** Switches the platform preset: engine slides re-lay out, hand-made slides scale. */
export function changePreset(doc: Doc, presetId: string, from: { width: number; height: number }, to: { width: number; height: number }): Doc {
  const next = applyTheme(doc, doc.carousel.theme, presetId);
  return {
    ...next,
    carousel: { ...next.carousel, slides: next.carousel.slides.map((s) => (s.manual ? scaleSlide(s, to.width / from.width, to.height / from.height) : s)) },
  };
}
