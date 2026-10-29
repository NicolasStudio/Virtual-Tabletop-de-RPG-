import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFolderDto, UpdateFolderDto, FolderKind } from './dto.js';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista as pastas de um kind (toda a árvore do kind de uma vez; o front monta
  // a hierarquia a partir de parentId). Ordenado por order, depois nome.
  list(campaignId: string, kind?: FolderKind) {
    return this.prisma.assetFolder.findMany({
      where: { campaignId, ...(kind ? { kind: kind as any } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async create(campaignId: string, dto: CreateFolderDto) {
    if (dto.parentId) await this.assertSameCampaign(campaignId, dto.parentId, dto.kind);
    return this.prisma.assetFolder.create({
      data: {
        campaignId,
        kind: dto.kind as any,
        name: dto.name.trim(),
        parentId: dto.parentId ?? null,
        order: dto.order ?? 0,
      },
    });
  }

  async update(campaignId: string, folderId: string, dto: UpdateFolderDto) {
    const folder = await this.getOwned(campaignId, folderId);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === folderId) throw new BadRequestException('Uma pasta não pode ser pai de si mesma.');
      await this.assertSameCampaign(campaignId, dto.parentId, folder.kind as FolderKind);
      await this.assertNotDescendant(folderId, dto.parentId);
    }
    return this.prisma.assetFolder.update({
      where: { id: folderId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
  }

  // Remove a pasta. As subpastas caem em cascata (schema onDelete:Cascade);
  // os objetos (cena/token/asset) ficam com folderId=null (SetNull), não são
  // apagados — mover para a lixeira é responsabilidade do próprio objeto.
  async remove(campaignId: string, folderId: string) {
    await this.getOwned(campaignId, folderId);
    await this.prisma.assetFolder.delete({ where: { id: folderId } });
    return { ok: true };
  }

  private async getOwned(campaignId: string, folderId: string) {
    const folder = await this.prisma.assetFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.campaignId !== campaignId) throw new NotFoundException('Pasta não encontrada.');
    return folder;
  }

  private async assertSameCampaign(campaignId: string, parentId: string, kind: FolderKind) {
    const parent = await this.prisma.assetFolder.findUnique({ where: { id: parentId } });
    if (!parent || parent.campaignId !== campaignId) throw new BadRequestException('Pasta-pai inválida.');
    if (parent.kind !== (kind as any)) throw new BadRequestException('A pasta-pai é de outro tipo.');
  }

  // Evita ciclos: parentId candidato não pode ser descendente da pasta movida.
  private async assertNotDescendant(folderId: string, candidateParentId: string) {
    let cursor: string | null = candidateParentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === folderId) throw new BadRequestException('Não é possível mover uma pasta para dentro dela mesma.');
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const node: { parentId: string | null } | null = await this.prisma.assetFolder.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }
}
