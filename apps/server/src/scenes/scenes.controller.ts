import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CampaignRoleGuard } from '../campaigns/campaign-role.guard.js';
import { RequireRole } from '../campaigns/require-role.decorator.js';
import { CampaignMembership } from '../campaigns/membership.decorator.js';
import type { CampaignRole } from '@tabletop/shared';
import { ScenesService } from './scenes.service.js';
import {
  CreateSceneDto,
  UpdateSceneDto,
  CreateTokenDto,
  UpdateTokenDto,
} from './dto.js';

// Todas as rotas são escopadas por :campaignId → CampaignRoleGuard garante
// membership; @RequireRole('GM') restringe mudanças estruturais ao mestre.
@Controller('campaigns/:campaignId/scenes')
@UseGuards(JwtAuthGuard, CampaignRoleGuard)
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

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

  // -------- tokens --------

  @Post(':sceneId/tokens')
  @RequireRole('GM')
  createToken(
    @Param('campaignId') campaignId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: CreateTokenDto,
  ) {
    return this.scenes.createToken(campaignId, sceneId, dto);
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
  removeToken(
    @Param('campaignId') campaignId: string,
    @Param('tokenId') tokenId: string,
    @CampaignMembership('role') role: CampaignRole,
  ) {
    return this.scenes.removeToken(campaignId, tokenId, role);
  }
}
