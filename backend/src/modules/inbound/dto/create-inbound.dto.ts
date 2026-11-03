import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InboundSourceType } from '@prisma/client';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateInboundOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  expectedQuantity!: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  expectedLotNumber?: string;

  @IsOptional()
  @IsDateString()
  expectedExpiryDate?: string;
}

export class CreateInboundOrderDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsDateString()
  expectedArrivalDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Client reference must be at most 100 characters.' })
  clientReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes must be at most 500 characters.' })
  notes?: string;

  @IsOptional()
  @IsIn(['admin', 'workers'])
  executionMode?: 'admin' | 'workers';

  /** Admin planning blob — validated in service when executionMode=admin. */
  @IsOptional()
  @IsObject()
  executionPlan?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(InboundSourceType)
  sourceType?: InboundSourceType;

  @IsOptional()
  @IsString()
  storeChannel?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInboundOrderLineDto)
  lines!: CreateInboundOrderLineDto[];
}
