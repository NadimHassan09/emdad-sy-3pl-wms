import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { MAX_RETURN_LINES_PER_ORDER } from '../returns.constants';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { CreateReturnOrderLineDto } from './create-return-order-line.dto';

export class CreateReturnOrderDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @IsOptional()
  @IsUuidLoose()
  originalOutboundOrderId?: string;

  @IsOptional()
  @IsUuidLoose()
  packageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipmentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RETURN_LINES_PER_ORDER)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnOrderLineDto)
  lines!: CreateReturnOrderLineDto[];
}
