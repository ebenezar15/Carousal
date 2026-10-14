// One-click text effects ("textual graphics"). Each preset sets the text's effect fields and clears
// the others, so effects never stack by accident; every value stays editable afterwards.
import type { TextElement } from '@/model/types';
import type { PaletteColors } from '@/styles';
import { contrast } from '@/styles/color';

/** Light backgrounds need a colored neon tube; dark ones get the classic white core. */
const isDark = (bg: string) => contrast(bg, '#FFFFFF') > contrast(bg, '#000000');

export type TextEffectId = 'none' | 'neon' | 'outline' | 'sticker' | 'retro' | 'extrude' | 'long-shadow' | 'glitch' | 'echo' | 'gradient' | 'highlighter';

const CLEAR: Partial<TextElement> = { stroke: undefined, shadow: undefined, extrude: undefined, glitch: undefined, echo: undefined, fillGradient: undefined };

export const TEXT_EFFECTS: { id: TextEffectId; label: string; apply(el: TextElement, pal: PaletteColors): Partial<TextElement> }[] = [
  { id: 'none', label: 'None', apply: () => ({ ...CLEAR, spans: undefined }) },
  {
    id: 'neon',
    label: 'Neon glow',
    apply: (el, pal) => {
      const dark = isDark(pal.bg);
      const tube = dark ? pal.primary : pal.accent;
      return { ...CLEAR, fill: dark ? '#FFFFFF' : tube, shadow: { color: tube, blur: Math.round(el.fontSize * 0.45), offsetX: 0, offsetY: 0, opacity: dark ? 1 : 0.8 }, stroke: { color: tube, width: Math.max(1, Math.round(el.fontSize * 0.02)) } };
    },
  },
  { id: 'outline', label: 'Outline', apply: (el) => ({ ...CLEAR, stroke: { color: el.fill === 'transparent' ? '#000000' : el.fill, width: Math.max(1, Math.round(el.fontSize * 0.035)) }, fill: 'transparent' }) },
  { id: 'sticker', label: 'Sticker', apply: (el, pal) => ({ ...CLEAR, fill: el.fill === 'transparent' ? pal.text : el.fill, stroke: { color: '#FFFFFF', width: Math.max(2, Math.round(el.fontSize * 0.14)) }, shadow: { color: '#000000', blur: Math.round(el.fontSize * 0.12), offsetX: 0, offsetY: Math.round(el.fontSize * 0.05), opacity: 0.3 } }) },
  { id: 'retro', label: 'Retro offset', apply: (el, pal) => ({ ...CLEAR, shadow: { color: pal.accent, blur: 0, offsetX: Math.round(el.fontSize * 0.06), offsetY: Math.round(el.fontSize * 0.06), opacity: 1 } }) },
  { id: 'extrude', label: '3D extrude', apply: (el, pal) => ({ ...CLEAR, extrude: { depth: Math.round(el.fontSize * 0.12), color: pal.primary, angle: 45 } }) },
  { id: 'long-shadow', label: 'Long shadow', apply: (el, pal) => ({ ...CLEAR, extrude: { depth: Math.round(el.fontSize * 0.7), color: `${pal.text}22`, angle: 45 } }) },
  { id: 'glitch', label: 'Glitch', apply: (el) => ({ ...CLEAR, glitch: { colors: ['#FF2D6F', '#00E5FF'], offset: Math.max(2, Math.round(el.fontSize * 0.035)) } }) },
  { id: 'echo', label: 'Echo stack', apply: (el) => ({ ...CLEAR, echo: { count: 4, step: Math.round(el.fontSize * 0.6), color: el.fill === 'transparent' ? '#000000' : el.fill } }) },
  { id: 'gradient', label: 'Gradient', apply: (_el, pal) => ({ ...CLEAR, fillGradient: { angle: 90, stops: [{ offset: 0, color: pal.primary }, { offset: 1, color: pal.accent }] } }) },
  { id: 'highlighter', label: 'Highlighter', apply: (el, pal) => ({ ...CLEAR, spans: [{ start: 0, end: el.text.length, highlight: pal.highlight }] }) },
];

/** Which preset an element currently looks like (for the active state in the panel). */
export function currentEffect(el: TextElement): TextEffectId | null {
  if (el.glitch) return 'glitch';
  if (el.echo) return 'echo';
  if (el.extrude) return el.extrude.depth > el.fontSize * 0.3 ? 'long-shadow' : 'extrude';
  if (el.fillGradient) return 'gradient';
  if (el.fill === 'transparent' && el.stroke) return 'outline';
  if (el.stroke && el.stroke.color.toUpperCase() === '#FFFFFF' && el.stroke.width >= el.fontSize * 0.1) return 'sticker';
  if (el.shadow && el.shadow.offsetX === 0 && el.shadow.offsetY === 0 && el.shadow.blur > 0) return 'neon';
  if (el.shadow && el.shadow.blur === 0) return 'retro';
  if (el.spans?.length === 1 && el.spans[0]!.highlight && el.spans[0]!.start === 0 && el.spans[0]!.end >= el.text.length) return 'highlighter';
  if (!el.stroke && !el.shadow) return 'none';
  return null;
}
