import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddCombatantDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() tokenId?: string;
  @IsOptional() @IsString() characterId?: string;
  @IsOptional() @IsNumber() initiative?: number;
  @IsOptional() @IsInt() @Min(0) hp?: number;
  @IsOptional() @IsInt() @Min(0) maxHp?: number;
  @IsOptional() isNpc?: boolean;
}

export class UpdateCombatantDto {
  @IsOptional() @IsNumber() initiative?: number;
  @IsOptional() @IsInt() hp?: number;
  @IsOptional() @IsInt() @Min(0) maxHp?: number;
  @IsOptional() @IsArray() conditions?: string[];
}

export class DamageDto {
  @IsInt() amount!: number; // positivo = dano, negativo = cura (ou use /heal)
}

export class CreateEncounterDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() sceneId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddCombatantDto)
  combatants?: AddCombatantDto[];
}
