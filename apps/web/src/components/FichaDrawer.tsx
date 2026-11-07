import { useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/api.js';
import { FICHA_MSG, FICHA_ORIGIN, FICHA_TABS, type FichaTabId } from '../lib/ficha.js';

interface Props {
  open: boolean;
  onClose: () => void;
  isGm: boolean; // o mestre também tem as abas Bestiário e Enviar itens
  /** aba aberta: vem da cena, porque os botões da barra também escolhem a aba */
  tab: FichaTabId;
  onTabChange: (tab: FichaTabId) => void;
  /** rolagem pedida pela Ficha (botões das armas); a mesa rola no servidor */
  onRoll: (roll: {
    formula: string;
    label: string;
    character?: string;
    characterKind?: 'character' | 'creature';
    expression?: string;
  }) => void;
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
const urlOf = (id: FichaTabId) => FICHA_TABS.find((t) => t.id === id)!.url;

export function FichaDrawer({ open, onClose, isGm, tab, onTabChange, onRoll }: Props) {
  // endereço inicial, definido na primeira vez que a gaveta abre (já na aba escolhida)
  const [firstSrc, setFirstSrc] = useState<string | null>(null);
  const [width, setWidth] = useState(savedWidth);
  const [resizing, setResizing] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shownUrl = useRef<string | null>(null); // tela que o iframe recebeu por último
  const tabs = FICHA_TABS.filter((t) => isGm || !t.gmOnly);

  // a cena trocou a aba (botões da barra): leva o iframe para a tela dela
  useEffect(() => {
    if (!open) return;
    const url = urlOf(tab);
    if (firstSrc === null) {
      setFirstSrc(url);
    } else if (shownUrl.current !== url && frameRef.current) {
      frameRef.current.src = url;
    }
    shownUrl.current = url;
  }, [open, tab, firstSrc]);

  // Clique numa aba da gaveta: sempre leva ao início da tela (mesmo na aba já ativa,
  // ex.: voltar da ficha aberta para a lista de fichas)
  function openTab(id: FichaTabId) {
    const url = urlOf(id);
    if (frameRef.current) frameRef.current.src = url;
    shownUrl.current = url;
    onTabChange(id);
  }

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
        const { formula, label, character, characterKind, expression } = e.data;
        const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
        // o servidor valida a fórmula e corta os textos; aqui só barra o que nem é texto
        if (typeof formula === 'string' && formula.length <= 100) {
          onRollRef.current({
            formula,
            label: text(label, 80) ?? '',
            character: text(character, 80),
            characterKind: characterKind === 'creature' ? 'creature' : 'character',
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

  if (firstSrc === null) return null; // ainda não foi aberta
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
        <nav className="ficha-tabs" aria-label="Telas da Ficha">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`ficha-tab ${t.id === tab ? 'active' : ''}`}
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => openTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="drawer-actions">
          <a
            className="drawer-close"
            href={urlOf(tab)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir esta tela em uma aba nova"
            title="Abrir em aba nova"
          >
            ↗
          </a>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar" title="Fechar">
            ✕
          </button>
        </div>
      </div>
      {/* src fixo: depois de aberta, as abas trocam a tela direto no iframe, sem o React recarregar */}
      <iframe ref={frameRef} className="ficha-frame" src={firstSrc} title="Ficha" />
    </aside>
  );
}
