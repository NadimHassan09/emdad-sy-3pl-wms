import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ShippingConfigDto } from '../../shipping/dto/shipping-config.dto';

export class CreateOutboundOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  requestedQuantity!: number;

  @IsOptional()
  @IsUuidLoose()
  specificLotId?: string;
}

export class CreateOutboundOrderDto extends ShippingConfigDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Destination address is required.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: 'Destination address cannot be empty.' })
  destinationAddress!: string;

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
  @IsString()
  externalReference?: string;

  /** When false, pick drops to delivery area and dispatch follows pick (no pack task). */
  @IsOptional()
  @IsBoolean()
  requiresPacking?: boolean;

  @IsOptional()
  @IsIn(['admin', 'workers'])
  executionMode?: 'admin' | 'workers';

  @IsOptional()
  @IsObject()
  executionPlan?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOutboundOrderLineDto)
  lines!: CreateOutboundOrderLineDto[];
}
