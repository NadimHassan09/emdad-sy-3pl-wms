import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ShippingDeliveryType, ShippingPackageType, ShippingPickupType } from '@prisma/client';

export class QuoteShippingRatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  receiverLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  receiverLng?: number;

  /** Babel neighbourhood id — preferred over coordinates for quote/create identity. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  neighbourhoodId?: number | null;

  @IsEnum(ShippingPackageType)
  packageType!: ShippingPackageType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  weightKg!: number;

  @IsEnum(ShippingDeliveryType)
  deliveryType!: ShippingDeliveryType;

  @IsOptional()
  @IsEnum(ShippingPickupType)
  pickupType?: ShippingPickupType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeCbm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  codAmount?: number | null;

  /** One entry per carton — Babel part weight (kg). */
  @IsOptional()
  @IsArray()
  parts?: Array<{ weight: number }>;

  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;
}
