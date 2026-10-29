import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';
import type { PublicUser } from '@tabletop/shared';

function toPublic(u: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isAdmin: u.isAdmin,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(email: string, displayName: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { email, displayName, passwordHash },
    });
    return this.issueSession(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Mesmo erro para e-mail inexistente e senha errada (não revela se o e-mail existe).
    if (!user) {
      // custo de verificação constante aproximado
      await argon2.hash(password).catch(() => void 0);
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas.');
    return this.issueSession(user);
  }

  async refresh(rawRefresh: string) {
    const rotated = await this.tokens.rotateRefresh(rawRefresh);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new UnauthorizedException('Sessão inválida.');
    const accessToken = this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    return {
      accessToken,
      refresh: { raw: rotated.raw, expiresAt: rotated.expiresAt },
      user: toPublic(user),
    };
  }

  async logout(rawRefresh: string | undefined) {
    if (rawRefresh) await this.tokens.revokeRefresh(rawRefresh);
  }

  /**
   * Recuperação de senha. SEMPRE responde "ok" para não revelar se o e-mail
   * existe. Em produção o token vai por e-mail; em dev devolvemos devToken.
   */
  async forgotPassword(email: string): Promise<{ devToken?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return {};
    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    // TODO(fase externa): enviar e-mail real via provedor configurável.
    return process.env.NODE_ENV === 'production' ? {} : { devToken: raw };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new NotFoundException('Token de recuperação inválido ou expirado.');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // revoga todas as sessões ativas após troca de senha
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return toPublic(user);
  }

  private async issueSession(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  }) {
    const accessToken = this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    const refresh = await this.tokens.issueRefresh(user.id);
    return { accessToken, refresh, user: toPublic(user) };
  }
}
