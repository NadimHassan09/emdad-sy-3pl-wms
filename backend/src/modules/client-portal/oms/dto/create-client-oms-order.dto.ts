import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
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

  @IsString()
  @IsNotEmpty({ message: 'Recipient name is required.' })
  @IsRecipientName()
  recipientName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Recipient phone is required.' })
  @IsRecipientPhone()
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  shippingPhoneCountry?: string;

  @IsString()
  @IsNotEmpty({ message: 'Governorate is required.' })
  @MinLength(1)
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'City/Region is required.' })
  @MinLength(1)
  district!: string;

  @IsString()
  @IsNotEmpty({ message: 'Town/Neighborhood is required.' })
  @MinLength(1)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  shippingReceiverLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  shippingReceiverLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  babelNeighbourhoodId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  storeChannel?: string;

  @IsEnum(OmsPaymentMethod)
  @IsNotEmpty({ message: 'Payment method is required.' })
  paymentMethod!: OmsPaymentMethod;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientOmsOrderLineDto)
  lines!: CreateClientOmsOrderLineDto[];
}
