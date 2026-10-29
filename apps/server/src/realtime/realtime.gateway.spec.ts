import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@tabletop/shared';
import { RealtimeGateway } from './realtime.gateway.js';

// Integração de tempo real SEM banco: gateway real + socket.io real + 2 clientes.
// TokenService/Prisma/ScenesService são mockados; validamos o CONTRATO de
// eventos e a RE-EMISSÃO autoritativa para a sala.

const tokensSvc = {
  verifyAccess: vi.fn((t: string) => ({ sub: t === 'gm-token' ? 'gm' : 'player', email: 'x', isAdmin: false })),
} as any;

const prisma = {
  campaignMember: {
    findUnique: vi.fn(async ({ where }: any) => ({
      role: where.campaignId_userId.userId === 'gm' ? 'GM' : 'PLAYER',
    })),
    findMany: vi.fn(async () => [
      { userId: 'gm', role: 'GM', user: { displayName: 'Mestre' } },
    ]),
  },
} as any;

// ScenesService.updateToken devolve o token "persistido" (eco do pedido)
const scenes = {
  updateToken: vi.fn(async (_c: string, tokenId: string, _u: string, _r: string, data: any) => ({
    id: tokenId, sceneId: 's1', name: 'Herói', x: data.x, y: data.y, rotation: data.rotation ?? 0,
    width: 70, height: 70, layer: 'tokens', isLocked: false, isHidden: false, stats: {},
    ownerUserId: 'player', characterId: null, imageAssetId: null, groupId: null,
  })),
} as any;

let httpServer: HttpServer;
let ioServer: Server;
let port: number;
let gateway: RealtimeGateway;

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  gateway = new RealtimeGateway(tokensSvc, prisma, scenes);
  (gateway as any).server = ioServer;

  // liga os handlers do gateway ao socket.io real (o que o decorator faria)
  ioServer.on('connection', (socket) => {
    gateway.handleConnection(socket as any);
    socket.on(SOCKET_EVENTS.JOIN_CAMPAIGN, (b) => gateway.onJoin(socket as any, b));
    socket.on(SOCKET_EVENTS.TOKEN_MOVE, (b) => gateway.onTokenMove(socket as any, b));
  });

  await new Promise<void>((r) => httpServer.listen(() => r()));
  port = (httpServer.address() as any).port;
});

afterAll(async () => {
  ioServer.close();
  httpServer.close();
});

function connect(token: string): Promise<ClientSocket> {
  const c = Client(`http://localhost:${port}`, { transports: ['websocket'], auth: { token } });
  return new Promise((resolve) => c.on('connect', () => resolve(c)));
}

describe('RealtimeGateway — integração', () => {
  it('conexão sem token é recusada', async () => {
    const c = Client(`http://localhost:${port}`, { transports: ['websocket'], auth: {} });
    const disconnected = await new Promise<boolean>((resolve) => {
      c.on('disconnect', () => resolve(true));
      setTimeout(() => resolve(false), 1500);
    });
    c.close();
    expect(disconnected).toBe(true);
  });

  it('movimento de um cliente é re-emitido autoritativo para o outro na sala', async () => {
    const gm = await connect('gm-token');
    const player = await connect('player-token');

    gm.emit(SOCKET_EVENTS.JOIN_CAMPAIGN, { campaignId: 'c1' });
    player.emit(SOCKET_EVENTS.JOIN_CAMPAIGN, { campaignId: 'c1' });
    await new Promise((r) => setTimeout(r, 150));

    const received = new Promise<any>((resolve) => {
      player.on(SOCKET_EVENTS.TOKEN_MOVE, (payload) => resolve(payload));
    });

    gm.emit(SOCKET_EVENTS.TOKEN_MOVE, { campaignId: 'c1', tokenId: 't1', x: 210, y: 140 });

    const payload = await received;
    expect(payload.token.id).toBe('t1');
    expect(payload.token.x).toBe(210); // valor VINDO DO SERVIDOR (eco do service)
    expect(scenes.updateToken).toHaveBeenCalled();

    gm.close();
    player.close();
  });
});
