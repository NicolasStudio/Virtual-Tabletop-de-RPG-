import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AccessPayload {
  sub: string; // userId
  email: string;
  isAdmin: boolean;
}

/**
 * Gerencia tokens:
 *  - ACCESS: JWT curto, assinado, enviado no header Authorization.
 *  - REFRESH: valor OPACO aleatório. Guardamos apenas o hash SHA-256 no banco;
 *    o valor em claro vai só para o cookie httpOnly. Rotaciona a cada refresh.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  signAccess(payload: AccessPayload): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
  }

  verifyAccess(token: string): AccessPayload {
    try {
      return this.jwt.verify<AccessPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  /** Cria e persiste um refresh token; devolve o valor em claro (só aqui). */
  async issueRefresh(userId: string): Promise<{ raw: string; expiresAt: Date }> {
    const raw = randomBytes(48).toString('hex');
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(raw), expiresAt },
    });
    return { raw, expiresAt };
  }

  /**
   * Valida um refresh em claro e o ROTACIONA: revoga o antigo e emite um novo.
   * Reuso de token revogado/expirado => 401 (e, por segurança, revoga todos
   * os refresh do usuário — possível vazamento).
   */
  async rotateRefresh(raw: string): Promise<{ userId: string; raw: string; expiresAt: Date }> {
    const tokenHash = this.hash(raw);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      if (existing) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: existing.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    const next = await this.issueRefresh(existing.userId);
    return { userId: existing.userId, ...next };
  }

  async revokeRefresh(raw: string): Promise<void> {
    const tokenHash = this.hash(raw);
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => void 0); // idempotente: logout de token já inexistente não falha
  }
}
