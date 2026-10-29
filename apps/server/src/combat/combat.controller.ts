import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CampaignRoleGuard } from '../campaigns/campaign-role.guard.js';
import { RequireRole } from '../campaigns/require-role.decorator.js';
import { CombatService } from './combat.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  CreateEncounterDto,
  AddCombatantDto,
  UpdateCombatantDto,
  DamageDto,
} from './dto.js';

// Combate escopado por campanha. Leitura = qualquer membro. Mutações = só GM.
@Controller('campaigns/:campaignId/combat')
@UseGuards(JwtAuthGuard, CampaignRoleGuard)
export class CombatController {
  constructor(
    private readonly combat: CombatService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async broadcast(campaignId: string) {
    const view = await this.combat.getActive(campaignId);
    this.realtime.broadcastCombat(campaignId, view);
    return view;
  }

  @Get()
  get(@Param('campaignId') campaignId: string) {
    return this.combat.getActive(campaignId);
  }

  @Post()
  @RequireRole('GM')
  async create(@Param('campaignId') campaignId: string, @Body() dto: CreateEncounterDto) {
    await this.combat.create(campaignId, dto);
    return this.broadcast(campaignId);
  }

  @Post('combatants')
  @RequireRole('GM')
  async add(@Param('campaignId') campaignId: string, @Body() dto: AddCombatantDto) {
    await this.combat.addCombatant(campaignId, dto);
    return this.broadcast(campaignId);
  }

  @Post('next-turn')
  @RequireRole('GM')
  async next(@Param('campaignId') campaignId: string) {
    await this.combat.nextTurn(campaignId);
    return this.broadcast(campaignId);
  }

  @Post('combatants/:combatantId/damage')
  @RequireRole('GM')
  async damage(
    @Param('campaignId') campaignId: string,
    @Param('combatantId') combatantId: string,
    @Body() dto: DamageDto,
  ) {
    await this.combat.applyDamage(campaignId, combatantId, dto.amount);
    return this.broadcast(campaignId);
  }

  @Post('combatants/:combatantId')
  @RequireRole('GM')
  async update(
    @Param('campaignId') campaignId: string,
    @Param('combatantId') combatantId: string,
    @Body() dto: UpdateCombatantDto,
  ) {
    await this.combat.updateCombatant(campaignId, combatantId, dto);
    return this.broadcast(campaignId);
  }

  @Delete('combatants/:combatantId')
  @RequireRole('GM')
  async remove(
    @Param('campaignId') campaignId: string,
    @Param('combatantId') combatantId: string,
  ) {
    await this.combat.removeCombatant(campaignId, combatantId);
    return this.broadcast(campaignId);
  }

  @Delete()
  @RequireRole('GM')
  async end(@Param('campaignId') campaignId: string) {
    const r = await this.combat.end(campaignId);
    await this.broadcast(campaignId);
    return r;
  }
}
