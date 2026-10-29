import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CampaignRole } from '@tabletop/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthedRequest } from '../auth/jwt-auth.guard.js';
import { ROLES_KEY } from './require-role.decorator.js';

/**
 * Autorização por campanha. Roda DEPOIS do JwtAuthGuard.
 * Resolve o campaignId da rota, confirma a membership e injeta o papel em
 * req.membership para os handlers usarem. NUNCA confia no cliente: o papel vem
 * do banco, não do payload.
 */
@Injectable()
export class CampaignRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<CampaignRole[] | undefined>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const req = context.switchToHttp().getRequest<
      AuthedRequest & { membership?: { campaignId: string; role: CampaignRole } }
    >();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Autenticação necessária.');

    const params = (req.params ?? {}) as Record<string, string | undefined>;
    const bodyCampaignId = (req.body as { campaignId?: unknown })?.campaignId;
    const campaignId: string | undefined =
      params.campaignId ??
      params.id ??
      (typeof bodyCampaignId === 'string' ? bodyCampaignId : undefined);
    if (!campaignId) throw new BadRequestException('campaignId ausente na requisição.');

    const membership = await this.prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    });
    if (!membership) {
      // não revela se a campanha existe para quem não é membro
      throw new ForbiddenException('Acesso negado à campanha.');
    }

    req.membership = { campaignId, role: membership.role as CampaignRole };

    // sem papéis exigidos = basta ser membro
    if (required.length === 0) return true;
    if (!required.includes(membership.role as CampaignRole)) {
      throw new ForbiddenException('Seu papel não permite esta ação.');
    }
    return true;
  }
}
