import { useEffect, useState, useCallback } from 'react';
import { SOCKET_EVENTS } from '@tabletop/shared';
import { getSocket } from '../lib/socket.js';
import { combatApi, type Encounter } from '../lib/combat.js';

/**
 * Combate ao vivo: carrega o estado via REST e escuta combat:update (emitido
 * pelo servidor a cada mutação do GM). O estado é SEMPRE o do servidor.
 */
export function useCombat(campaignId: string) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);

  const reload = useCallback(async () => {
    setEncounter(await combatApi.get(campaignId));
  }, [campaignId]);

  useEffect(() => {
    void reload();
    const socket = getSocket();
    function onUpdate(payload: { encounter: Encounter | null }) {
      setEncounter(payload.encounter);
    }
    socket.on(SOCKET_EVENTS.COMBAT_UPDATE, onUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.COMBAT_UPDATE, onUpdate);
    };
  }, [campaignId, reload]);

  return { encounter, reload };
}
