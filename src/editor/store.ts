// Editor UI state (not part of the document / undo history).
import { create } from 'zustand';
import type { SlideElement } from '@/model/types';

export type LeftTab = 'slides' | 'layers' | 'insert' | 'design' | 'templates';

interface EditorState {
  slideIndex: number;
  selection: string[];
  zoom: number;
  fit: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showSafe: boolean;
  snap: boolean;
  editingTextId: string | null;
  clipboard: SlideElement[] | null;
  leftTab: LeftTab;
  setSlide(i: number): void;
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  setZoom(z: number): void;
  setFit(): void;
  toggle(key: 'showGrid' | 'showRulers' | 'showSafe' | 'snap'): void;
  setEditing(id: string | null): void;
  setClipboard(els: SlideElement[]): void;
  setLeftTab(t: LeftTab): void;
}

export const useEditor = create<EditorState>((set) => ({
  slideIndex: 0,
  selection: [],
  zoom: 0.5,
  fit: true,
  showGrid: false,
  showRulers: true,
  showSafe: true,
  snap: true,
  editingTextId: null,
  clipboard: null,
  leftTab: 'slides',
  setSlide: (i) => set({ slideIndex: i, selection: [], editingTextId: null }),
  select: (ids) => set({ selection: ids }),
  toggleSelect: (id) => set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.1, z)), fit: false }),
  setFit: () => set({ fit: true }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<EditorState>),
  setEditing: (id) => set({ editingTextId: id }),
  setClipboard: (els) => set({ clipboard: els }),
  setLeftTab: (t) => set({ leftTab: t }),
}));
