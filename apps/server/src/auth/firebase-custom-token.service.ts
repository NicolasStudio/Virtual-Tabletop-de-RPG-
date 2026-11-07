import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

/**
 * Gera o "custom token" do Firebase com que a Ficha aberta dentro da mesa entra
 * sozinha na conta do jogador (signInWithCustomToken), sem SDK: é um JWT RS256
 * assinado com a chave da conta de serviço do projeto da Ficha.
 * Regras: https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library
 *
 * A chave fica num arquivo JSON fora do repositório (Firebase → Configurações do
 * projeto → Contas de serviço → Gerar nova chave privada), apontado por
 * FIREBASE_SERVICE_ACCOUNT_FILE no .env.
 */
const AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const LIFETIME_S = 60 * 60; // o máximo que o Firebase aceita

interface ServiceAccount {
  email: string;
  key: KeyObject;
}

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

@Injectable()
export class FirebaseCustomTokenService {
  private account: ServiceAccount | null = null;

  private loadAccount(): ServiceAccount {
    if (this.account) return this.account;
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    if (!file) {
      throw new ServiceUnavailableException(
        'Ficha dentro da mesa não configurada (FIREBASE_SERVICE_ACCOUNT_FILE).',
      );
    }
    const json = JSON.parse(readFileSync(file, 'utf8'));
    this.account = { email: json.client_email, key: createPrivateKey(json.private_key) };
    return this.account;
  }

  create(uid: string): string {
    const { email, key } = this.loadAccount();
    const now = Math.floor(Date.now() / 1000);
    const data = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
      iss: email,
      sub: email,
      aud: AUDIENCE,
      iat: now,
      exp: now + LIFETIME_S,
      uid,
    })}`;
    const signature = sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
    return `${data}.${signature}`;
  }
}
