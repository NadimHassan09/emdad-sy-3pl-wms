import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

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

export class CreateOutboundOrderDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsString()
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOutboundOrderLineDto)
  lines!: CreateOutboundOrderLineDto[];
}
