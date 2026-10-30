import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { getAccessToken } from './api.js';

// Vazio = mesma origem do app (o Vite repassa /socket.io para o servidor)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket: Socket | null = null;

/**
 * Conexão Socket.IO única por sessão. Autentica pelo access token (em memória).
 * Reconecta automaticamente; ao reconectar, o chamador deve re-emitir JOIN e
 * recarregar o estado autoritativo (state:sync via REST get da cena).
 */
export function getSocket(): Socket {
  if (socket) return socket;
  const options: Partial<ManagerOptions & SocketOptions> = {
    autoConnect: true,
    transports: ['websocket'],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  };
  socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
