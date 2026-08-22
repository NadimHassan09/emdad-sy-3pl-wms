import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ExternalInboundLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number (no decimals).' })
  @IsPositive({ message: 'Quantity must be a positive whole number.' })
  quantity!: number;
}

export class ExternalCreateInboundOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  externalOrderId!: string;

  @IsDateString()
  expectedArrivalDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalInboundLineDto)
  lines!: ExternalInboundLineDto[];
}
