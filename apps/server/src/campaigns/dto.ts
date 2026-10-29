import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';

const ROLES = ['GM', 'PLAYER', 'SPECTATOR'] as const;

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  system?: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  system?: string;

  @IsOptional()
  @IsString()
  activeSceneId?: string;
}

export class CreateInviteDto {
  @IsOptional()
  @IsIn(['PLAYER', 'SPECTATOR'])
  role?: 'PLAYER' | 'SPECTATOR'; // não se convida um GM por código

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;
}

export class JoinByCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}

export class UpdateMemberRoleDto {
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];
}
