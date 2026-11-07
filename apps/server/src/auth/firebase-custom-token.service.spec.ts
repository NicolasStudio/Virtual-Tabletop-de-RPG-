import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FirebaseCustomTokenService } from './firebase-custom-token.service.js';

const EMAIL = 'tabletop@ficha-ordem-c31d7.iam.gserviceaccount.com';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
let dir: string;

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('FirebaseCustomTokenService', () => {
  beforeAll(() => {
    // arquivo no formato do JSON baixado do Firebase (só os campos usados)
    dir = mkdtempSync(join(tmpdir(), 'tabletop-sa-'));
    const file = join(dir, 'conta-de-servico.json');
    writeFileSync(
      file,
      JSON.stringify({
        client_email: EMAIL,
        private_key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      }),
    );
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE = file;
  });
  afterAll(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    rmSync(dir, { recursive: true, force: true });
  });

  it('gera um JWT RS256 no formato do Firebase, assinado pela conta de serviço', () => {
    const token = new FirebaseCustomTokenService().create('fb1');
    const [header, payload, signature] = token.split('.');

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = decode(payload);
    expect(claims).toMatchObject({
      iss: EMAIL,
      sub: EMAIL,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      uid: 'fb1',
    });
    expect(claims.exp - claims.iat).toBe(3600);
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      keys.publicKey,
      Buffer.from(signature, 'base64url'),
    );
    expect(valid).toBe(true);
  });

  it('sem a chave configurada, avisa em vez de gerar', () => {
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    try {
      expect(() => new FirebaseCustomTokenService().create('fb1')).toThrow(/FIREBASE_SERVICE_ACCOUNT_FILE/);
    } finally {
      process.env.FIREBASE_SERVICE_ACCOUNT_FILE = file;
    }
  });
});
