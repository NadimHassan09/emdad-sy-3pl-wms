import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateInboundOrderLineDto } from '../../../inbound/dto/create-inbound.dto';

/** What a client may change on an inbound order the warehouse has not approved yet. */
export class UpdateClientInboundOrderDto {
  @IsOptional()
  @IsDateString()
  expectedArrivalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** When present the whole line list is replaced. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInboundOrderLineDto)
  lines?: CreateInboundOrderLineDto[];
}
