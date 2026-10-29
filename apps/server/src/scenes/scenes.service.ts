import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CampaignRole, SceneDTO, TokenDTO } from '@tabletop/shared';

function toSceneDTO(s: any): SceneDTO {
  return {
    id: s.id,
    campaignId: s.campaignId,
    folderId: s.folderId ?? null,
    name: s.name,
    backgroundAssetId: s.backgroundAssetId,
    width: s.width,
    height: s.height,
    gridType: s.gridType,
    gridSize: s.gridSize,
    gridColor: s.gridColor,
    scale: s.scale,
  };
}

function toTokenDTO(t: any): TokenDTO {
  return {
    id: t.id,
    sceneId: t.sceneId,
    folderId: t.folderId ?? null,
    kind: t.kind,
    characterId: t.characterId,
    ownerUserId: t.ownerUserId,
    name: t.name,
    imageAssetId: t.imageAssetId,
    imageUrl: t.imageUrl ?? null,
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
    layer: t.layer,
    isLocked: t.isLocked,
    isHidden: t.isHidden,
    groupId: t.groupId,
    stats: t.stats ?? {},
  };
}

@Injectable()
export class ScenesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(campaignId: string): Promise<SceneDTO[]> {
    const scenes = await this.prisma.scene.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
    return scenes.map(toSceneDTO);
  }

  async create(campaignId: string, data: any): Promise<SceneDTO> {
    const scene = await this.prisma.scene.create({ data: { campaignId, ...data } });
    return toSceneDTO(scene);
  }

  private async assertSceneInCampaign(campaignId: string, sceneId: string) {
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId } });
    if (!scene || scene.campaignId !== campaignId) {
      throw new NotFoundException('Cena não encontrada.');
    }
    return scene;
  }

  /**
   * Carrega a cena com seus tokens. FILTRA segredos no servidor: para quem NÃO
   * é GM, tokens ocultos (isHidden) são removidos — o cliente nunca os recebe.
   */
  async getWithTokens(campaignId: string, sceneId: string, role: CampaignRole) {
    const scene = await this.assertSceneInCampaign(campaignId, sceneId);
    const tokens = await this.prisma.token.findMany({ where: { sceneId } });
    const visible = role === 'GM' ? tokens : tokens.filter((t) => !t.isHidden);
    return { scene: toSceneDTO(scene), tokens: visible.map(toTokenDTO) };
  }

  async update(campaignId: string, sceneId: string, data: any): Promise<SceneDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const scene = await this.prisma.scene.update({ where: { id: sceneId }, data });
    return toSceneDTO(scene);
  }

  async remove(campaignId: string, sceneId: string) {
    await this.assertSceneInCampaign(campaignId, sceneId);
    await this.prisma.scene.delete({ where: { id: sceneId } });
    return { ok: true };
  }

  // -------- tokens --------

  async createToken(campaignId: string, sceneId: string, data: any): Promise<TokenDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const token = await this.prisma.token.create({ data: { sceneId, ...data } });
    return toTokenDTO(token);
  }

  private async loadTokenInCampaign(campaignId: string, tokenId: string) {
    const token = await this.prisma.token.findUnique({
      where: { id: tokenId },
      include: { scene: true },
    });
    if (!token || token.scene.campaignId !== campaignId) {
      throw new NotFoundException('Token não encontrado.');
    }
    return token;
  }

  /**
   * Atualiza um token com controle de propriedade:
   *  - GM pode tudo.
   *  - PLAYER só mexe em token que ele possui (ownerUserId) e que não esteja
   *    bloqueado; e NÃO pode mudar visibilidade/owner/lock (campos de GM).
   */
  async updateToken(
    campaignId: string,
    tokenId: string,
    userId: string,
    role: CampaignRole,
    data: any,
  ): Promise<TokenDTO> {
    const token = await this.loadTokenInCampaign(campaignId, tokenId);

    if (role !== 'GM') {
      const owns = token.ownerUserId === userId;
      if (!owns || token.isLocked) {
        throw new ForbiddenException('Você não pode mover este token.');
      }
      // remove campos reservados ao GM
      delete data.isHidden;
      delete data.isLocked;
      delete data.ownerUserId;
    }

    const updated = await this.prisma.token.update({ where: { id: tokenId }, data });
    return toTokenDTO(updated);
  }

  async removeToken(campaignId: string, tokenId: string, role: CampaignRole) {
    const token = await this.loadTokenInCampaign(campaignId, tokenId);
    if (role !== 'GM') {
      throw new ForbiddenException('Apenas o mestre pode remover tokens.');
    }
    await this.prisma.token.delete({ where: { id: token.id } });
    return { ok: true };
  }
}
