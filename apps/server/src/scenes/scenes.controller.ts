import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  forwardRef,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CampaignRoleGuard } from '../campaigns/campaign-role.guard.js';
import { RequireRole } from '../campaigns/require-role.decorator.js';
import { CampaignMembership } from '../campaigns/membership.decorator.js';
import type { CampaignRole } from '@tabletop/shared';
import { ScenesService } from './scenes.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  CreateSceneDto,
  UpdateSceneDto,
  CreateTokenDto,
  UpdateTokenDto,
  CreateMapOverlayDto,
  UpdateMapOverlayDto,
} from './dto.js';

// Todas as rotas são escopadas por :campaignId → CampaignRoleGuard garante
// membership; @RequireRole('GM') restringe mudanças estruturais ao mestre.
@Controller('campaigns/:campaignId/scenes')
@UseGuards(JwtAuthGuard, CampaignRoleGuard)
export class ScenesController {
  constructor(
    private readonly scenes: ScenesService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  list(@Param('campaignId') campaignId: string) {
    return this.scenes.list(campaignId);
  }

  @Post()
  @RequireRole('GM')
  create(@Param('campaignId') campaignId: string, @Body() dto: CreateSceneDto) {
    return this.scenes.create(campaignId, dto);
  }

  @Get(':sceneId')
  get(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @CampaignMembership('role') role: CampaignRole,
  ) {
    // o service filtra tokens ocultos conforme o papel
    return this.scenes.getWithTokens(campaignId, sceneId, role);
  }

  @Patch(':sceneId')
  @RequireRole('GM')
  update(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: UpdateSceneDto,
  ) {
    return this.scenes.update(campaignId, sceneId, dto);
  }

  @Delete(':sceneId')
  @RequireRole('GM')
  remove(@Param('campaignId') campaignId: string, @Param('sceneId') sceneId: string) {
    return this.scenes.remove(campaignId, sceneId);
  }

  // GM ativa uma cena -> os jogadores da sala passam a acompanhá-la ao vivo
  @Post(':sceneId/activate')
  @RequireRole('GM')
  async activate(@Param('campaignId') campaignId: string, @Param('sceneId') sceneId: string) {
    const r = await this.scenes.activateScene(campaignId, sceneId);
    this.realtime.broadcastSceneActivate(campaignId, sceneId);
    return r;
  }

  // -------- tokens --------

  @Post(':sceneId/tokens')
  @RequireRole('GM')
  async createToken(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: CreateTokenDto,
  ) {
    const token = await this.scenes.createToken(campaignId, sceneId, dto);
    this.realtime.broadcastTokenCreate(campaignId, token);
    return token;
  }

  // mover/atualizar token: membership basta; propriedade é checada no service
  @Patch(':sceneId/tokens/:tokenId')
  updateToken(
    @Param('campaignId') campaignId: string,
    @Param('tokenId') tokenId: string,
    @CurrentUser('sub') userId: string,
    @CampaignMembership('role') role: CampaignRole,
    @Body() dto: UpdateTokenDto,
  ) {
    return this.scenes.updateToken(campaignId, tokenId, userId, role, dto);
  }

  @Delete(':sceneId/tokens/:tokenId')
  async removeToken(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Param('tokenId') tokenId: string,
    @CampaignMembership('role') role: CampaignRole,
  ) {
    const r = await this.scenes.removeToken(campaignId, tokenId, role);
    this.realtime.broadcastTokenDelete(campaignId, tokenId, sceneId);
    return r;
  }

  // -------- mapas-overlay --------

  @Get(':sceneId/overlays')
  listOverlays(@Param('campaignId') campaignId: string, @Param('sceneId') sceneId: string) {
    return this.scenes.listOverlays(campaignId, sceneId);
  }

  @Post(':sceneId/overlays')
  @RequireRole('GM')
  async createOverlay(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: CreateMapOverlayDto,
  ) {
    const overlay = await this.scenes.createOverlay(campaignId, sceneId, dto);
    this.realtime.broadcastOverlay(campaignId, 'create', overlay);
    return overlay;
  }

  @Patch(':sceneId/overlays/:overlayId')
  @RequireRole('GM')
  async updateOverlay(
    @Param('campaignId') campaignId: string,
    @Param('overlayId') overlayId: string,
    @Body() dto: UpdateMapOverlayDto,
  ) {
    const overlay = await this.scenes.updateOverlay(campaignId, overlayId, dto);
    this.realtime.broadcastOverlay(campaignId, 'update', overlay);
    return overlay;
  }

  @Delete(':sceneId/overlays/:overlayId')
  @RequireRole('GM')
  async removeOverlay(@Param('campaignId') campaignId: string, @Param('overlayId') overlayId: string) {
    const r = await this.scenes.removeOverlay(campaignId, overlayId);
    this.realtime.broadcastOverlay(campaignId, 'delete', { id: overlayId });
    return r;
  }

  // -------- névoa de guerra (modelo A, por células) --------

  @Get(':sceneId/fog')
  getFog(@Param('campaignId') campaignId: string, @Param('sceneId') sceneId: string) {
    return this.scenes.getFog(campaignId, sceneId);
  }

  @Post(':sceneId/fog/enabled')
  @RequireRole('GM')
  async setFogEnabled(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: { enabled: boolean },
  ) {
    const fog = await this.scenes.setFogEnabled(campaignId, sceneId, !!dto.enabled);
    this.realtime.broadcastFog(campaignId, sceneId, fog);
    return fog;
  }

  @Post(':sceneId/fog/paint')
  @RequireRole('GM')
  async paintFog(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: { cells: string[]; mode: 'reveal' | 'hide' },
  ) {
    const fog = await this.scenes.paintFog(campaignId, sceneId, dto.cells ?? [], dto.mode === 'hide' ? 'hide' : 'reveal');
    this.realtime.broadcastFog(campaignId, sceneId, fog);
    return fog;
  }

  @Post(':sceneId/fog/reset')
  @RequireRole('GM')
  async resetFog(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: { revealAll: boolean },
  ) {
    const fog = await this.scenes.resetFog(campaignId, sceneId, !!dto.revealAll);
    this.realtime.broadcastFog(campaignId, sceneId, fog);
    return fog;
  }
}
