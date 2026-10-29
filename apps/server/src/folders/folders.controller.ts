import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CampaignRoleGuard } from '../campaigns/campaign-role.guard.js';
import { RequireRole } from '../campaigns/require-role.decorator.js';
import { FoldersService } from './folders.service.js';
import { CreateFolderDto, UpdateFolderDto, type FolderKind } from './dto.js';

// Biblioteca de pastas da campanha. Qualquer membro lê; só GM cria/edita/exclui.
@Controller('campaigns/:campaignId/folders')
@UseGuards(JwtAuthGuard, CampaignRoleGuard)
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  list(@Param('campaignId') campaignId: string, @Query('kind') kind?: FolderKind) {
    return this.folders.list(campaignId, kind);
  }

  @Post()
  @RequireRole('GM')
  create(@Param('campaignId') campaignId: string, @Body() dto: CreateFolderDto) {
    return this.folders.create(campaignId, dto);
  }

  @Patch(':folderId')
  @RequireRole('GM')
  update(
    @Param('campaignId') campaignId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folders.update(campaignId, folderId, dto);
  }

  @Delete(':folderId')
  @RequireRole('GM')
  remove(@Param('campaignId') campaignId: string, @Param('folderId') folderId: string) {
    return this.folders.remove(campaignId, folderId);
  }
}
