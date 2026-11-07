import { useEffect, useState, useCallback } from 'react';
import { SOCKET_EVENTS, type DiceRollDTO } from '@tabletop/shared';
import { getSocket } from '../lib/socket.js';
import { whenLanded } from '../lib/dice3d.js';

export interface RollRequest {
  formula: string;
  // rolagens vindas da Ficha: o que foi rolado, o personagem e a conta com os atributos
  label?: string; // ex.: "Machadão — Dano"
  character?: string; // ex.: "Gailivera"
  expression?: string; // ex.: "1d8 + FOR"
  visibility?: 'PUBLIC' | 'GM' | 'PRIVATE';
  advantage?: boolean;
  disadvantage?: boolean;
}

/**
 * Rolagens em tempo real. O RESULTADO é sempre calculado no servidor (o cliente
 * só envia a fórmula); o servidor aplica a visibilidade e re-emite o que o
 * destinatário pode ver. Aqui acumulamos o histórico recebido.
 */
const ROLL_TTL_MS = 5 * 60 * 1000; // cada resultado sai do histórico 5 min depois de aparecer

export function useDiceRolls(campaignId: string) {
  const [rolls, setRolls] = useState<DiceRollDTO[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let active = true;

    async function onRoll(payload: { roll: DiceRollDTO }) {
      if (payload.roll.campaignId !== campaignId) return;
      await whenLanded(payload.roll.id); // só mostra depois que o dado 3D parar
      if (!active) return;
      setRolls((prev) => [payload.roll, ...prev].slice(0, 100)); // mantém as 100 últimas
      const timer = setTimeout(() => {
        timers.delete(timer);
        setRolls((prev) => prev.filter((r) => r.id !== payload.roll.id));
      }, ROLL_TTL_MS);
      timers.add(timer);
    }
    socket.on(SOCKET_EVENTS.DICE_ROLL, onRoll);
    return () => {
      active = false;
      socket.off(SOCKET_EVENTS.DICE_ROLL, onRoll);
      timers.forEach(clearTimeout);
    };
  }, [campaignId]);

  const rollDice = useCallback(
    (req: RollRequest) => {
      getSocket().emit(SOCKET_EVENTS.DICE_ROLL, { campaignId, ...req });
    },
    [campaignId],
  );

  // limpa o log LOCAL (não apaga o histórico do servidor)
  const clear = useCallback(() => setRolls([]), []);

  return { rolls, rollDice, clear };
}
