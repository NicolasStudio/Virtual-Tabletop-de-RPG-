// Endereços da Ficha Ordem Paranormal (GitHub Pages), de onde vêm o login e a
// ficha aberta dentro da mesa (FichaDrawer).
export const FICHA_BASE =
  import.meta.env.VITE_FICHA_BASE ?? 'https://nicolasstudio.github.io/Ficha_ordem/';

/** Página que abre a sessão do Tabletop com a conta da Ficha. */
export const FICHA_LOGIN_URL = import.meta.env.VITE_FICHA_URL ?? `${FICHA_BASE}tabletop.html`;

/** Lista de fichas do jogador (sem login, a própria Ficha mostra a tela de entrar). */
export const FICHA_HOME_URL = `${FICHA_BASE}home.html`;

/** Só desta origem a mesa aceita (e para ela manda) mensagens da Ficha embutida. */
export const FICHA_ORIGIN = new URL(FICHA_BASE).origin;

/**
 * Conversa com a Ficha aberta dentro da mesa (postMessage). Dentro de outro site
 * o navegador costuma bloquear o login salvo da Ficha; então cada página dela,
 * sem login, pede um à mesa e entra com o custom token do Firebase que o
 * servidor gera para o usuário da mesa (GET /api/auth/firebase/token).
 * O outro lado fica na Ficha: Js/scriptFirebase.js (exigirLogin).
 */
export const FICHA_MSG = {
  askLogin: 'ficha:pedir-login', // Ficha -> mesa
  login: 'ficha:login', // mesa -> Ficha: { token }
  loginError: 'ficha:login-erro', // mesa -> Ficha: { message }
  // Ficha -> mesa: { formula, label } — botões 🎲/💥 das armas (Js/scriptArmas.js da Ficha);
  // a mesa rola no servidor, pública, como qualquer rolagem
  roll: 'ficha:rolar',
} as const;
