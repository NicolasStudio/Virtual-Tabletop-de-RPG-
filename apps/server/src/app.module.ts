import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { ScenesModule } from './scenes/scenes.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { CombatModule } from './combat/combat.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // rate limiting global: 100 req / 60s por IP (rotas de auth têm limites menores via @Throttle)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    CampaignsModule,
    ScenesModule,
    RealtimeModule,
    CombatModule,
    // Próximos por fase: CharactersModule (fichas), BestiaryModule, ...
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
