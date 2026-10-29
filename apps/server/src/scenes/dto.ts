import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  IsNumber,
  IsIn,
  IsBoolean,
  Min,
} from 'class-validator';

const GRID = ['SQUARE', 'HEX', 'NONE'] as const;

export class CreateSceneDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() folderId?: string | null;
  @IsOptional() @IsInt() @Min(100) width?: number;
  @IsOptional() @IsInt() @Min(100) height?: number;
  @IsOptional() @IsIn(GRID) gridType?: (typeof GRID)[number];
  @IsOptional() @IsInt() @Min(10) gridSize?: number;
  @IsOptional() @IsString() gridColor?: string;
  @IsOptional() @IsNumber() scale?: number;
  @IsOptional() @IsString() backgroundAssetId?: string;
}

export class UpdateSceneDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() folderId?: string | null;
  @IsOptional() @IsInt() @Min(100) width?: number;
  @IsOptional() @IsInt() @Min(100) height?: number;
  @IsOptional() @IsIn(GRID) gridType?: (typeof GRID)[number];
  @IsOptional() @IsInt() @Min(10) gridSize?: number;
  @IsOptional() @IsString() gridColor?: string;
  @IsOptional() @IsNumber() scale?: number;
  @IsOptional() @IsString() backgroundAssetId?: string;
}

export class CreateTokenDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() folderId?: string | null;
  @IsOptional() @IsIn(['CHARACTER', 'MONSTER', 'NPC', 'ITEM']) kind?: 'CHARACTER' | 'MONSTER' | 'NPC' | 'ITEM';
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
  @IsOptional() @IsNumber() @Min(1) width?: number;
  @IsOptional() @IsNumber() @Min(1) height?: number;
  @IsOptional() @IsString() imageAssetId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() characterId?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() layer?: string;
}

export class UpdateTokenDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() folderId?: string | null;
  @IsOptional() @IsIn(['CHARACTER', 'MONSTER', 'NPC', 'ITEM']) kind?: 'CHARACTER' | 'MONSTER' | 'NPC' | 'ITEM';
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
  @IsOptional() @IsNumber() @Min(1) width?: number;
  @IsOptional() @IsNumber() @Min(1) height?: number;
  @IsOptional() @IsNumber() rotation?: number;
  @IsOptional() @IsBoolean() isLocked?: boolean;
  @IsOptional() @IsBoolean() isHidden?: boolean;
  @IsOptional() @IsString() layer?: string;
  @IsOptional() @IsString() imageAssetId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() ownerUserId?: string;
}
