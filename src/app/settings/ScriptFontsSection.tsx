// Fonts for other languages: by default each design's font category picks a matching script font
// (e.g. a serif design uses a high-contrast Tamil face). Here users can pin one font per script instead.
import { useEffect } from 'react';
import { scripts, familyLabel } from '@/styles/scriptFonts';
import { cssFamily, ensureFonts } from '@/styles/fontLoader';
import { findFont } from '@/styles';
import { useSettings } from '../store';

const SAMPLE: Record<string, string> = { tamil: 'தொலைதூர அணிகளை வேகமாக்குங்கள் — லை ளை னை ணை ணா றா னா' };

export function ScriptFontsSection() {
  const { settings, update } = useSettings();
  const configurable = scripts.filter((s) => s.alternatives?.length);
  useEffect(() => {
    void ensureFonts(configurable.flatMap((s) => s.alternatives ?? []).filter((id) => findFont(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="card space-y-3 p-5" aria-labelledby="scriptfonts-h">
      <h2 id="scriptfonts-h" className="font-semibold">Fonts for other languages</h2>
      <p className="text-xs text-zinc-500">Text in other scripts keeps the design's look: each design picks a matching font automatically. You can also use one font everywhere. Only fonts in today's (reformed) script are offered.</p>
      {configurable.map((s) => {
        const chosen = settings.scriptFonts?.[s.id] ?? '';
        const preview = chosen || s.fonts['sans-serif'];
        return (
          <div key={s.id} className="space-y-2">
            <label className="label" htmlFor={`sf-${s.id}`}>{s.label} font</label>
            <select id={`sf-${s.id}`} className="field" value={chosen} onChange={(e) => update({ scriptFonts: { ...settings.scriptFonts, [s.id]: e.target.value } })}>
              <option value="">Match each design (recommended)</option>
              {s.alternatives!.map((id) => <option key={id} value={id}>{familyLabel(id)}</option>)}
            </select>
            {SAMPLE[s.id] && (
              <p className="rounded-lg bg-zinc-50 p-3 text-xl dark:bg-zinc-900" style={{ fontFamily: `"${cssFamily(preview)}", sans-serif` }} data-testid={`sf-preview-${s.id}`}>
                {SAMPLE[s.id]}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
