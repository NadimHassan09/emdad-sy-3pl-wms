import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class UpdateShippingFeeSettingsDto {
  @IsString()
  @MaxLength(8)
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  baseWeightKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  incrementKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  incrementCharge!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  externalPerKg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  externalCurrency?: string | null;
}

export class ShippingFeeLocationDto {
  @IsIn(['governorate', 'city_region', 'town'])
  level!: 'governorate' | 'city_region' | 'town';

  @IsString()
  @MaxLength(120)
  governorate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cityRegion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  townNeighborhood?: string | null;
}

export class UpsertShippingFeeGroupDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string | null;

  @IsString()
  @MaxLength(160)
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string | null;

  @IsIn(['region', 'rural', 'mixed', 'custom'])
  areaCategory!: 'region' | 'rural' | 'mixed' | 'custom';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseRate!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ShippingFeeLocationDto)
  locations!: ShippingFeeLocationDto[];

  /** Move locations already assigned to another group into this one. */
  @IsOptional()
  @IsBoolean()
  reassign?: boolean;
}

export class SetShippingFeeGroupActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class PreviewShippingFeeDto {
  @IsIn(['local', 'external'])
  scope!: 'local' | 'external';

  @IsOptional()
  @IsUuidLoose()
  companyId?: string | null;

  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  cityRegion?: string;

  @IsOptional()
  @IsString()
  townNeighborhood?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  weightKg!: number;
}
