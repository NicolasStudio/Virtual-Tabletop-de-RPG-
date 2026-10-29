import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type FolderKind = 'SCENE' | 'MAP' | 'TOKEN' | 'ITEM';
const KINDS: FolderKind[] = ['SCENE', 'MAP', 'TOKEN', 'ITEM'];

export class CreateFolderDto {
  @IsEnum(KINDS)
  kind!: FolderKind;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  order?: number;
}
