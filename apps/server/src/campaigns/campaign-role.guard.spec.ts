import { describe, it, expect, vi } from 'vitest';
import { CampaignRoleGuard } from './campaign-role.guard.js';
import { ROLES_KEY } from './require-role.decorator.js';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

function ctx(req: any) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => 'h',
    getClass: () => 'c',
  } as any;
}

function makeReflector(required: string[]) {
  return { getAllAndOverride: vi.fn(() => required) } as any;
}

function makePrisma(membership: { role: string } | null) {
  return {
    campaignMember: { findUnique: vi.fn(async () => membership) },
  } as any;
}

describe('CampaignRoleGuard', () => {
  it('nega quem não é membro', async () => {
    const guard = new CampaignRoleGuard(makeReflector([]), makePrisma(null));
    const req = { user: { sub: 'u1' }, params: { campaignId: 'c1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(ForbiddenException);
  });

  it('membro sem papel exigido passa (apenas membership)', async () => {
    const guard = new CampaignRoleGuard(makeReflector([]), makePrisma({ role: 'SPECTATOR' }));
    const req: any = { user: { sub: 'u1' }, params: { campaignId: 'c1' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.membership).toEqual({ campaignId: 'c1', role: 'SPECTATOR' });
  });

  it('nega papel insuficiente (PLAYER onde exige GM)', async () => {
    const guard = new CampaignRoleGuard(makeReflector(['GM']), makePrisma({ role: 'PLAYER' }));
    const req = { user: { sub: 'u1' }, params: { campaignId: 'c1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(/papel não permite/);
  });

  it('permite papel correto (GM onde exige GM)', async () => {
    const guard = new CampaignRoleGuard(makeReflector(['GM']), makePrisma({ role: 'GM' }));
    const req = { user: { sub: 'u1' }, params: { campaignId: 'c1' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
  });

  it('exige campaignId', async () => {
    const guard = new CampaignRoleGuard(makeReflector([]), makePrisma({ role: 'GM' }));
    const req = { user: { sub: 'u1' }, params: {} };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(BadRequestException);
  });

  it('usa o param :id quando não há :campaignId', async () => {
    const prisma = makePrisma({ role: 'GM' });
    const guard = new CampaignRoleGuard(makeReflector([]), prisma);
    const req: any = { user: { sub: 'u1' }, params: { id: 'c9' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(prisma.campaignMember.findUnique).toHaveBeenCalledWith({
      where: { campaignId_userId: { campaignId: 'c9', userId: 'u1' } },
    });
  });

  it('ROLES_KEY é a chave de metadata esperada', () => {
    expect(ROLES_KEY).toBe('campaign_roles');
  });
});
