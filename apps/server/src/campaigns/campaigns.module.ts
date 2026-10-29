import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';
import { CampaignRoleGuard } from './campaign-role.guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule], // fornece JwtAuthGuard/TokenService
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignRoleGuard],
  exports: [CampaignsService, CampaignRoleGuard],
})
export class CampaignsModule {}
