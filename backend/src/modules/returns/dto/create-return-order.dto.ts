import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { CreateReturnOrderLineDto } from './create-return-order-line.dto';

export class CreateReturnOrderDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

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
  @ValidateNested({ each: true })
  @Type(() => CreateReturnOrderLineDto)
  lines!: CreateReturnOrderLineDto[];
}
