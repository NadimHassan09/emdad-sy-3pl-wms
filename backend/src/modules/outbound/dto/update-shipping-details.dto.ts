import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ShippingDeliveryType,
  ShippingMethod,
  ShippingPackageType,
  ShippingPayer,
  ShippingPickupType,
} from '@prisma/client';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';

class ShippingCartonLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;
}

class ShippingCartonDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingCartonLineDto)
  lines!: ShippingCartonLineDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  lengthCm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  widthCm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  heightCm!: number;
}

/** Draft shipping details for Waiting for Shipping Details stage (Save only — no carrier API). */
export class UpdateShippingDetailsDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shippingProviderCode?: string | null;

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

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  babelNeighbourhoodId?: number | null;

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

  /** Receiver address hierarchy (editable on shipping details). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string | null;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string | null;

  /** Physical cartons for carrier handoff (one Babel part per carton). */
  @EmptyToUndefined()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingCartonDto)
  shippingPackages?: ShippingCartonDto[] | null;
}
