import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CampaignRole, SceneDTO, TokenDTO, MapOverlayDTO, SceneFogDTO } from '@tabletop/shared';

function toFogDTO(f: any): SceneFogDTO {
  return {
    enabled: !!f?.enabled,
    coverAll: !!f?.coverAll,
    revealedCells: Array.isArray(f?.revealedCells) ? f.revealedCells : [],
    brushReveal: Array.isArray(f?.brushReveal) ? f.brushReveal : [],
    brushHide: Array.isArray(f?.brushHide) ? f.brushHide : [],
  };
}

function toOverlayDTO(o: any): MapOverlayDTO {
  return {
    id: o.id,
    sceneId: o.sceneId,
    folderId: o.folderId ?? null,
    assetId: o.assetId ?? null,
    imageUrl: o.imageUrl ?? null,
    name: o.name,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    opacity: o.opacity,
    order: o.order,
    isLocked: o.isLocked,
    isHidden: o.isHidden ?? false,
  };
}

function toSceneDTO(s: any, backgroundUrl?: string | null): SceneDTO {
  return {
    id: s.id,
    campaignId: s.campaignId,
    folderId: s.folderId ?? null,
    name: s.name,
    backgroundAssetId: s.backgroundAssetId,
    backgroundUrl: backgroundUrl ?? null,
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

  // Resolve a URL pública do asset de fundo (cenário) a partir do seu id.
  // Driver local serve via /api/files/<storageKey>.
  private async backgroundUrlFor(backgroundAssetId?: string | null): Promise<string | null> {
    if (!backgroundAssetId) return null;
    const asset = await this.prisma.asset.findUnique({ where: { id: backgroundAssetId } });
    return asset ? `/api/files/${asset.storageKey}` : null;
  }

  async list(campaignId: string): Promise<SceneDTO[]> {
    const scenes = await this.prisma.scene.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(scenes.map(async (s) => toSceneDTO(s, await this.backgroundUrlFor(s.backgroundAssetId))));
  }

  async create(campaignId: string, data: any): Promise<SceneDTO> {
    const scene = await this.prisma.scene.create({ data: { campaignId, ...data } });
    return toSceneDTO(scene, await this.backgroundUrlFor(scene.backgroundAssetId));
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
    const bgUrl = await this.backgroundUrlFor(scene.backgroundAssetId);
    const overlays = await this.prisma.mapOverlay.findMany({
      where: { sceneId },
      orderBy: { order: 'asc' },
    });
    const visibleOverlays = role === 'GM' ? overlays : overlays.filter((o) => !o.isHidden);
    const fogRow = await this.prisma.sceneFog.findUnique({ where: { sceneId } });
    return {
      scene: toSceneDTO(scene, bgUrl),
      tokens: visible.map(toTokenDTO),
      overlays: visibleOverlays.map(toOverlayDTO),
      fog: toFogDTO(fogRow),
    };
  }

  // -------- névoa de guerra (modelo A, por células) — só GM muta --------

  private async upsertFog(
    sceneId: string,
    data: { enabled?: boolean; coverAll?: boolean; revealedCells?: string[]; brushReveal?: any[]; brushHide?: any[] },
  ) {
    const existing = await this.prisma.sceneFog.findUnique({ where: { sceneId } });
    const patch: any = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.coverAll !== undefined) patch.coverAll = data.coverAll;
    if (data.revealedCells !== undefined) patch.revealedCells = data.revealedCells;
    if (data.brushReveal !== undefined) patch.brushReveal = data.brushReveal;
    if (data.brushHide !== undefined) patch.brushHide = data.brushHide;
    const row = existing
      ? await this.prisma.sceneFog.update({ where: { sceneId }, data: patch })
      : await this.prisma.sceneFog.create({
          data: {
            sceneId,
            enabled: data.enabled ?? false,
            coverAll: data.coverAll ?? false,
            revealedCells: data.revealedCells ?? [],
            brushReveal: data.brushReveal ?? [],
            brushHide: data.brushHide ?? [],
          },
        });
    return toFogDTO(row);
  }

  // adiciona traços de pincel à mão livre (círculos). mode decide revelar/ocultar.
  async paintFogBrush(
    campaignId: string,
    sceneId: string,
    dots: { x: number; y: number; r: number }[],
    mode: 'reveal' | 'hide',
  ): Promise<SceneFogDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const row = await this.prisma.sceneFog.findUnique({ where: { sceneId } });
    const reveal = Array.isArray(row?.brushReveal) ? (row!.brushReveal as any[]) : [];
    const hide = Array.isArray(row?.brushHide) ? (row!.brushHide as any[]) : [];
    const clean = dots.filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y) && d.r > 0).slice(0, 2000);
    if (mode === 'reveal') reveal.push(...clean);
    else hide.push(...clean);
    // desenhar/ocultar SEMPRE ativa a névoa (não há mais switch manual)
    return this.upsertFog(sceneId, {
      enabled: true,
      brushReveal: reveal.slice(-5000),
      brushHide: hide.slice(-5000),
    });
  }

  async getFog(campaignId: string, sceneId: string): Promise<SceneFogDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const row = await this.prisma.sceneFog.findUnique({ where: { sceneId } });
    return toFogDTO(row);
  }

  async setFogEnabled(campaignId: string, sceneId: string, enabled: boolean): Promise<SceneFogDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    return this.upsertFog(sceneId, { enabled });
  }

  // revela/oculta um conjunto de células ("col,row"); mode define a operação
  async paintFog(
    campaignId: string,
    sceneId: string,
    cells: string[],
    mode: 'reveal' | 'hide',
  ): Promise<SceneFogDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const row = await this.prisma.sceneFog.findUnique({ where: { sceneId } });
    const current = new Set<string>(Array.isArray(row?.revealedCells) ? (row!.revealedCells as string[]) : []);
    for (const c of cells) {
      if (mode === 'reveal') current.add(c);
      else current.delete(c);
    }
    // "desenhar névoa" (hide) por célula SEMPRE ativa a névoa; revelar mantém o estado
    const enabled = mode === 'hide' ? true : row?.enabled ?? true;
    return this.upsertFog(sceneId, { enabled, revealedCells: [...current] });
  }

  // revela tudo / oculta tudo
  async resetFog(campaignId: string, sceneId: string, revealAll: boolean): Promise<SceneFogDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    // revelar tudo = lista vazia + enabled false (sem névoa); ocultar tudo = enabled true, nada revelado
    return revealAll
      ? this.upsertFog(sceneId, { enabled: false, coverAll: false, revealedCells: [], brushReveal: [], brushHide: [] })
      : this.upsertFog(sceneId, { enabled: true, coverAll: true, revealedCells: [], brushReveal: [], brushHide: [] });
  }

  // -------- mapas-overlay (só GM muta; render entre fundo e tokens) --------

  async listOverlays(campaignId: string, sceneId: string): Promise<MapOverlayDTO[]> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const overlays = await this.prisma.mapOverlay.findMany({ where: { sceneId }, orderBy: { order: 'asc' } });
    return overlays.map(toOverlayDTO);
  }

  async createOverlay(campaignId: string, sceneId: string, data: any): Promise<MapOverlayDTO> {
    const scene = await this.assertSceneInCampaign(campaignId, sceneId);
    // mapa novo cobre a cena por padrão (pode esticar depois)
    const overlay = await this.prisma.mapOverlay.create({
      data: {
        sceneId,
        name: data.name ?? 'Mapa',
        folderId: data.folderId ?? null,
        assetId: data.assetId ?? null,
        imageUrl: data.imageUrl ?? null,
        x: data.x ?? 0,
        y: data.y ?? 0,
        width: data.width ?? scene.width,
        height: data.height ?? scene.height,
        opacity: data.opacity ?? 1,
        order: data.order ?? 0,
      },
    });
    return toOverlayDTO(overlay);
  }

  private async loadOverlayInCampaign(campaignId: string, overlayId: string) {
    const overlay = await this.prisma.mapOverlay.findUnique({
      where: { id: overlayId },
      include: { scene: true },
    });
    if (!overlay || overlay.scene.campaignId !== campaignId) {
      throw new NotFoundException('Mapa não encontrado.');
    }
    return overlay;
  }

  async updateOverlay(campaignId: string, overlayId: string, data: any): Promise<MapOverlayDTO> {
    await this.loadOverlayInCampaign(campaignId, overlayId);
    const overlay = await this.prisma.mapOverlay.update({ where: { id: overlayId }, data });
    return toOverlayDTO(overlay);
  }

  async removeOverlay(campaignId: string, overlayId: string) {
    const overlay = await this.loadOverlayInCampaign(campaignId, overlayId);
    await this.prisma.mapOverlay.delete({ where: { id: overlay.id } });
    return { ok: true };
  }

  async update(campaignId: string, sceneId: string, data: any): Promise<SceneDTO> {
    await this.assertSceneInCampaign(campaignId, sceneId);
    const scene = await this.prisma.scene.update({ where: { id: sceneId }, data });
    return toSceneDTO(scene, await this.backgroundUrlFor(scene.backgroundAssetId));
  }

  async remove(campaignId: string, sceneId: string) {
    await this.assertSceneInCampaign(campaignId, sceneId);
    await this.prisma.scene.delete({ where: { id: sceneId } });
    return { ok: true };
  }

  // marca a cena ativa da campanha (a que os jogadores acompanham)
  async activateScene(campaignId: string, sceneId: string) {
    await this.assertSceneInCampaign(campaignId, sceneId);
    await this.prisma.campaign.update({ where: { id: campaignId }, data: { activeSceneId: sceneId } });
    return { ok: true, activeSceneId: sceneId };
  }

  async getActiveSceneId(campaignId: string): Promise<string | null> {
    const c = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { activeSceneId: true } });
    return c?.activeSceneId ?? null;
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
   * Atualiza um token com controle de papel:
   *  - GM pode tudo.
   *  - PLAYER pode MOVER qualquer token não bloqueado (posição/rotação/tamanho),
   *    mas NÃO pode mudar visibilidade/owner/lock (campos de GM). Excluir é só GM.
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
      // jogador só é barrado se o token estiver BLOQUEADO pelo mestre
      if (token.isLocked) {
        throw new ForbiddenException('Este token está bloqueado pelo mestre.');
      }
      // campos reservados ao GM nunca são aplicados por um jogador
      delete data.isHidden;
      delete data.isLocked;
      delete data.ownerUserId;
      delete data.folderId;
      delete data.kind;
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
