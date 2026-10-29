import { Module } from '@nestjs/common';
import { CombatController } from './combat.controller.js';
import { CombatService } from './combat.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [AuthModule, CampaignsModule, RealtimeModule],
  controllers: [CombatController],
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}
