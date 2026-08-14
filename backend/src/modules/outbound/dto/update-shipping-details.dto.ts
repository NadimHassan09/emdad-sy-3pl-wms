import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ShippingDeliveryType,
  ShippingPackageType,
  ShippingPayer,
  ShippingPickupType,
} from '@prisma/client';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';

/** Draft shipping details for Waiting for Shipping Details stage (Save only — no carrier API). */
export class UpdateShippingDetailsDto {
  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingReceiverLat?: number | null;

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingReceiverLng?: number | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ShippingPackageType)
  shippingPackageType?: ShippingPackageType | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shippingContents?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ShippingDeliveryType)
  shippingDeliveryType?: ShippingDeliveryType | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ShippingPickupType)
  shippingPickupType?: ShippingPickupType | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ShippingPayer)
  shippingPayer?: ShippingPayer | null;

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingWeightKg?: number | null;

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingVolumeCbm?: number | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  shippingPhoneCountry?: string | null;

  /** Optional display/manual carrier label (legacy field). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string | null;
}
