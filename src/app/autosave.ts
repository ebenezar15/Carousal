// Saves the open document back into its project, debounced, on every page (Generate captions and
// editor edits alike). Pending changes are flushed when the window is hidden or closed, so a quick
// reload never loses the last edit.
import { create } from 'zustand';
import { getPreset } from '@/styles';
import { renderSlide } from '@/export/render';
import { useDocument, useProjects } from './store';

export const useSaveStatus = create<{ status: 'saved' | 'saving' }>(() => ({ status: 'saved' }));

let timer: number | undefined;
let pending = false;

async function saveNow(withThumbnail: boolean) {
  window.clearTimeout(timer);
  if (!pending) return;
  pending = false;
  const { current, save } = useProjects.getState();
  const { carousel, plan } = useDocument.getState();
  if (!current || !carousel || carousel.id !== current.carousel.id) return void useSaveStatus.setState({ status: 'saved' });
  let thumbnail = current.thumbnail;
  if (withThumbnail) {
    try {
      const p = getPreset(carousel.presetId);
      if (carousel.slides[0]) thumbnail = await renderSlide(carousel.slides[0], p.width, p.height, { pixelRatio: 240 / p.width, mime: 'image/jpeg', quality: 0.8 });
    } catch {
      /* keep the old thumbnail */
    }
  }
  await save({ ...current, carousel, plan: plan ?? current.plan, thumbnail });
  if (!pending) useSaveStatus.setState({ status: 'saved' });
}

/** Writes pending changes immediately (skips the thumbnail so it's quick). */
export const flushAutosave = () => saveNow(false);

export function startAutosave(): () => void {
  const unsub = useDocument.subscribe((s, prev) => {
    if (s.carousel === prev.carousel && s.plan === prev.plan) return;
    const current = useProjects.getState().current;
    // Opening a project loads exactly what was saved: nothing to do.
    if (!current || (s.carousel === current.carousel && s.plan === (current.plan ?? null))) return;
    pending = true;
    useSaveStatus.setState({ status: 'saving' });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void saveNow(true), 700);
  });
  const onHide = () => document.visibilityState === 'hidden' && void flushAutosave();
  const onUnload = () => void flushAutosave();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onUnload);
  window.addEventListener('beforeunload', onUnload);
  return () => {
    unsub();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onUnload);
    window.removeEventListener('beforeunload', onUnload);
  };
}
