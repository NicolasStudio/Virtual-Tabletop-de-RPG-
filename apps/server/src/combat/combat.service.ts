import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CombatantView {
  id: string;
  name: string;
  tokenId: string | null;
  characterId: string | null;
  initiative: number;
  order: number;
  hp: number;
  maxHp: number;
  conditions: string[];
  isNpc: boolean;
}

export interface EncounterView {
  id: string;
  campaignId: string;
  sceneId: string | null;
  name: string;
  round: number;
  turnIndex: number;
  isActive: boolean;
  combatants: CombatantView[];
  currentCombatantId: string | null;
}

/**
 * Ordena combatentes por iniciativa (desc) e reatribui `order` 0..n.
 * Desempate estável por nome, para resultado determinístico. LÓGICA PURA.
 */
export function sortByInitiative<T extends { initiative: number; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
}

/** Próximo turno: avança o índice; ao dar a volta, incrementa a rodada. PURA. */
export function advanceTurn(
  turnIndex: number,
  round: number,
  count: number,
): { turnIndex: number; round: number } {
  if (count <= 0) return { turnIndex: 0, round };
  const next = turnIndex + 1;
  if (next >= count) return { turnIndex: 0, round: round + 1 };
  return { turnIndex: next, round };
}

@Injectable()
export class CombatService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadActiveOrThrow(campaignId: string) {
    const enc = await this.prisma.combatEncounter.findFirst({
      where: { campaignId, isActive: true },
      include: { combatants: { orderBy: { order: 'asc' } } },
    });
    if (!enc) throw new NotFoundException('Nenhum combate ativo.');
    return enc;
  }

  private toView(enc: any): EncounterView {
    const combatants: CombatantView[] = enc.combatants.map((c: any) => ({
      id: c.id,
      name: c.name,
      tokenId: c.tokenId,
      characterId: c.characterId,
      initiative: c.initiative,
      order: c.order,
      hp: c.hp,
      maxHp: c.maxHp,
      conditions: Array.isArray(c.conditions) ? c.conditions : [],
      isNpc: c.isNpc,
    }));
    const current = combatants[enc.turnIndex] ?? null;
    return {
      id: enc.id,
      campaignId: enc.campaignId,
      sceneId: enc.sceneId,
      name: enc.name,
      round: enc.round,
      turnIndex: enc.turnIndex,
      isActive: enc.isActive,
      combatants,
      currentCombatantId: current?.id ?? null,
    };
  }

  async getActive(campaignId: string): Promise<EncounterView | null> {
    const enc = await this.prisma.combatEncounter.findFirst({
      where: { campaignId, isActive: true },
      include: { combatants: { orderBy: { order: 'asc' } } },
    });
    return enc ? this.toView(enc) : null;
  }

  async create(campaignId: string, data: { name?: string; sceneId?: string; combatants?: any[] }) {
    // encerra qualquer combate ativo anterior
    await this.prisma.combatEncounter.updateMany({
      where: { campaignId, isActive: true },
      data: { isActive: false },
    });
    const enc = await this.prisma.combatEncounter.create({
      data: {
        campaignId,
        sceneId: data.sceneId ?? null,
        name: data.name ?? 'Combate',
        isActive: true,
        round: 1,
        turnIndex: 0,
      },
    });
    if (data.combatants?.length) {
      for (const c of data.combatants) {
        await this.prisma.combatCombatant.create({
          data: {
            encounterId: enc.id,
            name: c.name,
            tokenId: c.tokenId ?? null,
            characterId: c.characterId ?? null,
            initiative: c.initiative ?? 0,
            hp: c.hp ?? 0,
            maxHp: c.maxHp ?? c.hp ?? 0,
            isNpc: c.isNpc ?? false,
          },
        });
      }
      await this.reorder(enc.id);
    }
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  async addCombatant(campaignId: string, data: any) {
    const enc = await this.loadActiveOrThrow(campaignId);
    await this.prisma.combatCombatant.create({
      data: {
        encounterId: enc.id,
        name: data.name,
        tokenId: data.tokenId ?? null,
        characterId: data.characterId ?? null,
        initiative: data.initiative ?? 0,
        hp: data.hp ?? 0,
        maxHp: data.maxHp ?? data.hp ?? 0,
        isNpc: data.isNpc ?? false,
      },
    });
    await this.reorder(enc.id);
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  /** Recalcula a ordem por iniciativa e persiste o campo `order`. */
  private async reorder(encounterId: string) {
    const list = await this.prisma.combatCombatant.findMany({ where: { encounterId } });
    const sorted = sortByInitiative(list);
    await this.prisma.$transaction(
      sorted.map((c, i) =>
        this.prisma.combatCombatant.update({ where: { id: c.id }, data: { order: i } }),
      ),
    );
  }

  async updateCombatant(campaignId: string, combatantId: string, data: any) {
    const enc = await this.loadActiveOrThrow(campaignId);
    const c = enc.combatants.find((x) => x.id === combatantId);
    if (!c) throw new NotFoundException('Combatente não encontrado.');
    await this.prisma.combatCombatant.update({
      where: { id: combatantId },
      data: {
        ...(data.initiative !== undefined ? { initiative: data.initiative } : {}),
        ...(data.hp !== undefined ? { hp: Math.max(0, data.hp) } : {}),
        ...(data.maxHp !== undefined ? { maxHp: data.maxHp } : {}),
        ...(data.conditions !== undefined ? { conditions: data.conditions } : {}),
      },
    });
    if (data.initiative !== undefined) await this.reorder(enc.id);
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  /** Dano (amount>0) ou cura (amount<0), com clamp 0..maxHp. */
  async applyDamage(campaignId: string, combatantId: string, amount: number) {
    const enc = await this.loadActiveOrThrow(campaignId);
    const c = enc.combatants.find((x) => x.id === combatantId);
    if (!c) throw new NotFoundException('Combatente não encontrado.');
    const next = Math.max(0, Math.min(c.maxHp || Number.MAX_SAFE_INTEGER, c.hp - amount));
    await this.prisma.combatCombatant.update({ where: { id: combatantId }, data: { hp: next } });
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  async removeCombatant(campaignId: string, combatantId: string) {
    const enc = await this.loadActiveOrThrow(campaignId);
    await this.prisma.combatCombatant.delete({ where: { id: combatantId } });
    // mantém o turnIndex em faixa válida
    const remaining = enc.combatants.length - 1;
    if (enc.turnIndex >= remaining && remaining > 0) {
      await this.prisma.combatEncounter.update({ where: { id: enc.id }, data: { turnIndex: 0 } });
    }
    await this.reorder(enc.id);
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  async nextTurn(campaignId: string) {
    const enc = await this.loadActiveOrThrow(campaignId);
    if (enc.combatants.length === 0) throw new BadRequestException('Combate sem combatentes.');
    const { turnIndex, round } = advanceTurn(enc.turnIndex, enc.round, enc.combatants.length);
    await this.prisma.combatEncounter.update({ where: { id: enc.id }, data: { turnIndex, round } });
    return this.toView(await this.loadActiveOrThrow(campaignId));
  }

  async end(campaignId: string) {
    const enc = await this.loadActiveOrThrow(campaignId);
    await this.prisma.combatEncounter.update({ where: { id: enc.id }, data: { isActive: false } });
    return { ok: true };
  }
}
