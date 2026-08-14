import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ShippingDeliveryType, ShippingPackageType, ShippingPickupType } from '@prisma/client';

export class QuoteShippingRatesDto {
  @Type(() => Number)
  @IsNumber()
  receiverLat!: number;

  @Type(() => Number)
  @IsNumber()
  receiverLng!: number;

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
