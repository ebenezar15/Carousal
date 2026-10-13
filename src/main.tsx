import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { ensureFonts } from './styles/fontLoader';

void ensureFonts(['inter']); // UI font; slide fonts load on demand
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
