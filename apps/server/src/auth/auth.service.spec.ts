import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service.js';

// Prisma falso em memória para users
function makePrisma() {
  const users: any[] = [];
  const match = (where: any) => (u: any) =>
    Object.entries(where).every(([k, v]) => u[k] === v);
  return {
    _users: users,
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find(match(where)) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `u${users.length + 1}`, avatarUrl: null, isAdmin: false, firebaseUid: null, ...data };
        users.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = users.find(match(where));
        Object.assign(row, data);
        return row;
      }),
    },
  };
}

const tokens = {
  signAccess: vi.fn(() => 'access.jwt'),
  issueRefresh: vi.fn(async () => ({ raw: 'refresh-raw', expiresAt: new Date() })),
} as any;

describe('AuthService.loginWithFirebase', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let firebase: { verify: ReturnType<typeof vi.fn> };
  let svc: AuthService;

  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'ficha-ordem-c31d7';
    prisma = makePrisma();
    firebase = { verify: vi.fn(async () => ({ uid: 'fb1', email: 'ana@exemplo.com' })) };
    svc = new AuthService(prisma as any, tokens, firebase as any);
  });
  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
  });

  it('na primeira vez cria a conta ligada ao uid do Firebase, com o nome da Ficha', async () => {
    const { user, accessToken } = await svc.loginWithFirebase('tok', 'Ana Souza');
    expect(accessToken).toBe('access.jwt');
    expect(user).toMatchObject({ email: 'ana@exemplo.com', displayName: 'Ana Souza' });
    expect(prisma._users[0]).toMatchObject({ firebaseUid: 'fb1' });
    expect(firebase.verify).toHaveBeenCalledWith('tok', 'ficha-ordem-c31d7');
  });

  it('depois reaproveita a mesma conta e acompanha a troca de nome', async () => {
    await svc.loginWithFirebase('tok', 'Ana');
    const { user } = await svc.loginWithFirebase('tok', 'Ana Paula');
    expect(prisma._users).toHaveLength(1);
    expect(user.displayName).toBe('Ana Paula');
  });

  it('sem nome usa o começo do e-mail', async () => {
    const { user } = await svc.loginWithFirebase('tok', '  ');
    expect(user.displayName).toBe('ana');
  });

  it('não entra numa conta antiga do Tabletop só porque o e-mail é igual', async () => {
    prisma._users.push({ id: 'old', email: 'ana@exemplo.com', firebaseUid: null, passwordHash: 'x' });
    await expect(svc.loginWithFirebase('tok', 'Ana')).rejects.toThrow(/Já existe uma conta/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('recusa quando o projeto do Firebase não está configurado', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    await expect(svc.loginWithFirebase('tok', 'Ana')).rejects.toThrow(/não configurado/);
  });

  it('token inválido não cria conta', async () => {
    firebase.verify.mockRejectedValueOnce(new Error('inválido'));
    await expect(svc.loginWithFirebase('tok', 'Ana')).rejects.toThrow();
    expect(prisma._users).toHaveLength(0);
  });

  it('conta criada pela Ficha não entra por senha', async () => {
    await svc.loginWithFirebase('tok', 'Ana');
    await expect(svc.login('ana@exemplo.com', '!firebase')).rejects.toThrow(/Credenciais inválidas/);
  });
});
