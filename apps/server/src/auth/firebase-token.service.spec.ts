import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { FirebaseTokenService, type GoogleCerts } from './firebase-token.service.js';

const PROJECT = 'ficha-ordem-c31d7';
const NOW_S = 1_800_000_000;

function keyPair() {
  return generateKeyPairSync('rsa', { modulusLength: 2048 });
}
const google = keyPair();
const attacker = keyPair();

// Serviço com as chaves "do Google" e relógio controlados pelo teste
class TestFirebaseTokenService extends FirebaseTokenService {
  fetches = 0;
  nowMs = NOW_S * 1000;
  certs: Record<string, string> = {
    kid1: google.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
  protected override async fetchCerts(): Promise<GoogleCerts> {
    this.fetches++;
    return { certs: this.certs, maxAgeMs: 3_600_000 };
  }
  protected override now() {
    return this.nowMs;
  }
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function token(
  claims: Record<string, unknown> = {},
  { key = google.privateKey, kid = 'kid1', alg = 'RS256' }: { key?: KeyObject; kid?: string; alg?: string } = {},
) {
  const header = b64({ alg, kid, typ: 'JWT' });
  const payload = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'uid-123',
    email: 'jogador@exemplo.com',
    iat: NOW_S - 10,
    exp: NOW_S + 3600,
    auth_time: NOW_S - 10,
    ...claims,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('FirebaseTokenService', () => {
  let svc: TestFirebaseTokenService;
  beforeEach(() => {
    svc = new TestFirebaseTokenService();
  });

  it('aceita um token válido e devolve uid e e-mail', async () => {
    await expect(svc.verify(token(), PROJECT)).resolves.toEqual({
      uid: 'uid-123',
      email: 'jogador@exemplo.com',
    });
  });

  it('recusa assinatura de outra chave', async () => {
    await expect(svc.verify(token({}, { key: attacker.privateKey }), PROJECT)).rejects.toThrow();
  });

  it('recusa conteúdo alterado depois de assinado', async () => {
    const [h, , s] = token().split('.');
    const forged = `${h}.${b64({ ...JSON.parse(Buffer.from(token().split('.')[1], 'base64url').toString()), sub: 'outro' })}.${s}`;
    await expect(svc.verify(forged, PROJECT)).rejects.toThrow();
  });

  it('recusa token expirado', async () => {
    await expect(svc.verify(token({ exp: NOW_S - 120 }), PROJECT)).rejects.toThrow();
  });

  it('recusa token de outro projeto do Firebase', async () => {
    await expect(svc.verify(token({ aud: 'outro-projeto' }), PROJECT)).rejects.toThrow();
    await expect(
      svc.verify(token({ iss: 'https://securetoken.google.com/outro-projeto' }), PROJECT),
    ).rejects.toThrow();
  });

  it('recusa algoritmo diferente de RS256 e kid desconhecido', async () => {
    await expect(svc.verify(token({}, { alg: 'none' }), PROJECT)).rejects.toThrow();
    await expect(svc.verify(token({}, { kid: 'nao-existe' }), PROJECT)).rejects.toThrow();
  });

  it('recusa texto que não é token', async () => {
    await expect(svc.verify('lixo', PROJECT)).rejects.toThrow();
    await expect(svc.verify('a.b.c', PROJECT)).rejects.toThrow();
  });

  it('guarda as chaves em cache e recarrega quando o Google troca a chave', async () => {
    await svc.verify(token(), PROJECT);
    await svc.verify(token(), PROJECT);
    expect(svc.fetches).toBe(1);

    const rotated = keyPair();
    svc.certs = { kid2: rotated.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
    await expect(svc.verify(token({}, { key: rotated.privateKey, kid: 'kid2' }), PROJECT)).resolves.toBeTruthy();
    expect(svc.fetches).toBe(2);
  });
});
