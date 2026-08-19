import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmsPaymentMethod } from '@prisma/client';

import { IsUuidLoose } from '../../../../common/validators/is-uuid-loose';
import { IsRecipientName, IsRecipientPhone } from '../../../../common/validators/is-recipient-contact';

export class CreateClientOmsOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Requested quantity must be a whole number (no decimals).' })
  @IsPositive({ message: 'Requested quantity must be a positive whole number greater than zero.' })
  requestedQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Unit price must be a whole number (no decimals).' })
  @Min(0, { message: 'Unit price cannot be negative.' })
  unitPrice?: number;
}

export class CreateClientOmsOrderDto {
  @IsDateString()
  requiredShipDate!: string;

  @IsOptional()
  @IsString()
  @IsRecipientName()
  recipientName?: string;

  @IsOptional()
  @IsString()
  @IsRecipientPhone()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  shippingPhoneCountry?: string;

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
  notes?: string;

  @IsOptional()
  @IsString()
  storeChannel?: string;

  @IsOptional()
  @IsEnum(OmsPaymentMethod)
  paymentMethod?: OmsPaymentMethod;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientOmsOrderLineDto)
  lines!: CreateClientOmsOrderLineDto[];
}
