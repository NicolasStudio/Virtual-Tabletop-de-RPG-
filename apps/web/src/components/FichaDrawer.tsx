import { useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/api.js';
import { FICHA_HOME_URL, FICHA_MSG, FICHA_ORIGIN } from '../lib/ficha.js';

interface Props {
  open: boolean;
  onClose: () => void;
  /** rolagem pedida pela Ficha (botões das armas); a mesa rola no servidor */
  onRoll: (roll: { formula: string; label: string; character?: string; expression?: string }) => void;
}

// Largura da gaveta: arrastando a borda esquerda. Fica salva neste navegador e vai
// para a variável --ficha-width (o Combate aberto junto fica ao lado da Ficha).
const WIDTH_KEY = 'tabletop:ficha-largura';
const MIN_WIDTH = 420;
const DEFAULT_WIDTH = 1240; // a Ficha foi feita para até 1200px de largura

const clampWidth = (px: number) => Math.round(Math.min(window.innerWidth, Math.max(MIN_WIDTH, px)));

function savedWidth() {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (saved > 0) return saved;
  } catch {
    /* sem localStorage: largura padrão */
  }
  return DEFAULT_WIDTH;
}

/**
 * A Ficha (site da Ficha Ordem Paranormal) dentro da mesa, numa gaveta larga à
 * direita. Depois de aberta uma vez, continua carregada quando a gaveta fecha:
 * ao reabrir está no mesmo ponto e nada que estava sendo editado se perde.
 * A Ficha entra sozinha na conta do jogador: pede o login à mesa (ver FICHA_MSG).
 */
export function FichaDrawer({ open, onClose, onRoll }: Props) {
  const [loaded, setLoaded] = useState(open);
  const [width, setWidth] = useState(savedWidth);
  const [resizing, setResizing] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ficha-width', `${clampWidth(width)}px`);
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* sem localStorage: vale só nesta visita */
    }
  }, [width]);

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  }
  function onResize(e: React.PointerEvent<HTMLDivElement>) {
    if (resizing) setWidth(clampWidth(window.innerWidth - e.clientX));
  }
  function endResize(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setResizing(false);
  }

  const onRollRef = useRef(onRoll);
  onRollRef.current = onRoll;

  useEffect(() => {
    async function onMessage(e: MessageEvent) {
      // só a Ficha desta gaveta, e só do site da Ficha
      const frame = frameRef.current?.contentWindow;
      if (!frame || e.source !== frame || e.origin !== FICHA_ORIGIN) return;
      if (e.data?.type === FICHA_MSG.roll) {
        const { formula, label, character, expression } = e.data;
        const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
        // o servidor valida a fórmula e corta os textos; aqui só barra o que nem é texto
        if (typeof formula === 'string' && formula.length <= 100) {
          onRollRef.current({
            formula,
            label: text(label, 80) ?? '',
            character: text(character, 80),
            expression: text(expression, 100),
          });
        }
        return;
      }
      if (e.data?.type !== FICHA_MSG.askLogin) return;
      try {
        const { token } = await authApi.firebaseToken();
        frame.postMessage({ type: FICHA_MSG.login, token }, FICHA_ORIGIN);
      } catch (err: any) {
        const message = err?.message ?? 'Não foi possível entrar na Ficha pela mesa.';
        frame.postMessage({ type: FICHA_MSG.loginError, message }, FICHA_ORIGIN);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!loaded) return null;
  return (
    <aside
      className={`dice-drawer ficha-drawer card ${open ? '' : 'hidden'} ${resizing ? 'resizing' : ''}`}
      aria-label="Ficha"
      aria-hidden={!open}
    >
      <div
        className="ficha-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Arraste para mudar a largura da ficha (clique duplo volta ao padrão)"
        title="Arraste para mudar a largura · clique duplo volta ao padrão"
        onPointerDown={startResize}
        onPointerMove={onResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onDoubleClick={() => setWidth(clampWidth(DEFAULT_WIDTH))}
      />
      <div className="drawer-head">
        <h3>📜 Ficha</h3>
        <div className="drawer-actions">
          <a
            className="drawer-close"
            href={FICHA_HOME_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir a ficha em uma aba nova"
            title="Abrir em aba nova"
          >
            ↗
          </a>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar" title="Fechar">
            ✕
          </button>
        </div>
      </div>
      <iframe ref={frameRef} className="ficha-frame" src={FICHA_HOME_URL} title="Ficha do personagem" />
    </aside>
  );
}
