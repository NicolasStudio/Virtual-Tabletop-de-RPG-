import { useEffect, useRef, useState } from 'react';
import { SOCKET_EVENTS, type DiceRollDTO } from '@tabletop/shared';
import { getSocket } from '../lib/socket.js';
import { DICE_3D_CONTAINER_ID, animateRoll, clearDice, markLanded } from '../lib/dice3d.js';

const SHOW_AFTER_STOP_MS = 1800; // quanto tempo os dados ficam parados na tela

/**
 * Camada transparente por cima da mesa: cada rolagem que chega pelo socket
 * (a própria ou a de outro jogador) cai em 3D e some depois de parar.
 */
export function Dice3D({ campaignId }: { campaignId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const lastRoll = useRef(0); // uma rolagem nova cancela o "sumir" da anterior

  useEffect(() => {
    const socket = getSocket();
    async function onRoll(payload: { roll: DiceRollDTO }) {
      const container = containerRef.current;
      if (payload.roll.campaignId !== campaignId || !container) return;
      const id = ++lastRoll.current;
      setVisible(true);
      try {
        await animateRoll(container, payload.roll.breakdown);
      } catch {
        /* sem WebGL ou falha ao carregar: fica só o histórico do painel de dados */
      }
      markLanded(payload.roll.id); // libera o resultado no histórico
      await new Promise((r) => setTimeout(r, SHOW_AFTER_STOP_MS));
      if (id !== lastRoll.current) return;
      setVisible(false);
      setTimeout(() => id === lastRoll.current && clearDice(), 400); // depois do fade
    }
    socket.on(SOCKET_EVENTS.DICE_ROLL, onRoll);
    return () => {
      socket.off(SOCKET_EVENTS.DICE_ROLL, onRoll);
    };
  }, [campaignId]);

  return (
    <div
      id={DICE_3D_CONTAINER_ID}
      ref={containerRef}
      className={`dice-3d ${visible ? 'show' : ''}`}
      aria-hidden="true"
    />
  );
}
