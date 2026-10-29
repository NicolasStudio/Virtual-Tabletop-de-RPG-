import { useEffect, useState, useCallback } from 'react';
import { SOCKET_EVENTS, type DiceRollDTO } from '@tabletop/shared';
import { getSocket } from '../lib/socket.js';

export interface RollRequest {
  formula: string;
  visibility?: 'PUBLIC' | 'GM' | 'PRIVATE';
  advantage?: boolean;
  disadvantage?: boolean;
}

/**
 * Rolagens em tempo real. O RESULTADO é sempre calculado no servidor (o cliente
 * só envia a fórmula); o servidor aplica a visibilidade e re-emite o que o
 * destinatário pode ver. Aqui acumulamos o histórico recebido.
 */
export function useDiceRolls(campaignId: string) {
  const [rolls, setRolls] = useState<DiceRollDTO[]>([]);

  useEffect(() => {
    const socket = getSocket();
    function onRoll(payload: { roll: DiceRollDTO }) {
      if (payload.roll.campaignId !== campaignId) return;
      setRolls((prev) => [payload.roll, ...prev].slice(0, 100)); // mantém as 100 últimas
    }
    socket.on(SOCKET_EVENTS.DICE_ROLL, onRoll);
    return () => {
      socket.off(SOCKET_EVENTS.DICE_ROLL, onRoll);
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
