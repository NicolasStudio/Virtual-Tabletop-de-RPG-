import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScenesService } from './scenes.service.js';
import { ForbiddenException } from '@nestjs/common';

function makePrisma(opts: { scene?: any; tokens?: any[]; token?: any } = {}) {
  const scene = opts.scene ?? { id: 's1', campaignId: 'c1' };
  return {
    _updated: null as any,
    scene: {
      findUnique: vi.fn(async () => scene),
      findMany: vi.fn(async () => []),
    },
    token: {
      findMany: vi.fn(async () => opts.tokens ?? []),
      findUnique: vi.fn(async () => opts.token ?? null),
      update: vi.fn(async function (this: any, { data }: any) {
        return { ...(opts.token ?? {}), ...data };
      }),
      delete: vi.fn(async () => ({})),
    },
    mapOverlay: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    sceneFog: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    asset: {
      findUnique: vi.fn(async () => null),
    },
  } as any;
}

describe('ScenesService.getWithTokens — filtro de fog/ocultos', () => {
  it('GM vê tokens ocultos; PLAYER não', async () => {
    const tokens = [
      { id: 't1', sceneId: 's1', name: 'Herói', isHidden: false, stats: {} },
      { id: 't2', sceneId: 's1', name: 'Armadilha', isHidden: true, stats: {} },
    ];
    const gmPrisma = makePrisma({ tokens });
    const gm = new ScenesService(gmPrisma);
    const asGm = await gm.getWithTokens('c1', 's1', 'GM');
    expect(asGm.tokens.map((t) => t.id)).toEqual(['t1', 't2']);

    const plPrisma = makePrisma({ tokens });
    const pl = new ScenesService(plPrisma);
    const asPlayer = await pl.getWithTokens('c1', 's1', 'PLAYER');
    expect(asPlayer.tokens.map((t) => t.id)).toEqual(['t1']); // oculto removido no servidor
  });
});

describe('ScenesService.updateToken — propriedade', () => {
  let svc: ScenesService;
  const token = {
    id: 't1', name: 'Herói', ownerUserId: 'u1', isLocked: false,
    scene: { campaignId: 'c1' }, stats: {},
  };

  beforeEach(() => {
    svc = new ScenesService(makePrisma({ token }));
  });

  it('GM move qualquer token', async () => {
    const r = await svc.updateToken('c1', 't1', 'gm', 'GM', { x: 99 });
    expect(r.x).toBe(99);
  });

  it('PLAYER dono move o próprio token', async () => {
    const r = await svc.updateToken('c1', 't1', 'u1', 'PLAYER', { x: 10 });
    expect(r.x).toBe(10);
  });

  it('PLAYER não-dono também move token não bloqueado (regra atual)', async () => {
    const r = await svc.updateToken('c1', 't1', 'outro', 'PLAYER', { x: 10 });
    expect(r.x).toBe(10);
  });

  it('PLAYER não altera campos de GM (isHidden/isLocked/owner)', async () => {
    const prisma = makePrisma({ token });
    const s = new ScenesService(prisma);
    await s.updateToken('c1', 't1', 'u1', 'PLAYER', { x: 5, isHidden: true, ownerUserId: 'x' });
    const dataPassed = prisma.token.update.mock.calls[0][0].data;
    expect(dataPassed).not.toHaveProperty('isHidden');
    expect(dataPassed).not.toHaveProperty('ownerUserId');
    expect(dataPassed.x).toBe(5);
  });

  it('token bloqueado não é movido por PLAYER', async () => {
    const locked = { ...token, isLocked: true };
    const s = new ScenesService(makePrisma({ token: locked }));
    await expect(s.updateToken('c1', 't1', 'u1', 'PLAYER', { x: 1 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('só GM remove token', async () => {
    await expect(svc.removeToken('c1', 't1', 'PLAYER')).rejects.toThrow(ForbiddenException);
  });
});
