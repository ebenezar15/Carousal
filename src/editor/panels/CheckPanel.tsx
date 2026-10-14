import { useEffect, useRef, useState } from 'react';
import { useDocument } from '@/app/store';
import { checkCarousel, type Issue } from '../accessibility';
import { canvasSampler } from '../sampler';
import { updateElements } from '../ops';
import { useEditor } from '../store';
import { patchText } from './TextProps';
import type { TextElement } from '@/model/types';

const ICON = { error: '⛔', warning: '⚠', info: 'ℹ' } as const;

/** Accessibility & readability check: contrast on the real background, sizes, safe zone, alt text. */
export function CheckPanel() {
  const carousel = useDocument((s) => s.carousel)!;
  const apply = useDocument((s) => s.apply);
  const { setSlide, select } = useEditor();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const found = await checkCarousel(carousel, canvasSampler(carousel.presetId));
        if (id === run.current) setIssues(found);
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [carousel]);

  const counts = { error: 0, warning: 0, info: 0 };
  issues?.forEach((i) => counts[i.severity]++);

  return (
    <div className="p-3" data-testid="check-panel">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="font-medium">{busy && !issues ? 'Checking…' : issues?.length ? `${issues.length} issue${issues.length > 1 ? 's' : ''}` : 'No issues found ✓'}</span>
        {busy && issues && <span className="text-zinc-400">updating…</span>}
        <span className="ml-auto text-zinc-500">{counts.error} errors · {counts.warning} warnings</span>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500">Contrast is measured on the actual pixels behind each text box (WCAG AA: 4.5:1, 3:1 for large text). Sizes assume the slide is viewed on a phone.</p>
      <ul className="space-y-2">
        {issues?.map((i) => (
          <li key={i.id} className="rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800" data-testid="issue" data-kind={i.kind} data-severity={i.severity}>
            <button
              className="w-full text-left"
              onClick={() => {
                setSlide(i.slideIndex);
                if (i.elementId) setTimeout(() => select([i.elementId!]), 0);
              }}
            >
              <span className="mr-1">{ICON[i.severity]}</span>
              <span className="font-medium">Slide {i.slideIndex + 1}:</span> {i.message}
            </button>
            {i.fix && i.elementId && (
              <button
                className="mt-1 rounded border border-brand-500 px-2 py-0.5 text-[11px] text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                onClick={() =>
                  apply((d) =>
                    updateElements(d, i.slideIndex, [i.elementId!], (e) => (e.kind === 'text' ? patchText(e as TextElement, i.fix!.patch as Partial<TextElement>, 'fontSize' in i.fix!.patch) : ({ ...e, ...i.fix!.patch } as typeof e))),
                  )
                }
              >
                Fix: {i.fix.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
