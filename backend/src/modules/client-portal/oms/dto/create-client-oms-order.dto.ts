import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmsPaymentMethod } from '@prisma/client';

import { IsUuidLoose } from '../../../../common/validators/is-uuid-loose';

export class CreateClientOmsOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  requestedQuantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice?: number;
}

export class CreateClientOmsOrderDto {
  @IsDateString()
  requiredShipDate!: string;

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
