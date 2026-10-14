// Accessibility & readability checks for a carousel. Contrast is measured against the pixels actually
// behind each text box (sampled from a render with that text hidden), so gradients, patterns and photos
// are handled — not just the nominal background color.
import type { Carousel, Slide, SlideElement, TextElement } from '@/model/types';
import { getPreset, patterns } from '@/styles';
import { contrast, mix, pickReadable } from '@/styles/color';
import { bounds, type Rect } from './ops';
import { layoutElement } from '@/engine/layout/textLayout';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  id: string;
  slideIndex: number;
  elementId?: string;
  severity: Severity;
  kind: 'contrast' | 'size' | 'safe-zone' | 'overflow' | 'alt-text' | 'slide-count' | 'density';
  message: string;
  /** Optional one-click fix: element patch to apply. */
  fix?: { label: string; patch: Partial<SlideElement> };
}

/** Returns colors (hex) sampled from the slide (text hidden) inside `rects` — the areas the glyphs cover. */
export type Sampler = (slideIndex: number, slide: Slide, excludeId: string, rects: Rect[]) => Promise<string[]>;

/**
 * The areas actually covered by glyphs (per line run, middle 60% of the line box), so text set on a
 * pill/button is judged against the pill, not the slide around it. Rotated/curved text uses its bounds.
 */
export function glyphRects(t: TextElement): Rect[] {
  if (t.rotation || t.curve) return [bounds(t)];
  const lay = layoutElement(t);
  const offsetY = t.verticalAlign === 'middle' ? (t.height - lay.height) / 2 : t.verticalAlign === 'bottom' ? t.height - lay.height : 0;
  const out: Rect[] = [];
  for (const line of lay.lines) {
    const lx = t.align === 'center' ? (t.width - line.width - line.indent) / 2 : t.align === 'right' ? t.width - line.width - line.indent : 0;
    for (const run of line.runs) {
      if (!run.width) continue;
      out.push({ x: t.x + lx + run.x, y: t.y + offsetY + line.y + lay.lineHeightPx * 0.2, width: run.width, height: lay.lineHeightPx * 0.6 });
    }
  }
  return out.length ? out : [bounds(t)];
}

/** Contrast at the 5th percentile of sampled background pixels (ignores hairlines and anti-aliasing). */
function robustContrast(fg: string, bg: string[]): { ratio: number; against: string } {
  const all = bg.map((b) => ({ r: contrast(fg, b), b })).sort((a, b) => a.r - b.r);
  const pick = all[Math.min(all.length - 1, Math.floor(all.length * 0.05))]!;
  return { ratio: pick.r, against: pick.b };
}

const T = patterns.typography;

/** WCAG large text: ≥ 24px regular or ≥ 18.66px bold at 1x reading size; here scaled to the 1080 canvas. */
export function isLargeText(el: Pick<TextElement, 'fontSize' | 'fontWeight'>, k: number) {
  const th = T['largeTextThresholdPx@1080'] as { regular: number; bold: number } | undefined;
  const regular = (th?.regular ?? 67) * k;
  const bold = (th?.bold ?? 52) * k;
  return el.fontSize >= (el.fontWeight >= 700 ? bold : regular);
}

const textEls = (els: SlideElement[], dx = 0, dy = 0): TextElement[] =>
  els.flatMap((e) => (e.kind === 'text' ? [{ ...e, x: e.x + dx, y: e.y + dy }] : e.kind === 'group' ? textEls(e.children, dx + e.x, dy + e.y) : []));

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Text colors a run can be drawn in (gradients count each stop). */
const fills = (el: TextElement) => (el.fillGradient ? el.fillGradient.stops.map((s) => s.color) : [el.fill]);

