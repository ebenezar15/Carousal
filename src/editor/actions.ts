// Editor commands shared by the toolbar, keyboard shortcuts and panels.
import { useDocument } from '@/app/store';
import { getPreset } from '@/styles';
import type { SlideElement } from '@/model/types';
import * as ops from './ops';
import { useEditor } from './store';

const doc = () => useDocument.getState();
const ed = () => useEditor.getState();
const slideEls = () => doc().carousel?.slides[ed().slideIndex]?.elements ?? [];

export const undo = () => useDocument.temporal.getState().undo();
export const redo = () => useDocument.temporal.getState().redo();

export function deleteSelection() {
  const ids = ed().selection.filter((id) => !slideEls().find((e) => e.id === id)?.locked);
  if (!ids.length) return;
  doc().apply((d) => ops.removeElements(d, ed().slideIndex, ids));
  ed().select([]);
}

export function nudge(dx: number, dy: number) {
  const ids = ed().selection.filter((id) => !slideEls().find((e) => e.id === id)?.locked);
  if (!ids.length) return;
  doc().apply((d) => ops.updateElements(d, ed().slideIndex, ids, (e) => ({ ...e, x: e.x + dx, y: e.y + dy })));
}

export function copySelection(cut = false) {
  const els = slideEls().filter((e) => ed().selection.includes(e.id));
  if (!els.length) return;
  ed().setClipboard(structuredClone(els));
  if (cut) deleteSelection();
}

/** Pastes onto the current slide (works across slides); offsets when pasting onto the same spot. */
export function paste() {
  const clip = ed().clipboard;
  if (!clip?.length) return;
  const existing = new Set(slideEls().map((e) => `${e.kind}:${e.x}:${e.y}`));
  const offset = clip.some((c) => existing.has(`${c.kind}:${c.x}:${c.y}`)) ? 24 : 0;
  const copies = clip.map((c) => ops.cloneElement(c, offset, offset));
  doc().apply((d) => ops.addElements(d, ed().slideIndex, copies));
  ed().setClipboard(copies.map((c) => structuredClone(c)));
  ed().select(copies.map((c) => c.id));
}

export function duplicateSelection() {
  const els = slideEls().filter((e) => ed().selection.includes(e.id));
  if (!els.length) return;
  const copies = els.map((c) => ops.cloneElement(c, 24, 24));
  doc().apply((d) => ops.addElements(d, ed().slideIndex, copies));
  ed().select(copies.map((c) => c.id));
}

export function addElement(el: SlideElement, opts: { behind?: boolean } = {}) {
  doc().apply((d) => {
    const next = ops.addElements(d, ed().slideIndex, [el]);
    return opts.behind ? ops.reorder(next, ed().slideIndex, [el.id], 'back') : next;
  });
  ed().select([el.id]);
}

export function groupSelection() {
  let groupId: string | null = null;
  doc().apply((d) => {
    const r = ops.group(d, ed().slideIndex, ed().selection);
    groupId = r.groupId;
    return r.doc;
  });
  if (groupId) ed().select([groupId]);
}

export function ungroupSelection() {
  const id = ed().selection[0];
  if (!id) return;
  let ids: string[] = [];
  doc().apply((d) => {
    const r = ops.ungroup(d, ed().slideIndex, id);
    ids = r.ids;
    return r.doc;
  });
  if (ids.length) ed().select(ids);
}

export const reorderSelection = (m: ops.ZMove) => doc().apply((d) => ops.reorder(d, ed().slideIndex, ed().selection, m));

export function alignSelection(edge: ops.AlignEdge) {
  const c = doc().carousel;
  if (!c) return;
  const p = getPreset(c.presetId);
  doc().apply((d) => ops.align(d, ed().slideIndex, ed().selection, edge, p));
}

export const distributeSelection = (axis: 'h' | 'v') => doc().apply((d) => ops.distribute(d, ed().slideIndex, ed().selection, axis));

export function selectAll() {
  ed().select(slideEls().filter((e) => !e.locked && !e.hidden).map((e) => e.id));
}

export function addSlideAfter(i = ed().slideIndex) {
  doc().apply((d) => ops.addSlide(d, i));
  ed().setSlide(i + 1);
}
export function duplicateSlideAt(i = ed().slideIndex) {
  doc().apply((d) => ops.duplicateSlide(d, i));
  ed().setSlide(i + 1);
}
export function deleteSlideAt(i = ed().slideIndex) {
  const n = doc().carousel?.slides.length ?? 0;
  if (n <= 1) return;
  doc().apply((d) => ops.deleteSlide(d, i));
  ed().setSlide(Math.max(0, Math.min(i, n - 2)));
}
export function moveSlide(from: number, to: number) {
  doc().apply((d) => ops.moveSlide(d, from, to));
  ed().setSlide(to);
}
export function gotoSlide(delta: number) {
  const n = doc().carousel?.slides.length ?? 1;
  ed().setSlide(Math.max(0, Math.min(n - 1, ed().slideIndex + delta)));
}

/** Copies the selected element onto the next/previous slide, offset by one slide width (continuous designs). */
export function continueSelection(direction: 'next' | 'prev') {
  const { slideIndex, selection } = ed();
  const width = getPreset(doc().carousel!.presetId).width;
  doc().apply((d) => selection.reduce((acc, id) => ops.continueAcross(acc, slideIndex, id, direction, width), d));
}
