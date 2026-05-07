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

/** Partial update; `companyId` is immutable. Lot tracking remains server-owned; expiry requirement is editable. */
export class UpdateProductDto {
  @IsOptional()
  @IsBoolean()
  expiryTracking?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

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
    if (value === null) return null;
    if (value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  lengthCm?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) return null;
    if (value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  widthCm?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) return null;
    if (value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  heightCm?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) return null;
    if (value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(999999.9999)
  weightKg?: number | null;
}
