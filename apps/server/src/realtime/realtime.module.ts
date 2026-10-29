import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { ScenesModule } from '../scenes/scenes.module.js';

@Module({
  imports: [AuthModule, ScenesModule], // TokenService + ScenesService
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
