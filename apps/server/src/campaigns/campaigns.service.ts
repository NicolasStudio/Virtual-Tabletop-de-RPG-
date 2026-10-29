import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CampaignRole, CampaignSummary } from '@tabletop/shared';

// código de convite legível (sem 0/O/1/I para evitar confusão)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Campanhas das quais o usuário participa, com o papel dele em cada uma. */
  async listForUser(userId: string): Promise<CampaignSummary[]> {
    const memberships = await this.prisma.campaignMember.findMany({
      where: { userId },
      include: { campaign: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({
      id: m.campaign.id,
      name: m.campaign.name,
      description: m.campaign.description,
      system: m.campaign.system,
      role: m.role as CampaignRole,
      activeSceneId: m.campaign.activeSceneId,
    }));
  }

  async create(userId: string, data: { name: string; description?: string; system?: string }) {
    const campaign = await this.prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        system: data.system ?? 'generic',
        ownerId: userId,
        members: { create: { userId, role: 'GM' } }, // o criador é GM
      },
    });
    return campaign;
  }

  /** Detalhe + lista de participantes. Exige membership (garantida pelo guard). */
  async getDetail(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      system: campaign.system,
      ownerId: campaign.ownerId,
      activeSceneId: campaign.activeSceneId,
      members: campaign.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async update(
    campaignId: string,
    data: { name?: string; description?: string; system?: string; activeSceneId?: string },
  ) {
    return this.prisma.campaign.update({ where: { id: campaignId }, data });
  }

  async remove(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    // só o DONO exclui a campanha (mais forte que ser GM)
    if (campaign.ownerId !== userId) {
      throw new ForbiddenException('Apenas o dono pode excluir a campanha.');
    }
    await this.prisma.campaign.delete({ where: { id: campaignId } });
    return { ok: true };
  }

  // -------- convites --------

  async createInvite(
    campaignId: string,
    opts: { role?: 'PLAYER' | 'SPECTATOR'; maxUses?: number; expiresInHours?: number },
  ) {
    const expiresAt = opts.expiresInHours
      ? new Date(Date.now() + opts.expiresInHours * 3600_000)
      : null;
    // tenta até achar um código único
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode();
      const existing = await this.prisma.inviteCode.findUnique({ where: { code } });
      if (existing) continue;
      return this.prisma.inviteCode.create({
        data: { campaignId, code, role: opts.role ?? 'PLAYER', maxUses: opts.maxUses, expiresAt },
      });
    }
    throw new ConflictException('Não foi possível gerar um código único. Tente novamente.');
  }

  async listInvites(campaignId: string) {
    return this.prisma.inviteCode.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvite(campaignId: string, inviteId: string) {
    const invite = await this.prisma.inviteCode.findUnique({ where: { id: inviteId } });
    if (!invite || invite.campaignId !== campaignId) {
      throw new NotFoundException('Convite não encontrado.');
    }
    await this.prisma.inviteCode.delete({ where: { id: inviteId } });
    return { ok: true };
  }

  /** Entra numa campanha por código de convite (idempotente para quem já é membro). */
  async joinByCode(userId: string, code: string) {
    const invite = await this.prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) throw new NotFoundException('Código de convite inválido.');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Convite expirado.');
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Convite esgotado.');
    }

    const already = await this.prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: invite.campaignId, userId } },
    });
    if (already) {
      return { campaignId: invite.campaignId, role: already.role, alreadyMember: true };
    }

    const [member] = await this.prisma.$transaction([
      this.prisma.campaignMember.create({
        data: { campaignId: invite.campaignId, userId, role: invite.role },
      }),
      this.prisma.inviteCode.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);
    return { campaignId: invite.campaignId, role: member.role, alreadyMember: false };
  }

  // -------- membros --------

  async updateMemberRole(
    campaignId: string,
    actingUserId: string,
    targetUserId: string,
    role: CampaignRole,
  ) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    // o dono nunca é rebaixado por outrem
    if (targetUserId === campaign.ownerId && actingUserId !== campaign.ownerId) {
      throw new ForbiddenException('Não é possível alterar o papel do dono.');
    }
    return this.prisma.campaignMember.update({
      where: { campaignId_userId: { campaignId, userId: targetUserId } },
      data: { role },
    });
  }

  async removeMember(campaignId: string, actingUserId: string, targetUserId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (targetUserId === campaign.ownerId) {
      throw new ForbiddenException('O dono não pode ser removido.');
    }
    await this.prisma.campaignMember.delete({
      where: { campaignId_userId: { campaignId, userId: targetUserId } },
    });
    return { ok: true };
  }

  /** Sair da campanha por conta própria (o dono precisa excluir, não sair). */
  async leave(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.ownerId === userId) {
      throw new ForbiddenException('O dono não pode sair; exclua a campanha.');
    }
    await this.prisma.campaignMember.delete({
      where: { campaignId_userId: { campaignId, userId } },
    });
    return { ok: true };
  }
}
