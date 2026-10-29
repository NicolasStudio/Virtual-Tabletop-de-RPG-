import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignsService } from './campaigns.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function makePrisma() {
  const invites: any[] = [];
  const members: any[] = [];
  return {
    _invites: invites,
    _members: members,
    inviteCode: {
      findUnique: vi.fn(async ({ where }: any) =>
        invites.find((i) => (where.code ? i.code === where.code : i.id === where.id)) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const i = invites.find((x) => x.id === where.id);
        if (data.uses?.increment) i.uses += data.uses.increment;
        return i;
      }),
    },
    campaignMember: {
      findUnique: vi.fn(async ({ where }: any) =>
        members.find(
          (m) =>
            m.campaignId === where.campaignId_userId.campaignId &&
            m.userId === where.campaignId_userId.userId,
        ) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        members.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
  } as any;
}

describe('CampaignsService.joinByCode', () => {
  let prisma: any;
  let svc: CampaignsService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new CampaignsService(prisma);
  });

  it('código inválido → NotFound', async () => {
    await expect(svc.joinByCode('u1', 'XXXX')).rejects.toThrow(NotFoundException);
  });

  it('convite expirado → BadRequest', async () => {
    prisma._invites.push({
      id: 'i1', code: 'GOOD', campaignId: 'c1', role: 'PLAYER',
      maxUses: null, uses: 0, expiresAt: new Date(Date.now() - 1000),
    });
    await expect(svc.joinByCode('u1', 'GOOD')).rejects.toThrow(BadRequestException);
  });

  it('convite esgotado → BadRequest', async () => {
    prisma._invites.push({
      id: 'i2', code: 'FULL', campaignId: 'c1', role: 'PLAYER',
      maxUses: 1, uses: 1, expiresAt: null,
    });
    await expect(svc.joinByCode('u1', 'FULL')).rejects.toThrow(BadRequestException);
  });

  it('entra com sucesso e incrementa o uso', async () => {
    prisma._invites.push({
      id: 'i3', code: 'JOIN', campaignId: 'c1', role: 'PLAYER',
      maxUses: 5, uses: 0, expiresAt: null,
    });
    const res = await svc.joinByCode('u1', 'JOIN');
    expect(res).toMatchObject({ campaignId: 'c1', role: 'PLAYER', alreadyMember: false });
    expect(prisma._invites[0].uses).toBe(1);
    expect(prisma._members).toHaveLength(1);
  });

  it('já membro → idempotente, não consome uso', async () => {
    prisma._invites.push({
      id: 'i4', code: 'AGAIN', campaignId: 'c1', role: 'PLAYER',
      maxUses: 5, uses: 2, expiresAt: null,
    });
    prisma._members.push({ campaignId: 'c1', userId: 'u1', role: 'GM' });
    const res = await svc.joinByCode('u1', 'AGAIN');
    expect(res).toMatchObject({ alreadyMember: true, role: 'GM' });
    expect(prisma._invites[0].uses).toBe(2); // não incrementa
  });
});
