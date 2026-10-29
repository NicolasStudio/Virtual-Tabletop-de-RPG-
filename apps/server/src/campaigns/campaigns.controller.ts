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
import { CampaignRoleGuard } from './campaign-role.guard.js';
import { RequireRole } from './require-role.decorator.js';
import { CampaignsService } from './campaigns.service.js';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateInviteDto,
  JoinByCodeDto,
  UpdateMemberRoleDto,
} from './dto.js';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.campaigns.listForUser(userId);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(userId, dto);
  }

  // entrar por código: qualquer usuário autenticado
  @Post('join')
  join(@CurrentUser('sub') userId: string, @Body() dto: JoinByCodeDto) {
    return this.campaigns.joinByCode(userId, dto.code);
  }

  // ---- rotas escopadas por campanha (CampaignRoleGuard) ----

  @Get(':campaignId')
  @UseGuards(CampaignRoleGuard) // basta ser membro
  detail(@Param('campaignId') campaignId: string) {
    return this.campaigns.getDetail(campaignId);
  }

  @Patch(':campaignId')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  update(@Param('campaignId') campaignId: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(campaignId, dto);
  }

  @Delete(':campaignId')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  remove(@Param('campaignId') campaignId: string, @CurrentUser('sub') userId: string) {
    return this.campaigns.remove(campaignId, userId);
  }

  @Post(':campaignId/leave')
  @UseGuards(CampaignRoleGuard)
  leave(@Param('campaignId') campaignId: string, @CurrentUser('sub') userId: string) {
    return this.campaigns.leave(campaignId, userId);
  }

  // ---- convites (só GM) ----

  @Post(':campaignId/invites')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  createInvite(@Param('campaignId') campaignId: string, @Body() dto: CreateInviteDto) {
    return this.campaigns.createInvite(campaignId, dto);
  }

  @Get(':campaignId/invites')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  listInvites(@Param('campaignId') campaignId: string) {
    return this.campaigns.listInvites(campaignId);
  }

  @Delete(':campaignId/invites/:inviteId')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  revokeInvite(
    @Param('campaignId') campaignId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.campaigns.revokeInvite(campaignId, inviteId);
  }

  // ---- membros (só GM) ----

  @Patch(':campaignId/members/:userId')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  updateMemberRole(
    @Param('campaignId') campaignId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('sub') actingUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.campaigns.updateMemberRole(campaignId, actingUserId, targetUserId, dto.role);
  }

  @Delete(':campaignId/members/:userId')
  @UseGuards(CampaignRoleGuard)
  @RequireRole('GM')
  removeMember(
    @Param('campaignId') campaignId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('sub') actingUserId: string,
  ) {
    return this.campaigns.removeMember(campaignId, actingUserId, targetUserId);
  }
}
