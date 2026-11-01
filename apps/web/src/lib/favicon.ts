// Ícone da aba: o d20 (public/favicon.svg) nas cores do tema. Troca sozinho quando
// o tema muda (perfil ou login pela Ficha); sem tema, fica o dourado original.

// faces do dado: topo, esquerda, direita, base, centro, contorno, número
type Palette = [string, string, string, string, string, string, string];

const GOLD: Palette = ['#e0b24a', '#a87a22', '#b8862a', '#8f6519', '#f3cf6a', '#2b1d06', '#2b1d06'];

const PALETTES: Record<string, Palette> = {
  classico: ['#5ccbf2', '#2a94bd', '#33a5cf', '#1f7699', '#8fe3ff', '#0f2027', '#0f2027'],
  sangue: ['#c00000', '#7a0000', '#8c0000', '#5c0000', '#e02020', '#000000', '#ffffff'],
  morte: ['#3d3d3d', '#1c1c1c', '#242424', '#111111', '#4a4a4a', '#ffffff', '#ffffff'],
  medo: ['#ffffff', '#cfcfcf', '#dadada', '#bdbdbd', '#ffffff', '#000000', '#000000'],
  conhecimento: GOLD,
  energia: ['#a98bff', '#6c4fd1', '#7a5de0', '#5a3fbb', '#c4b0ff', '#16141c', '#16141c'],
};

function d20Svg([top, left, right, bottom, center, outline, text]: Palette) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    `<g stroke="${outline}" stroke-width="4" stroke-linejoin="round">` +
    `<polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="${bottom}"/>` +
    `<polygon points="50,3 91,26 50,27 9,26" fill="${top}"/>` +
    `<polygon points="9,26 50,27 23,71 9,74" fill="${left}"/>` +
    `<polygon points="91,26 50,27 77,71 91,74" fill="${right}"/>` +
    `<polygon points="9,74 23,71 77,71 91,74 50,97" fill="${bottom}"/>` +
    `<polygon points="50,27 77,71 23,71" fill="${center}"/>` +
    '</g><text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" ' +
    `font-size="23" font-weight="700" fill="${text}">20</text></svg>`
  );
}

function updateFavicon() {
  const palette = PALETTES[document.documentElement.dataset.tema ?? ''] ?? GOLD;
  const href = 'data:image/svg+xml,' + encodeURIComponent(d20Svg(palette));
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
    link.href = href;
  });
}

/** Pinta o ícone agora e acompanha as trocas de tema. */
export function watchFavicon() {
  updateFavicon();
  new MutationObserver(updateFavicon).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-tema'],
  });
}
