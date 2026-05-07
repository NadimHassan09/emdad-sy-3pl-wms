import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

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
  clientReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInboundOrderLineDto)
  lines!: CreateInboundOrderLineDto[];
}
