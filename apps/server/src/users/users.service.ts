import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PublicUser } from '@tabletop/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<PublicUser & { preferences: unknown }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isAdmin: u.isAdmin,
      preferences: u.preferences,
    };
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
    return { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl };
  }

  async updatePreferences(userId: string, preferences: Record<string, unknown>) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: preferences as object },
    });
    return { preferences: u.preferences };
  }
}
