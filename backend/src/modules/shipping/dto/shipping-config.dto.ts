import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  ShippingDeliveryType,
  ShippingMethod,
  ShippingPackageType,
  ShippingPayer,
  ShippingPickupType,
} from '@prisma/client';

/** Shared shipping config fields for OMS create/update and Outbound create/updatePlan. */
export class ShippingConfigDto {
  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @IsOptional()
  @IsString()
  shippingProviderCode?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  shippingReceiverLat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  shippingReceiverLng?: number | null;

  @IsOptional()
  @IsEnum(ShippingPackageType)
  shippingPackageType?: ShippingPackageType | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shippingContents?: string | null;

  @IsOptional()
  @IsEnum(ShippingDeliveryType)
  shippingDeliveryType?: ShippingDeliveryType | null;

  @IsOptional()
  @IsEnum(ShippingPickupType)
  shippingPickupType?: ShippingPickupType | null;

  @IsOptional()
  @IsEnum(ShippingPayer)
  shippingPayer?: ShippingPayer | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  shippingWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  shippingVolumeCbm?: number | null;

  @IsOptional()
  @IsString()
  shippingPhoneCountry?: string | null;
}
