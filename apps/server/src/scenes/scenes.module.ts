import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller.js';
import { ScenesService } from './scenes.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AssetsController, FilesController } from './files.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';

@Module({
  imports: [AuthModule, CampaignsModule], // JwtAuthGuard + CampaignRoleGuard
  controllers: [ScenesController, AssetsController, FilesController],
  providers: [ScenesService, StorageService],
  exports: [ScenesService],
})
export class ScenesModule {}
