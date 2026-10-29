import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, roll } from '@tabletop/shared';
import type { CampaignRole, TokenDTO } from '@tabletop/shared';
import { TokenService } from '../auth/token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScenesService } from '../scenes/scenes.service.js';

interface SocketData {
  userId: string;
  // papel por campanha já verificado nesta conexão (cache leve)
  roles: Map<string, CampaignRole>;
}

function room(campaignId: string) {
  return `campaign:${campaignId}`;
}

/**
 * Gateway de tempo real. Regras:
 *  - Handshake autenticado por JWT (auth.token). Sem token válido = desconecta.
 *  - Só entra na sala de uma campanha se for membro (papel lido do banco).
 *  - Todo evento que muda estado é VALIDADO e PERSISTIDO aqui; só então é
 *    re-emitido para a sala. O cliente nunca é autoridade.
 */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly scenes: ScenesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);
      if (!token) throw new Error('sem token');
      const payload = this.tokens.verifyAccess(token);
      (client.data as SocketData) = { userId: payload.sub, roles: new Map() };
    } catch {
      client.emit(SOCKET_EVENTS.ERROR, { event: 'connect', code: 'unauthorized', message: 'Token inválido.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`socket desconectado: ${client.id}`);
  }

  private async roleFor(client: Socket, campaignId: string): Promise<CampaignRole | null> {
    const data = client.data as SocketData;
    if (data.roles.has(campaignId)) return data.roles.get(campaignId)!;
    const m = await this.prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId, userId: data.userId } },
    });
    if (!m) return null;
    data.roles.set(campaignId, m.role as CampaignRole);
    return m.role as CampaignRole;
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_CAMPAIGN)
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { campaignId: string }) {
    const role = await this.roleFor(client, body.campaignId);
    if (!role) {
      client.emit(SOCKET_EVENTS.ERROR, { event: SOCKET_EVENTS.JOIN_CAMPAIGN, code: 'forbidden', message: 'Não é membro.' });
      return;
    }
    await client.join(room(body.campaignId));
    await this.broadcastPresence(body.campaignId);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_CAMPAIGN)
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { campaignId: string }) {
    await client.leave(room(body.campaignId));
    await this.broadcastPresence(body.campaignId);
  }

  @SubscribeMessage(SOCKET_EVENTS.TOKEN_MOVE)
  async onTokenMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { campaignId: string; tokenId: string; x: number; y: number; rotation?: number },
  ) {
    const data = client.data as SocketData;
    const role = await this.roleFor(client, body.campaignId);
    if (!role) return this.deny(client, SOCKET_EVENTS.TOKEN_MOVE);

    try {
      // o service aplica o controle de propriedade/lock e persiste (autoritativo)
      const updated: TokenDTO = await this.scenes.updateToken(
        body.campaignId,
        body.tokenId,
        data.userId,
        role,
        { x: body.x, y: body.y, ...(body.rotation !== undefined ? { rotation: body.rotation } : {}) },
      );
      // re-emite para TODOS na sala (inclusive quem enviou, para confirmar o estado real)
      this.server.to(room(body.campaignId)).emit(SOCKET_EVENTS.TOKEN_MOVE, { token: updated });
    } catch (e: any) {
      client.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.TOKEN_MOVE,
        code: 'rejected',
        message: e?.message ?? 'Movimento rejeitado.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TOKEN_UPDATE)
  async onTokenUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { campaignId: string; tokenId: string; patch: Partial<TokenDTO> },
  ) {
    const data = client.data as SocketData;
    const role = await this.roleFor(client, body.campaignId);
    if (!role) return this.deny(client, SOCKET_EVENTS.TOKEN_UPDATE);
    try {
      const updated = await this.scenes.updateToken(body.campaignId, body.tokenId, data.userId, role, body.patch);
      this.server.to(room(body.campaignId)).emit(SOCKET_EVENTS.TOKEN_UPDATE, { token: updated });
    } catch (e: any) {
      client.emit(SOCKET_EVENTS.ERROR, { event: SOCKET_EVENTS.TOKEN_UPDATE, code: 'rejected', message: e?.message });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DICE_ROLL)
  async onDiceRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { campaignId: string; formula: string; visibility?: 'PUBLIC' | 'GM' | 'PRIVATE'; advantage?: boolean; disadvantage?: boolean },
  ) {
    const data = client.data as SocketData;
    const role = await this.roleFor(client, body.campaignId);
    if (!role) return this.deny(client, SOCKET_EVENTS.DICE_ROLL);

    let breakdown;
    try {
      // AUTORIDADE: o resultado é calculado no servidor, nunca enviado pelo cliente
      breakdown = roll(body.formula, { advantage: body.advantage, disadvantage: body.disadvantage });
    } catch (e: any) {
      return client.emit(SOCKET_EVENTS.ERROR, { event: SOCKET_EVENTS.DICE_ROLL, code: 'invalid', message: e?.message ?? 'Fórmula inválida.' });
    }

    const visibility = body.visibility ?? 'PUBLIC';
    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, select: { displayName: true } });
    const saved = await this.prisma.diceRoll.create({
      data: {
        campaignId: body.campaignId,
        userId: data.userId,
        formula: body.formula,
        result: breakdown.total,
        breakdown: breakdown as object,
        visibility,
      },
    });

    const dto = {
      id: saved.id,
      campaignId: body.campaignId,
      userId: data.userId,
      userDisplayName: user?.displayName,
      formula: body.formula,
      result: breakdown.total,
      breakdown,
      visibility,
      createdAt: saved.createdAt.toISOString(),
    };

    // visibilidade decidida no SERVIDOR
    if (visibility === 'PUBLIC') {
      this.server.to(room(body.campaignId)).emit(SOCKET_EVENTS.DICE_ROLL, { roll: dto });
    } else if (visibility === 'PRIVATE') {
      client.emit(SOCKET_EVENTS.DICE_ROLL, { roll: dto });
    } else {
      // GM: envia a quem rolou e a todos os GMs online
      client.emit(SOCKET_EVENTS.DICE_ROLL, { roll: dto });
      const sockets = await this.server.in(room(body.campaignId)).fetchSockets();
      for (const s of sockets) {
        const sd = s.data as SocketData;
        if (sd?.roles.get(body.campaignId) === 'GM' && sd.userId !== data.userId) {
          s.emit(SOCKET_EVENTS.DICE_ROLL, { roll: dto });
        }
      }
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CHAT_MESSAGE)
  async onChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { campaignId: string; body: string; toUserId?: string | null },
  ) {
    const data = client.data as SocketData;
    const role = await this.roleFor(client, body.campaignId);
    if (!role) return this.deny(client, SOCKET_EVENTS.CHAT_MESSAGE);
    const text = (body.body ?? '').trim().slice(0, 4000);
    if (!text) return;

    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, select: { displayName: true } });
    const saved = await this.prisma.chatMessage.create({
      data: { campaignId: body.campaignId, userId: data.userId, body: text, toUserId: body.toUserId ?? null },
    });
    const dto = {
      id: saved.id,
      campaignId: body.campaignId,
      userId: data.userId,
      userDisplayName: user?.displayName,
      body: text,
      toUserId: body.toUserId ?? null,
      createdAt: saved.createdAt.toISOString(),
    };
    this.server.to(room(body.campaignId)).emit(SOCKET_EVENTS.CHAT_MESSAGE, { message: dto });
  }

  private deny(client: Socket, event: string) {
    client.emit(SOCKET_EVENTS.ERROR, { event, code: 'forbidden', message: 'Acesso negado.' });
  }

  /** Emite o estado de combate para a sala da campanha (chamado pelo CombatController). */
  broadcastCombat(campaignId: string, encounter: unknown) {
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.COMBAT_UPDATE, { encounter });
  }

  /** O GM ativou uma cena: todos os jogadores da sala devem segui-la. */
  broadcastSceneActivate(campaignId: string, sceneId: string) {
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.SCENE_ACTIVATE, { campaignId, sceneId });
  }

  /** Token criado/excluído na cena ativa. */
  broadcastTokenCreate(campaignId: string, token: unknown) {
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.TOKEN_CREATE, { token });
  }
  broadcastTokenDelete(campaignId: string, tokenId: string, sceneId: string) {
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.TOKEN_DELETE, { tokenId, sceneId });
  }

  /** Mapa-overlay criado/alterado/removido. */
  broadcastOverlay(campaignId: string, action: 'create' | 'update' | 'delete', overlay: unknown) {
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.SCENE_UPDATE, { kind: 'overlay', action, overlay });
  }

  private async broadcastPresence(campaignId: string) {
    const sockets = await this.server.in(room(campaignId)).fetchSockets();
    const seen = new Map<string, { userId: string }>();
    for (const s of sockets) {
      const d = s.data as SocketData;
      if (d?.userId) seen.set(d.userId, { userId: d.userId });
    }
    // enriquece com nome/role resolvidos do banco
    const userIds = [...seen.keys()];
    const members = await this.prisma.campaignMember.findMany({
      where: { campaignId, userId: { in: userIds } },
      include: { user: { select: { displayName: true } } },
    });
    const online = members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
    }));
    this.server.to(room(campaignId)).emit(SOCKET_EVENTS.PRESENCE, { campaignId, online });
  }
}
