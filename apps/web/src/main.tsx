import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { applyTheme } from './lib/theme.js';
import { watchFavicon } from './lib/favicon.js';
import './theme.css';

applyTheme(); // antes de desenhar, para não piscar o tema padrão
watchFavicon(); // d20 da aba nas cores do tema

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
