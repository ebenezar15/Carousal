import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { ensureFonts } from './styles/fontLoader';

void ensureFonts(['inter']); // UI font; slide fonts load on demand

if (import.meta.env.DEV) {
  // Test/debug hook (dev server only): lets end-to-end tests read editor state and Konva geometry.
  void Promise.all([import('konva'), import('./app/store'), import('./editor/store')]).then(([k, app, ed]) => {
    (window as unknown as Record<string, unknown>).__cf = { Konva: k.default, doc: app.useDocument, editor: ed.useEditor, projects: app.useProjects };
  });
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