export async function checkCarousel(c: Carousel, sample: Sampler): Promise<Issue[]> {
  const preset = getPreset(c.presetId);
  const k = Math.min(preset.width, preset.height) / 1080;
  const issues: Issue[] = [];
  const minBody = T['minBodyPx@1080'] * k;
  const minCaption = (Number(T['minCaptionPx@1080'] ?? 26)) * k;
  const sz = preset.safeZone;

  if (c.slides.length > preset.maxSlides) {
    issues.push({ id: 'count', slideIndex: 0, severity: 'error', kind: 'slide-count', message: `${c.slides.length} slides — ${preset.label} allows at most ${preset.maxSlides}.` });
  }

  for (const [si, slide] of c.slides.entries()) {
    // Decorative type (a giant faded background word, the continuous panorama word) isn't content.
    const texts = textEls(slide.elements).filter((t) => !t.hidden && t.text.trim() && !/^[\p{Emoji}\s]+$/u.test(t.text) && t.slot !== 'panorama-word' && t.opacity >= 0.35);
    let slideWords = 0;
    for (const t of texts) {
      const isChrome = ['slide-number', 'swipe-cue', 'swipe-cue-label', 'watermark', 'footer-handle', 'corner-index', 'avatar-initial', 'source'].includes(t.slot ?? '');
      if (!isChrome) slideWords += words(t.text);
      const label = `“${t.text.slice(0, 28)}${t.text.length > 28 ? '…' : ''}”`;
      const large = isLargeText(t, k);
      const min = large ? 3 : 4.5;

      // Contrast against sampled background.
      if (t.slot !== 'corner-index') {
        const bg = await sample(si, slide, t.id, glyphRects(t));
        if (bg.length) {
          let worst = Infinity;
          let worstBg = bg[0]!;
          for (const f of fills(t)) {
            const { ratio, against } = robustContrast(f, bg);
            if (ratio < worst) {
              worst = ratio;
              worstBg = against;
            }
          }
          if (worst < min) {
            const suggestion = pickReadable(worstBg, [t.fill, mix(t.fill, '#000000', 0.5), mix(t.fill, '#FFFFFF', 0.5), '#111111', '#FFFFFF'], min);
            issues.push({
              id: `contrast-${t.id}`, slideIndex: si, elementId: t.id, severity: worst < 3 ? 'error' : 'warning', kind: 'contrast',
              message: `Low contrast ${worst.toFixed(1)}:1 for ${label} (needs ${min}:1${large ? ' for large text' : ''}).`,
              fix: contrast(suggestion, worstBg) >= min ? { label: `Use ${suggestion}`, patch: { fill: suggestion, fillGradient: undefined } as Partial<TextElement> } : undefined,
            });
          }
        }
      }

      // Minimum sizes for phone legibility (1080px slides display at ~0.36× on a phone).
      if (!isChrome && t.fontSize < minBody) {
        const tiny = t.fontSize < minCaption;
        issues.push({
          id: `size-${t.id}`, slideIndex: si, elementId: t.id, severity: tiny ? 'error' : 'warning', kind: 'size',
          message: `${label} is ${Math.round(t.fontSize)}px — under ${Math.round(minBody)}px is hard to read on phones.`,
          fix: { label: `Set ${Math.round(minBody)}px`, patch: { fontSize: Math.round(minBody), autoFit: false } as Partial<TextElement> },
        });
      }

      // Platform UI safe zone.
      const b = bounds(t);
      const outside = b.x < sz.left - 1 || b.y < sz.top - 1 || b.x + b.width > preset.width - sz.right + 1 || b.y + b.height > preset.height - sz.bottom + 1;
      if (outside && !['watermark'].includes(t.slot ?? '')) {
        issues.push({ id: `safe-${t.id}`, slideIndex: si, elementId: t.id, severity: 'warning', kind: 'safe-zone', message: `${label} sits outside ${preset.label}'s safe zone and may be covered by app buttons.` });
      }
    }

    if (slide.notes?.includes('exceeds')) issues.push({ id: `overflow-${slide.id}`, slideIndex: si, severity: 'warning', kind: 'overflow', message: 'Text doesn’t fit at the minimum readable size — shorten it.' });
    if (slideWords > patterns.density.maxWordsAnySlide) {
      issues.push({ id: `density-${slide.id}`, slideIndex: si, severity: 'info', kind: 'density', message: `${slideWords} words — aim for at most ${patterns.density.maxWordsAnySlide} per slide.` });
    }
    const walkImgs = (els: SlideElement[]) =>
      els.forEach((e) => {
        if (e.kind === 'image' && e.src && !e.prompt && e.slot !== 'watermark') {
          issues.push({ id: `alt-${e.id}`, slideIndex: si, elementId: e.id, severity: 'info', kind: 'alt-text', message: 'Image has no description (alt text) — add one in the image properties.' });
        }
        if (e.kind === 'group') walkImgs(e.children);
      });
    walkImgs(slide.elements);
  }
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.slideIndex - b.slideIndex);
}

/** Sampler from the background model only (no rendering) — used in unit tests and as a fallback. */
export const modelSampler: Sampler = async (_i, slide) => {
  const bg = slide.background;
  if (bg.type === 'solid' || bg.type === 'image') return [bg.color];
  if (bg.type === 'mesh') return [bg.base, ...bg.points.map((p) => p.color)];
  return bg.stops.map((s) => s.color);
};

export const isTextEl = (e: SlideElement): e is TextElement => e.kind === 'text';
