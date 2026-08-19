import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmsPaymentMethod } from '@prisma/client';

import { IsRecipientName, IsRecipientPhone } from '../../../../common/validators/is-recipient-contact';

export class ExternalOmsAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  governorate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;
}

export class ExternalOmsLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number (no decimals).' })
  @IsPositive({ message: 'Quantity must be a positive whole number.' })
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Unit price must be a whole number (no decimals).' })
  @Min(0, { message: 'Unit price cannot be negative.' })
  unitPrice?: number;
}

export class ExternalCreateOmsOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  externalOrderId!: string;

  @IsDateString()
  requiredShipDate!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ExternalOmsAddressDto)
  address!: ExternalOmsAddressDto;

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
  @MaxLength(8)
  shippingPhoneCountry?: string;

  @IsOptional()
  @IsEnum(OmsPaymentMethod)
  paymentMethod?: OmsPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalOmsLineDto)
  lines!: ExternalOmsLineDto[];
}
