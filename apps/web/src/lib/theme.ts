// Tema de cores vindo da Ficha Ordem Paranormal: o login pela Ficha redireciona
// para /?tema=<id>. Fica salvo neste navegador e vale nas próximas visitas; também
// dá para trocar no perfil (ProfilePage). Sem tema escolhido, fica o tema medieval
// original do Tabletop (theme.css).
export const THEMES = [
  { id: 'classico', name: 'Clássico', description: 'Azul e ciano: o visual original.' },
  { id: 'sangue', name: 'Sangue', description: 'Vermelho-sangue, preto e branco.' },
  { id: 'morte', name: 'Morte', description: 'Preto e branco.' },
  { id: 'conhecimento', name: 'Conhecimento', description: 'Claro: branco e dourado.' },
  { id: 'energia', name: 'Energia', description: 'Escuro, puxado para o roxo.' },
] as const;

const STORAGE_KEY = 'tabletop:tema';
const isTheme = (id: string | null): id is string => !!id && THEMES.some((t) => t.id === id);

export const currentTheme = () => document.documentElement.dataset.tema ?? null;

/** Aplica na hora e guarda neste navegador. */
export function setTheme(id: string) {
  if (!isTheme(id)) return;
  document.documentElement.dataset.tema = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* sem localStorage o tema vale só nesta visita */
  }
}

export function applyTheme() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('tema');
  if (fromUrl !== null) {
    setTheme(fromUrl);
    url.searchParams.delete('tema');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  if (document.documentElement.dataset.tema) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isTheme(saved)) document.documentElement.dataset.tema = saved;
  } catch {
    /* localStorage bloqueado: fica o tema padrão */
  }
}
