// Contrato de eventos Socket.IO. Um nome só, em um só lugar, para os dois lados.
// Regra: todo evento que muda estado é ENVIADO ao servidor (client->server),
// validado/persistido, e re-emitido pelo servidor (server->client). O cliente
// nunca confia num evento de outro cliente — só no re-emitido pelo servidor.

import type { TokenDTO, SceneDTO, DiceRollDTO, ChatMessageDTO } from './types.js';

export const SOCKET_EVENTS = {
  // sala
  JOIN_CAMPAIGN: 'campaign:join',
  LEAVE_CAMPAIGN: 'campaign:leave',
  PRESENCE: 'campaign:presence',

  // cena / tokens (client -> server: pedido; server -> client: autoritativo)
  TOKEN_MOVE: 'token:move',
  TOKEN_UPDATE: 'token:update',
  TOKEN_CREATE: 'token:create',
  TOKEN_DELETE: 'token:delete',
  SCENE_UPDATE: 'scene:update',
  SCENE_ACTIVATE: 'scene:activate',

  // fog of war (apenas GM emite ao servidor; servidor filtra por papel)
  FOG_UPDATE: 'fog:update',

  // dados e chat
  DICE_ROLL: 'dice:roll',
  CHAT_MESSAGE: 'chat:message',

  // combate
  COMBAT_UPDATE: 'combat:update',

  // erros e sync
  ERROR: 'error',
  STATE_SYNC: 'state:sync',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// Payloads client -> server (pedidos). O servidor valida tudo.
export interface TokenMoveRequest {
  sceneId: string;
  tokenId: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface DiceRollRequest {
  campaignId: string;
  formula: string;
  visibility?: 'PUBLIC' | 'GM' | 'PRIVATE';
}

export interface ChatMessageRequest {
  campaignId: string;
  body: string;
  toUserId?: string | null;
}

// Payloads server -> client (autoritativos)
export interface TokenMovedEvent {
  token: TokenDTO;
}
export interface SceneUpdatedEvent {
  scene: SceneDTO;
}
export interface DiceRolledEvent {
  roll: DiceRollDTO;
}
export interface ChatMessageEvent {
  message: ChatMessageDTO;
}
export interface PresenceEvent {
  campaignId: string;
  online: { userId: string; displayName: string; role: string }[];
}
export interface SocketErrorEvent {
  event: string;
  code: string;
  message: string;
}
