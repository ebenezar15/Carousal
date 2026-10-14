// Decorative graphics library: hand-drawn doodles, sparkles, bursts, brush strokes, tape, ribbons and
// more, as editable vector paths (original artwork; viewBox units). Colors come from the carousel's
// palette, so every graphic matches the design and changes with it.
import { newId } from '@/model/id';
import type { GroupElement, PathElement, SlideElement, TextElement } from '@/model/types';
import type { Env } from './factory';
import { text as textEl } from './factory';
import { TEXT_EFFECTS } from './textEffects';
import { refitText } from '@/engine/layout/textLayout';
import { nearestWeight } from '@/styles';

type Paint = 'primary' | 'accent' | 'highlight' | 'text' | 'surface';

interface GraphicDef {
  id: string;
  label: string;
  group: 'Doodles' | 'Sparkles & bursts' | 'Shapes & frames' | 'Stickers';
  viewBox: [number, number];
  /** Relative size (fraction of the slide's short side). */
  size: number;
  parts: { d: string[]; fill?: Paint; stroke?: Paint; strokeWidth?: number; opacity?: number }[];
}

const star4 = (cx: number, cy: number, r: number, w = 0.22) =>
  `M${cx} ${cy - r} C${cx + r * w} ${cy - r * w} ${cx + r * w} ${cy - r * w} ${cx + r} ${cy} C${cx + r * w} ${cy + r * w} ${cx + r * w} ${cy + r * w} ${cx} ${cy + r} C${cx - r * w} ${cy + r * w} ${cx - r * w} ${cy + r * w} ${cx - r} ${cy} C${cx - r * w} ${cy - r * w} ${cx - r * w} ${cy - r * w} ${cx} ${cy - r} Z`;

