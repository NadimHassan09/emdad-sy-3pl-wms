import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OmsPaymentMethod } from '@prisma/client';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ShippingConfigDto } from '../../shipping/dto/shipping-config.dto';

/** Treat empty string / null as omitted so optional UUID fields do not fail validation. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' || value === null ? undefined : value;
}
export class CreateOmsOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  requestedQuantity!: number;

  @IsOptional()
  @IsUuidLoose()
  specificLotId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  lineTotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  discountAmount?: number;
}

export class CreateOmsOrderDto extends ShippingConfigDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsDateString()
  requiredShipDate!: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  clientReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  requiresPacking?: boolean;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @IsOptional()
  @IsEnum(OmsPaymentMethod)
  paymentMethod?: OmsPaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUuidLoose()
  warehouseId?: string;

  /** Optional legacy link; new OMS-first flow leaves this unset. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUuidLoose()
  outboundOrderId?: string;

  @IsOptional()
  @IsString()
  storeChannel?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOmsOrderLineDto)
  lines!: CreateOmsOrderLineDto[];
}

export class UpdateOmsOrderDto extends ShippingConfigDto {
  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsDateString()
  requiredShipDate?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  clientReference?: string;

  @IsOptional()
  @IsEnum(OmsPaymentMethod)
  paymentMethod?: OmsPaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  /** Legacy only: set null to unlink. Prefer approve flow to create outbound. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUuidLoose()
  outboundOrderId?: string | null;

  @IsOptional()
  @IsString()
  storeChannel?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

export class AllocateOmsOrderDto {
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;
}

export class ApproveOmsOrderDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  shippingFee?: number;
}

export class RejectOmsOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevertOmsDeliveryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;
}
