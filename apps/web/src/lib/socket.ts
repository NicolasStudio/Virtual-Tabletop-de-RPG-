import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Conexão Socket.IO única por sessão. Autentica pelo access token (em memória).
 * Reconecta automaticamente; ao reconectar, o chamador deve re-emitir JOIN e
 * recarregar o estado autoritativo (state:sync via REST get da cena).
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
