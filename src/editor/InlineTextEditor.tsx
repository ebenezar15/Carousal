// Inline text editing: a textarea laid over the text element, plus a mini toolbar that applies
// rich-text styles (bold, italic, underline, color, marker highlight) to the selected characters.
import { useEffect, useRef, useState } from 'react';
import type { TextElement, TextSpan } from '@/model/types';
import { cssFamily } from '@/styles/fontLoader';
import { nearestWeight } from '@/styles';
import { refitText } from '@/engine/layout/textLayout';
import { useDocument } from '@/app/store';
import { updateElements } from './ops';
import { useEditor } from './store';

/** Keeps spans valid after an edit: shifts ranges after the edit point, clips ones it touched. */
export function adjustSpans(spans: TextSpan[] | undefined, before: string, after: string): TextSpan[] | undefined {
  if (!spans?.length) return spans;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  const delta = endA - endB;
  const out = spans
    .map((s) => {
      if (s.end <= start) return s;
      if (s.start >= endB) return { ...s, start: s.start + delta, end: s.end + delta };
      return { ...s, start: Math.min(s.start, start), end: Math.max(start, s.end + delta) };
    })
    .filter((s) => s.end > s.start && s.start < after.length)
    .map((s) => ({ ...s, end: Math.min(s.end, after.length) }));
  return out.length ? out : undefined;
}

export function InlineTextEditor({ el, zoom, ox, oy, slideIndex }: { el: TextElement; zoom: number; ox: number; oy: number; slideIndex: number }) {
  const apply = useDocument((s) => s.apply);
  const setEditing = useEditor((s) => s.setEditing);
  const [text, setText] = useState(el.text);
  const [spans, setSpans] = useState<TextSpan[] | undefined>(el.spans);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, []);

  const commit = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && (text !== el.text || spans !== el.spans)) {
      apply((d) => updateElements(d, slideIndex, [el.id], (e) => refitText({ ...(e as TextElement), text, spans })));
    }
    setEditing(null);
  };

  const styleSelection = (patch: Omit<TextSpan, 'start' | 'end'>) => {
    const t = ref.current;
    if (!t) return;
    const start = t.selectionStart;
    const end = t.selectionEnd;
    if (end <= start) return;
    // Toggle booleans if the whole range already has them.
    const covering = (spans ?? []).filter((s) => s.start <= start && s.end >= end);
    const resolved: Omit<TextSpan, 'start' | 'end'> = { ...patch };
    for (const k of ['italic', 'underline'] as const) if (patch[k] && covering.some((s) => s[k])) resolved[k] = false;
    if (patch.fontWeight && covering.some((s) => s.fontWeight === patch.fontWeight)) resolved.fontWeight = el.fontWeight;
    setSpans([...(spans ?? []), { start, end, ...resolved }]);
    t.focus();
  };

  const lineHeight = el.fontSize * el.lineHeight * zoom;
  return (
    <>
      <div
        className="absolute z-20 flex items-center gap-1 rounded-lg border border-zinc-300 bg-white p-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        style={{ left: ox + el.x * zoom, top: Math.max(0, oy + el.y * zoom - 40) }}
        onMouseDown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label="Text style for selection"
      >
        <button className="rounded px-2 py-1 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Bold selection" onClick={() => styleSelection({ fontWeight: nearestWeight(el.fontId, 800) })}>B</button>
        <button className="rounded px-2 py-1 italic hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Italic selection" onClick={() => styleSelection({ italic: true })}>I</button>
        <button className="rounded px-2 py-1 underline hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Underline selection" onClick={() => styleSelection({ underline: true })}>U</button>
        <label className="flex items-center gap-1 rounded px-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Color of selection">
          A<input type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => styleSelection({ color: e.target.value })} />
        </label>
        <button className="rounded bg-yellow-200 px-2 py-1 text-zinc-900 hover:bg-yellow-300" title="Marker highlight on selection" onClick={() => styleSelection({ highlight: '#FDE68A' })}>Mark</button>
        <button className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Clear styles" onClick={() => setSpans(undefined)}>Clear</button>
        <button className="rounded bg-brand-500 px-2 py-1 text-white" onClick={() => commit(true)}>Done</button>
      </div>
      <textarea
        ref={ref}
        aria-label="Edit text"
        value={text}
        onChange={(e) => {
          setSpans((s) => adjustSpans(s, text, e.target.value));
          setText(e.target.value);
        }}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') commit(false);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(true);
        }}
        className="absolute z-10 resize-none overflow-hidden border-0 bg-white/85 p-0 outline-2 outline-brand-500 dark:bg-zinc-900/85"
        style={{
          left: ox + el.x * zoom,
          top: oy + el.y * zoom,
          width: el.width * zoom,
          height: Math.max(el.height * zoom, lineHeight * (text.split('\n').length + 0.2)),
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          transformOrigin: 'center',
          font: `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize * zoom}px "${cssFamily(el.fontId)}", sans-serif`,
          lineHeight: `${lineHeight}px`,
          letterSpacing: `${el.letterSpacing * zoom}px`,
          textAlign: el.align,
          color: el.fill,
          textTransform: el.textCase === 'upper' ? 'uppercase' : el.textCase === 'lower' ? 'lowercase' : el.textCase === 'title' ? 'capitalize' : 'none',
        }}
      />
    </>
  );
}
