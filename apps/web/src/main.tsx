import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { applyTheme } from './lib/theme.js';
import './theme.css';

applyTheme(); // antes de desenhar, para não piscar o tema padrão

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
