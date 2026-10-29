import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class UpdatePreferencesDto {
  // preferências livres (tema, atalhos, etc.) — validadas como objeto JSON
  @IsOptional()
  preferences?: Record<string, unknown>;
}
