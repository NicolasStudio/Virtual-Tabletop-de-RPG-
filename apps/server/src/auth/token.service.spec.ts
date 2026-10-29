import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from './token.service.js';
import { createHash } from 'node:crypto';

function sha(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

// JwtService falso
const jwt = {
  sign: vi.fn(() => 'signed.jwt.token'),
  verify: vi.fn(() => ({ sub: 'u1', email: 'a@b.c', isAdmin: false })),
} as any;

// Prisma falso em memória para refreshToken
function makePrisma() {
  const store: any[] = [];
  return {
    _store: store,
    refreshToken: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `rt${store.length + 1}`, revokedAt: null, ...data };
        store.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        store.find((r) => r.tokenHash === where.tokenHash) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.find((r) => r.id === where.id || r.tokenHash === where.tokenHash);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const r of store) {
          if (r.userId === where.userId && (where.revokedAt === null ? r.revokedAt === null : true)) {
            Object.assign(r, data);
            n++;
          }
        }
        return { count: n };
      }),
    },
  } as any;
}

describe('TokenService', () => {
  let prisma: any;
  let svc: TokenService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new TokenService(jwt, prisma);
    process.env.JWT_REFRESH_TTL_DAYS = '7';
  });

  it('emite refresh guardando apenas o hash', async () => {
    const { raw } = await svc.issueRefresh('u1');
    expect(prisma._store).toHaveLength(1);
    expect(prisma._store[0].tokenHash).toBe(sha(raw));
    expect(prisma._store[0].tokenHash).not.toBe(raw); // nunca guarda em claro
  });

  it('rotaciona: revoga o antigo e emite um novo', async () => {
    const { raw } = await svc.issueRefresh('u1');
    const rotated = await svc.rotateRefresh(raw);
    const old = prisma._store.find((r: any) => r.tokenHash === sha(raw));
    expect(old.revokedAt).not.toBeNull();            // antigo revogado
    expect(rotated.raw).not.toBe(raw);               // novo valor
    expect(sha(rotated.raw)).toBe(prisma._store[1].tokenHash);
  });

  it('reuso de token revogado é rejeitado e revoga todos do usuário', async () => {
    const { raw } = await svc.issueRefresh('u1');
    await svc.rotateRefresh(raw);                    // revoga o original
    await expect(svc.rotateRefresh(raw)).rejects.toThrow();
    // todos os refresh do usuário ficam revogados após detecção de reuso
    expect(prisma._store.every((r: any) => r.revokedAt !== null)).toBe(true);
  });

  it('token expirado é rejeitado', async () => {
    const { raw } = await svc.issueRefresh('u1');
    prisma._store[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.rotateRefresh(raw)).rejects.toThrow();
  });

  it('revoke é idempotente', async () => {
    await expect(svc.revokeRefresh('inexistente')).resolves.toBeUndefined();
  });
});
