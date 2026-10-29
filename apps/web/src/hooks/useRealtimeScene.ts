import { useEffect, useRef, useState, useCallback } from 'react';
import { SOCKET_EVENTS, type TokenDTO } from '@tabletop/shared';
import { getSocket } from '../lib/socket.js';

export interface PresenceUser {
  userId: string;
  displayName: string;
  role: string;
}

/**
 * Liga a cena ao tempo real:
 *  - entra na sala da campanha
 *  - aplica token:move/token:update re-emitidos pelo servidor (autoritativos)
 *  - expõe sendMove para enviar movimento (o servidor valida e re-emite)
 *  - onReconnect: o chamador deve recarregar o estado (state:sync)
 */
export function useRealtimeScene(
  campaignId: string,
  onAuthoritativeToken: (token: TokenDTO) => void,
  onReconnect: () => void,
  onError: (msg: string) => void,
  handlers?: {
    onSceneActivate?: (sceneId: string) => void;
    onTokenCreate?: (token: TokenDTO) => void;
    onTokenDelete?: (tokenId: string) => void;
    onOverlay?: (action: 'create' | 'update' | 'delete', overlay: any) => void;
  },
) {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const firstConnect = useRef(true);
  // guarda os handlers numa ref para não re-assinar os listeners a cada render
  const hRef = useRef(handlers);
  hRef.current = handlers;

  useEffect(() => {
    const socket = getSocket();

    const join = () => socket.emit(SOCKET_EVENTS.JOIN_CAMPAIGN, { campaignId });

    function handleConnect() {
      setConnected(true);
      join();
      if (!firstConnect.current) onReconnect(); // reconexão: ressincroniza estado
      firstConnect.current = false;
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleToken(payload: { token: TokenDTO }) {
      onAuthoritativeToken(payload.token);
    }
    function handlePresence(payload: { campaignId: string; online: PresenceUser[] }) {
      if (payload.campaignId === campaignId) setOnline(payload.online);
    }
    function handleError(payload: { message?: string }) {
      if (payload?.message) onError(payload.message);
    }
    function handleSceneActivate(payload: { campaignId: string; sceneId: string }) {
      if (payload.campaignId === campaignId) hRef.current?.onSceneActivate?.(payload.sceneId);
    }
    function handleTokenCreate(payload: { token: TokenDTO }) {
      hRef.current?.onTokenCreate?.(payload.token);
    }
    function handleTokenDelete(payload: { tokenId: string }) {
      hRef.current?.onTokenDelete?.(payload.tokenId);
    }
    function handleSceneUpdate(payload: { kind: string; action: 'create' | 'update' | 'delete'; overlay: any }) {
      if (payload.kind === 'overlay') hRef.current?.onOverlay?.(payload.action, payload.overlay);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(SOCKET_EVENTS.TOKEN_MOVE, handleToken);
    socket.on(SOCKET_EVENTS.TOKEN_UPDATE, handleToken);
    socket.on(SOCKET_EVENTS.TOKEN_CREATE, handleTokenCreate);
    socket.on(SOCKET_EVENTS.TOKEN_DELETE, handleTokenDelete);
    socket.on(SOCKET_EVENTS.SCENE_ACTIVATE, handleSceneActivate);
    socket.on(SOCKET_EVENTS.SCENE_UPDATE, handleSceneUpdate);
    socket.on(SOCKET_EVENTS.PRESENCE, handlePresence);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    if (socket.connected) handleConnect();

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_CAMPAIGN, { campaignId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(SOCKET_EVENTS.TOKEN_MOVE, handleToken);
      socket.off(SOCKET_EVENTS.TOKEN_UPDATE, handleToken);
      socket.off(SOCKET_EVENTS.TOKEN_CREATE, handleTokenCreate);
      socket.off(SOCKET_EVENTS.TOKEN_DELETE, handleTokenDelete);
      socket.off(SOCKET_EVENTS.SCENE_ACTIVATE, handleSceneActivate);
      socket.off(SOCKET_EVENTS.SCENE_UPDATE, handleSceneUpdate);
      socket.off(SOCKET_EVENTS.PRESENCE, handlePresence);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const sendMove = useCallback(
    (tokenId: string, x: number, y: number, rotation?: number) => {
      getSocket().emit(SOCKET_EVENTS.TOKEN_MOVE, { campaignId, tokenId, x, y, rotation });
    },
    [campaignId],
  );

  const sendUpdate = useCallback(
    (tokenId: string, patch: Partial<TokenDTO>) => {
      getSocket().emit(SOCKET_EVENTS.TOKEN_UPDATE, { campaignId, tokenId, patch });
    },
    [campaignId],
  );

  return { online, connected, sendMove, sendUpdate };
}