function burst(points: number, inner: number, cx = 50, cy = 50, r = 48): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)} `;
  }
  return d + 'Z';
}

export const GRAPHICS: GraphicDef[] = [
  // Doodles (strokes)
  { id: 'curly-arrow', label: 'Curly arrow', group: 'Doodles', viewBox: [100, 60], size: 0.3, parts: [{ d: ['M6 48 C18 10 44 6 52 26 C58 42 40 50 34 38 C28 24 52 12 90 20', 'M78 10 L91 20 L80 31'], stroke: 'text', strokeWidth: 6 }] },
  { id: 'swoosh-arrow', label: 'Swoosh arrow', group: 'Doodles', viewBox: [100, 50], size: 0.3, parts: [{ d: ['M5 40 Q50 0 92 22', 'M80 10 L93 22 L78 31'], stroke: 'text', strokeWidth: 6 }] },
  { id: 'down-arrow', label: 'Hand-drawn down arrow', group: 'Doodles', viewBox: [40, 100], size: 0.18, parts: [{ d: ['M20 4 C14 30 26 56 19 90', 'M8 76 L19 92 L32 77'], stroke: 'text', strokeWidth: 6 }] },
  { id: 'scribble-underline', label: 'Scribble underline', group: 'Doodles', viewBox: [100, 20], size: 0.4, parts: [{ d: ['M3 12 C20 4 30 16 48 9 C64 3 76 15 97 7'], stroke: 'accent', strokeWidth: 6 }] },
  { id: 'double-underline', label: 'Double underline', group: 'Doodles', viewBox: [100, 20], size: 0.4, parts: [{ d: ['M3 6 C35 3 65 4 97 6', 'M8 15 C40 12 68 13 94 15'], stroke: 'accent', strokeWidth: 4 }] },
  { id: 'circle-scribble', label: 'Hand-drawn circle', group: 'Doodles', viewBox: [100, 60], size: 0.36, parts: [{ d: ['M60 6 C24 2 4 18 6 32 C8 50 40 56 64 52 C88 48 98 34 92 20 C86 8 60 4 36 10'], stroke: 'accent', strokeWidth: 4 }] },
  { id: 'squiggle', label: 'Squiggle', group: 'Doodles', viewBox: [100, 30], size: 0.32, parts: [{ d: ['M3 15 Q11 3 19 15 T35 15 T51 15 T67 15 T83 15 T99 15'], stroke: 'primary', strokeWidth: 5 }] },
  { id: 'zigzag', label: 'Zigzag', group: 'Doodles', viewBox: [100, 24], size: 0.32, parts: [{ d: ['M3 18 L15 6 L27 18 L39 6 L51 18 L63 6 L75 18 L87 6 L97 16'], stroke: 'primary', strokeWidth: 5 }] },
  { id: 'check', label: 'Check mark', group: 'Doodles', viewBox: [100, 80], size: 0.16, parts: [{ d: ['M8 44 L36 70 L92 10'], stroke: 'accent', strokeWidth: 10 }] },
  { id: 'cross', label: 'Cross mark', group: 'Doodles', viewBox: [100, 100], size: 0.14, parts: [{ d: ['M14 14 L86 86', 'M86 14 L14 86'], stroke: 'accent', strokeWidth: 10 }] },
  { id: 'emphasis-lines', label: 'Emphasis lines', group: 'Doodles', viewBox: [60, 60], size: 0.12, parts: [{ d: ['M30 4 L30 20', 'M8 14 L18 26', 'M52 14 L42 26'], stroke: 'accent', strokeWidth: 5 }] },
  { id: 'loop-line', label: 'Loop line', group: 'Doodles', viewBox: [100, 40], size: 0.36, parts: [{ d: ['M3 30 C25 30 30 4 44 6 C58 8 46 34 38 26 C30 18 60 10 97 22'], stroke: 'text', strokeWidth: 4 }] },
  // Sparkles & bursts (fills)
  { id: 'sparkle', label: 'Sparkle', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.12, parts: [{ d: [star4(50, 50, 48)], fill: 'highlight' }] },
  { id: 'sparkles', label: 'Sparkle trio', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.18, parts: [{ d: [star4(38, 58, 36), star4(80, 22, 18), star4(84, 80, 12)], fill: 'highlight' }] },
  { id: 'starburst', label: 'Starburst', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.24, parts: [{ d: [burst(14, 0.78)], fill: 'accent' }] },
  { id: 'seal', label: 'Seal badge', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.22, parts: [{ d: [burst(24, 0.9)], fill: 'primary' }] },
  { id: 'pop', label: 'Pop burst', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.26, parts: [{ d: [burst(9, 0.55)], fill: 'highlight' }] },
  { id: 'rays', label: 'Sun rays', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.3, parts: [{ d: Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `M${(50 + Math.cos(a) * 22).toFixed(1)} ${(50 + Math.sin(a) * 22).toFixed(1)} L${(50 + Math.cos(a) * 46).toFixed(1)} ${(50 + Math.sin(a) * 46).toFixed(1)}`; }), stroke: 'accent', strokeWidth: 5 }] },
  { id: 'confetti', label: 'Confetti', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.3, parts: [
    { d: ['M10 20 h8 v4 h-8 Z', 'M60 12 h4 v10 h-4 Z', 'M82 48 h9 v4 h-9 Z', 'M30 70 h4 v9 h-4 Z'], fill: 'primary' },
    { d: ['M44 40 a4 4 0 1 0 0.1 0', 'M88 82 a3 3 0 1 0 0.1 0', 'M14 52 a3 3 0 1 0 0.1 0'], fill: 'accent' },
    { d: ['M70 62 l6 -6 l3 3 l-6 6 Z', 'M24 36 l5 -5 l3 3 l-5 5 Z', 'M50 86 l6 -6 l3 3 l-6 6 Z'], fill: 'highlight' },
  ] },
  { id: 'dot-cluster', label: 'Dot cluster', group: 'Sparkles & bursts', viewBox: [100, 100], size: 0.2, parts: [{ d: Array.from({ length: 25 }, (_, i) => `M${10 + (i % 5) * 20} ${10 + Math.floor(i / 5) * 20} a4 4 0 1 0 0.1 0`), fill: 'primary', opacity: 0.6 }] },
  // Shapes & frames
  { id: 'brush-stroke', label: 'Brush stroke', group: 'Shapes & frames', viewBox: [200, 60], size: 0.5, parts: [{ d: ['M6 22 C40 10 90 14 130 10 C160 8 186 12 196 18 C192 26 198 34 190 42 C150 50 100 46 60 50 C34 52 14 50 4 44 C10 36 2 30 6 22 Z'], fill: 'highlight' }] },
  { id: 'highlighter', label: 'Highlighter swash', group: 'Shapes & frames', viewBox: [200, 40], size: 0.5, parts: [{ d: ['M4 10 L196 4 L194 32 L8 36 Z'], fill: 'highlight', opacity: 0.55 }] },
  { id: 'wave-divider', label: 'Wave divider', group: 'Shapes & frames', viewBox: [200, 30], size: 0.8, parts: [{ d: ['M0 15 C25 0 50 30 75 15 C100 0 125 30 150 15 C175 0 200 30 200 15 L200 30 L0 30 Z'], fill: 'primary' }] },
  { id: 'arch', label: 'Arch frame', group: 'Shapes & frames', viewBox: [100, 130], size: 0.4, parts: [{ d: ['M6 126 L6 50 A44 44 0 0 1 94 50 L94 126 Z'], stroke: 'text', strokeWidth: 4 }] },
  { id: 'ribbon', label: 'Ribbon banner', group: 'Shapes & frames', viewBox: [200, 60], size: 0.55, parts: [{ d: ['M0 12 L24 12 L24 52 L0 52 L10 32 Z', 'M200 12 L176 12 L176 52 L200 52 L190 32 Z'], fill: 'accent' }, { d: ['M16 4 L184 4 L184 44 L16 44 Z'], fill: 'primary' }] },
  { id: 'speech', label: 'Speech bubble', group: 'Shapes & frames', viewBox: [100, 90], size: 0.36, parts: [{ d: ['M10 4 H90 Q96 4 96 10 V60 Q96 66 90 66 H40 L22 86 L26 66 H10 Q4 66 4 60 V10 Q4 4 10 4 Z'], fill: 'surface', stroke: 'text', strokeWidth: 3 }] },
  { id: 'thought', label: 'Thought cloud', group: 'Shapes & frames', viewBox: [100, 80], size: 0.36, parts: [{ d: ['M24 54 C8 54 4 38 16 32 C12 18 30 10 40 18 C46 6 68 6 72 20 C88 16 98 32 88 42 C96 54 80 64 70 58 C62 68 40 66 36 58 C32 60 28 58 24 54 Z', 'M18 66 a5 5 0 1 0 0.1 0', 'M8 76 a3 3 0 1 0 0.1 0'], fill: 'surface', stroke: 'text', strokeWidth: 3 }] },
  { id: 'circle-frame', label: 'Double circle frame', group: 'Shapes & frames', viewBox: [100, 100], size: 0.36, parts: [{ d: ['M50 3 A47 47 0 1 1 49.9 3 Z', 'M50 11 A39 39 0 1 1 49.9 11 Z'], stroke: 'primary', strokeWidth: 3 }] },
  // Stickers
  { id: 'heart', label: 'Heart', group: 'Stickers', viewBox: [100, 90], size: 0.14, parts: [{ d: ['M50 86 C20 64 4 46 4 28 C4 12 16 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C84 4 96 12 96 28 C96 46 80 64 50 86 Z'], fill: 'accent' }] },
  { id: 'lightning', label: 'Lightning', group: 'Stickers', viewBox: [60, 100], size: 0.14, parts: [{ d: ['M36 2 L4 56 L28 56 L20 98 L56 38 L32 38 Z'], fill: 'highlight', stroke: 'text', strokeWidth: 2 }] },
  { id: 'crown', label: 'Crown', group: 'Stickers', viewBox: [100, 70], size: 0.16, parts: [{ d: ['M6 60 L10 16 L32 38 L50 6 L68 38 L90 16 L94 60 Z'], fill: 'highlight', stroke: 'text', strokeWidth: 2 }] },
  { id: 'tape', label: 'Washi tape', group: 'Stickers', viewBox: [120, 30], size: 0.24, parts: [{ d: ['M4 6 L116 2 L114 26 L2 28 L6 17 Z'], fill: 'highlight', opacity: 0.7 }] },
  { id: 'pin', label: 'Push pin', group: 'Stickers', viewBox: [60, 100], size: 0.08, parts: [{ d: ['M30 60 L30 98'], stroke: 'text', strokeWidth: 3 }, { d: ['M30 4 a26 26 0 1 0 0.1 0'], fill: 'accent' }] },
  { id: 'quote-mark', label: 'Big quote mark', group: 'Stickers', viewBox: [100, 80], size: 0.18, parts: [{ d: ['M8 76 L8 46 C8 20 20 6 42 2 L44 14 C30 18 24 28 24 40 L42 40 L42 76 Z', 'M58 76 L58 46 C58 20 70 6 92 2 L94 14 C80 18 74 28 74 40 L92 40 L92 76 Z'], fill: 'primary' }] },
];

export const GRAPHIC_GROUPS = ['Doodles', 'Sparkles & bursts', 'Shapes & frames', 'Stickers'] as const;

const paintOf = (e: Env, p?: Paint) => (p ? e.pal[p === 'text' ? 'text' : p] : undefined);

/** A graphic as an element: one path, or a group of paths for multi-color graphics. */
export function graphic(e: Env, id: string): SlideElement {
  const g = GRAPHICS.find((x) => x.id === id) ?? GRAPHICS[0]!;
  const short = Math.min(e.W, e.H);
  const w = Math.round(short * g.size * (g.viewBox[0] >= g.viewBox[1] ? 1 : g.viewBox[0] / g.viewBox[1]));
  const h = Math.round((w * g.viewBox[1]) / g.viewBox[0]);
  const x = Math.round((e.W - w) / 2);
  const y = Math.round((e.H - h) / 2);
  const part = (p: GraphicDef['parts'][number], px: number, py: number): PathElement => ({
    id: newId('el_'), kind: 'path', name: g.label, x: px, y: py, width: w, height: h, rotation: 0, opacity: p.opacity ?? 1,
    data: p.d, viewBox: g.viewBox, fill: paintOf(e, p.fill), stroke: paintOf(e, p.stroke), strokeWidth: p.strokeWidth ? Math.max(2, Math.round(p.strokeWidth * (w / g.viewBox[0]))) : undefined,
  });
  if (g.parts.length === 1) return part(g.parts[0]!, x, y);
  const group: GroupElement = { id: newId('el_'), kind: 'group', name: g.label, x, y, width: w, height: h, rotation: 0, opacity: 1, children: g.parts.map((p) => part(p, 0, 0)) };
  return group;
}

// ---- Text graphics: ready-made styled text elements -------------------------------------------


export type TextGraphicId = 'background-word' | 'big-number' | 'neon-title' | 'outline-title' | 'sticker-label' | 'stamp' | 'glitch-title' | 'echo-title' | 'retro-title' | 'extrude-title';

export const TEXT_GRAPHICS: { id: TextGraphicId; label: string; behind?: boolean }[] = [
  { id: 'background-word', label: 'Giant background word', behind: true },
  { id: 'big-number', label: 'Big number' },
  { id: 'neon-title', label: 'Neon title' },
  { id: 'outline-title', label: 'Outline title' },
  { id: 'extrude-title', label: '3D title' },
  { id: 'retro-title', label: 'Retro title' },
  { id: 'glitch-title', label: 'Glitch title' },
  { id: 'echo-title', label: 'Echo stack' },
  { id: 'sticker-label', label: 'Sticker label' },
  { id: 'stamp', label: 'Arc text' },
];

const fx = (id: string) => TEXT_EFFECTS.find((f) => f.id === id)!;

export function textGraphic(e: Env, id: TextGraphicId): TextElement {
  const heading = textEl(e, 'heading');
  const big = (t: string, size: number): TextElement => refitText({ ...heading, text: t, fontSize: Math.round(size * e.k), fontWeight: nearestWeight(e.heading, 900), width: Math.round(e.W * 0.9), x: Math.round(e.W * 0.05), lineHeight: 1, autoFit: false });
  switch (id) {
    case 'background-word': {
      // One line that fills the width: start huge and let auto-fit shrink it to the box.
      const start = big('IDEAS', 300);
      const fitted = refitText({ ...start, textCase: 'upper', autoFit: true, height: Math.round(300 * e.k * 1.05) });
      const el = { ...fitted, autoFit: false, height: Math.ceil(fitted.fontSize * 1.05) };
      return { ...el, name: 'Background word', align: 'center', fill: e.pal.text, opacity: 0.07, y: Math.round((e.H - el.height) / 2) };
    }
    case 'big-number':
      return { ...big('01', 260), name: 'Big number', fill: e.pal.primary };
    case 'neon-title': {
      const el = big('Glow up', 130);
      return { ...el, ...fx('neon').apply(el, e.pal), name: 'Neon title', align: 'center' };
    }
    case 'outline-title': {
      const el = { ...big('OUTLINE', 150), textCase: 'upper' as const };
      return { ...el, ...fx('outline').apply({ ...el, fill: e.pal.text }, e.pal), name: 'Outline title', align: 'center' };
    }
    case 'extrude-title': {
      const el = big('Pop out', 140);
      return { ...el, ...fx('extrude').apply(el, e.pal), name: '3D title', align: 'center' };
    }
    case 'retro-title': {
      const el = big('Retro', 150);
      return { ...el, ...fx('retro').apply(el, e.pal), name: 'Retro title', align: 'center' };
    }
    case 'glitch-title': {
      const el = big('GLITCH', 140);
      return { ...el, ...fx('glitch').apply(el, e.pal), name: 'Glitch title', align: 'center', textCase: 'upper' };
    }
    case 'echo-title': {
      const el = big('REPEAT', 120);
      return { ...el, ...fx('echo').apply(el, e.pal), name: 'Echo stack', align: 'center', textCase: 'upper' };
    }
    case 'sticker-label': {
      const el = { ...textEl(e, 'subheading'), text: 'NEW!', textCase: 'upper' as const, fill: e.pal.accent, rotation: -6, fontSize: Math.round(110 * e.k), align: 'center' as const };
      return refitText({ ...el, ...fx('sticker').apply(el, e.pal), name: 'Sticker label' });
    }
    case 'stamp': {
      const s = Math.round(360 * e.k);
      return { ...textEl(e, 'label'), name: 'Arc text', text: 'SAVE THIS • SHARE IT • SAVE THIS', curve: 100, width: s, height: s, x: Math.round((e.W - s) / 2), y: Math.round((e.H - s) / 2), fontSize: Math.round(30 * e.k), letterSpacing: 4 * e.k, align: 'center', textCase: 'upper', fill: e.pal.primary };
    }
  }
}
