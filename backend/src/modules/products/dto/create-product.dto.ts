import { ProductUom } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

/** Lot tracking remains server-enforced (`trackingType: lot`). `expiryTracking` is optional (defaults true if omitted). */
export class CreateProductDto {
  @IsUuidLoose()
  companyId!: string;

  /** When true, receipts and picks require expiry dates on lots for this product. */
  @IsOptional()
  @IsBoolean()
  expiryTracking?: boolean;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsEnum(ProductUom)
  uom?: ProductUom;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStockThreshold?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  lengthCm?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  widthCm?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  heightCm?: number;

  /** Kilograms; stored as `weight_kg` (decimal 10,4). */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(999999.9999)
  weightKg?: number;
}
