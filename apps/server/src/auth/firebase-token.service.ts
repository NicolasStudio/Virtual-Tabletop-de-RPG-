import { Injectable, UnauthorizedException } from '@nestjs/common';
import { X509Certificate, createPublicKey, verify, type KeyObject } from 'node:crypto';

/**
 * Valida o ID token do Firebase Authentication (login feito na Ficha Ordem
 * Paranormal) sem SDK e sem credenciais: só com as chaves públicas do Google.
 * Regras: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Tolerância para relógios levemente fora de sincronia. */
const CLOCK_SKEW_S = 60;

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
}

export interface GoogleCerts {
  /** kid -> certificado X.509 em PEM (o Google manda assim) ou chave pública em PEM */
  certs: Record<string, string>;
  /** quanto tempo podem ficar em cache (Cache-Control max-age) */
  maxAgeMs: number;
}

function decodePart(part: string): any {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

@Injectable()
export class FirebaseTokenService {
  private keys = new Map<string, KeyObject>();
  private validUntil = 0;

  /** Busca as chaves públicas do Google. Os testes sobrescrevem este método. */
  protected async fetchCerts(): Promise<GoogleCerts> {
    // FIREBASE_CERTS_URL: só para testes de ponta a ponta com chaves próprias
    const res = await fetch(process.env.FIREBASE_CERTS_URL || CERTS_URL);
    if (!res.ok) throw new Error(`Google respondeu ${res.status}`);
    const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
    return { certs: await res.json(), maxAgeMs: Number(maxAge ?? 3600) * 1000 };
  }

  protected now(): number {
    return Date.now();
  }

  private async keyFor(kid: string): Promise<KeyObject | undefined> {
    // As chaves do Google trocam de tempos em tempos: recarrega quando o cache vence
    // ou quando aparece um kid desconhecido.
    if (this.now() >= this.validUntil || !this.keys.has(kid)) {
      const { certs, maxAgeMs } = await this.fetchCerts();
      this.keys = new Map(
        Object.entries(certs).map(([id, pem]) => [
          id,
          pem.includes('CERTIFICATE') ? new X509Certificate(pem).publicKey : createPublicKey(pem),
        ]),
      );
      this.validUntil = this.now() + maxAgeMs;
    }
    return this.keys.get(kid);
  }

  async verify(idToken: string, projectId: string): Promise<FirebaseIdentity> {
    const invalid = () => new UnauthorizedException('Login da Ficha inválido ou expirado.');

    const parts = idToken.split('.');
    if (parts.length !== 3) throw invalid();

    let header: any, payload: any;
    try {
      header = decodePart(parts[0]);
      payload = decodePart(parts[1]);
    } catch {
      throw invalid();
    }

    const nowS = Math.floor(this.now() / 1000);
    if (
      header?.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      payload?.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.sub.length > 128 ||
      typeof payload.exp !== 'number' ||
      payload.exp + CLOCK_SKEW_S < nowS ||
      typeof payload.iat !== 'number' ||
      payload.iat - CLOCK_SKEW_S > nowS ||
      (typeof payload.auth_time === 'number' && payload.auth_time - CLOCK_SKEW_S > nowS)
    ) {
      throw invalid();
    }

    const key = await this.keyFor(header.kid);
    if (!key) throw invalid();

    const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    if (!verify('RSA-SHA256', signed, key, signature)) throw invalid();

    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
  }
}
