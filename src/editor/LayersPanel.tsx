import { useState } from 'react';
import type { SlideElement } from '@/model/types';
import { useDocument } from '@/app/store';
import { useEditor } from './store';
import { moveElementTo, updateElements } from './ops';

const describe = (e: SlideElement) =>
  e.name && e.name !== e.slot ? e.name : e.kind === 'text' ? `“${e.text.slice(0, 24)}${e.text.length > 24 ? '…' : ''}”` : e.slot ? e.slot.replace(/-/g, ' ') : e.kind;

/** Layers, top-most first: select, rename (double-click), lock, hide, drag to reorder. */
export function LayersPanel() {
  const carousel = useDocument((s) => s.carousel)!;
  const apply = useDocument((s) => s.apply);
  const { slideIndex, selection, select, toggleSelect } = useEditor();
  const slide = carousel.slides[slideIndex]!;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const layers = [...slide.elements].reverse();
  const set = (id: string, patch: Partial<SlideElement>) => apply((d) => updateElements(d, slideIndex, [id], patch));

  return (
    <div className="p-3" data-testid="layers-panel">
      <p className="mb-2 text-xs text-zinc-500">Top layer first. Drag to reorder, double-click to rename.</p>
      <ul className="space-y-0.5">
        {layers.map((e) => {
          const z = slide.elements.indexOf(e);
          return (
            <li
              key={e.id}
              draggable
              onDragStart={() => setDrag(e.id)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => {
                if (drag && drag !== e.id) apply((d) => moveElementTo(d, slideIndex, drag, z));
                setDrag(null);
              }}
              className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs ${selection.includes(e.id) ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              onClick={(ev) => (ev.shiftKey ? toggleSelect(e.id) : select([e.id]))}
              data-testid="layer-row"
            >
              <span className="w-10 shrink-0 text-[10px] uppercase text-zinc-400">{e.kind}</span>
              {renaming === e.id ? (
                <input
                  autoFocus
                  aria-label="Layer name"
                  className="min-w-0 flex-1 rounded border border-brand-500 bg-white px-1 dark:bg-zinc-900"
                  defaultValue={e.name ?? ''}
                  placeholder={describe(e)}
                  onBlur={(ev) => {
                    // Escape cancels; an unchanged (or emptied) name keeps/clears the custom name only.
                    if (ev.target.dataset.cancel !== '1') {
                      const v = ev.target.value.trim();
                      if (v !== (e.name ?? '')) set(e.id, { name: v || undefined });
                    }
                    setRenaming(null);
                  }}
                  onKeyDown={(ev) => {
                    ev.stopPropagation();
                    const t = ev.target as HTMLInputElement;
                    if (ev.key === 'Escape') t.dataset.cancel = '1';
                    if (ev.key === 'Enter' || ev.key === 'Escape') t.blur();
                  }}
                />
              ) : (
                <span className={`min-w-0 flex-1 truncate ${e.hidden ? 'opacity-40' : ''}`} onDoubleClick={() => setRenaming(e.id)}>
                  {describe(e)}
                </span>
              )}
              <button className={`px-1 ${e.locked ? 'text-amber-600' : 'text-zinc-400 opacity-40 group-hover:opacity-100'}`} onClick={(ev) => { ev.stopPropagation(); set(e.id, { locked: !e.locked }); }} aria-label={e.locked ? 'Unlock layer' : 'Lock layer'} title={e.locked ? 'Unlock' : 'Lock'}>
                {e.locked ? '🔒' : '🔓'}
              </button>
              <button className={`px-1 ${e.hidden ? 'text-zinc-600' : 'text-zinc-400 opacity-40 group-hover:opacity-100'}`} onClick={(ev) => { ev.stopPropagation(); set(e.id, { hidden: !e.hidden }); }} aria-label={e.hidden ? 'Show layer' : 'Hide layer'} title={e.hidden ? 'Show' : 'Hide'}>
                {e.hidden ? '◌' : '●'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
