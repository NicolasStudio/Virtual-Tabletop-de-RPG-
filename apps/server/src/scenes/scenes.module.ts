import { Module, forwardRef } from '@nestjs/common';
import { ScenesController } from './scenes.controller.js';
import { ScenesService } from './scenes.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AssetsController, FilesController } from './files.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [AuthModule, CampaignsModule, forwardRef(() => RealtimeModule)],
  controllers: [ScenesController, AssetsController, FilesController],
  providers: [ScenesService, StorageService],
  exports: [ScenesService],
})
export class ScenesModule {}
