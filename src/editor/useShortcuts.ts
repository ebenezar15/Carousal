import { useEffect } from 'react';
import * as A from './actions';
import { useEditor } from './store';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Editor keyboard shortcuts (⌘ on macOS = Ctrl elsewhere). Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const ed = useEditor.getState();
      const handled = () => e.preventDefault();
      if (mod && k === 'z' && !e.shiftKey) return handled(), A.undo();
      if ((mod && k === 'z' && e.shiftKey) || (mod && k === 'y')) return handled(), A.redo();
      if (mod && k === 'c') return handled(), A.copySelection();
      if (mod && k === 'x') return handled(), A.copySelection(true);
      if (mod && k === 'v') return handled(), A.paste();
      if (mod && k === 'd') return handled(), A.duplicateSelection();
      if (mod && k === 'a') return handled(), A.selectAll();
      if (mod && k === 'g' && e.shiftKey) return handled(), A.ungroupSelection();
      if (mod && k === 'g') return handled(), A.groupSelection();
      if (mod && (k === '=' || k === '+')) return handled(), ed.setZoom(ed.zoom * 1.2);
      if (mod && k === '-') return handled(), ed.setZoom(ed.zoom / 1.2);
      if (mod && k === '0') return handled(), ed.setFit();
      if (k === ']') return handled(), A.reorderSelection(mod ? 'front' : 'forward');
      if (k === '[') return handled(), A.reorderSelection(mod ? 'back' : 'backward');
      if (k === 'delete' || k === 'backspace') return handled(), A.deleteSelection();
      if (k === 'escape') return ed.select([]);
      if (k === 'pagedown') return handled(), A.gotoSlide(1);
      if (k === 'pageup') return handled(), A.gotoSlide(-1);
      const step = e.shiftKey ? 10 : 1;
      if (k === 'arrowleft') return handled(), A.nudge(-step, 0);
      if (k === 'arrowright') return handled(), A.nudge(step, 0);
      if (k === 'arrowup') return handled(), A.nudge(0, -step);
      if (k === 'arrowdown') return handled(), A.nudge(0, step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
