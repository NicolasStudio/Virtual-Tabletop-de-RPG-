import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CampaignRoleGuard } from '../campaigns/campaign-role.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

// Upload escopado por campanha (só membros). O arquivo vira um Asset.
@Controller('campaigns/:campaignId/assets')
@UseGuards(JwtAuthGuard, CampaignRoleGuard)
export class AssetsController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * 1024 * 1024 } }))
  async upload(
    @Param('campaignId') campaignId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    const stored = await this.storage.save(file.buffer, file.mimetype, file.originalname);
    const asset = await this.prisma.asset.create({
      data: {
        campaignId,
        uploaderId: userId,
        kind: file.mimetype.startsWith('image/') ? 'image' : 'file',
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: stored.storageKey,
      },
    });
    return { id: asset.id, url: stored.url, kind: asset.kind, fileName: asset.fileName };
  }
}

// Serve arquivos do driver LOCAL (dev). Em S3 a URL aponta direto ao bucket.
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get(':key')
  async serve(@Param('key') key: string, @Res() res: Response) {
    const buf = await this.storage.readLocal(key);
    res.type(mimeFromKey(key)); // Content-Type correto p/ o navegador renderizar
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  }
}

// infere o mime pela extensão (o nome do arquivo é <uuid>.<ext>)
function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}
