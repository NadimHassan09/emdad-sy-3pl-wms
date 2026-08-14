import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateOmsReturnLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsUuidLoose()
  lotId?: string;
}

export class CreateOmsReturnDto {
  @IsUuidLoose()
  omsOrderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOmsReturnLineDto)
  lines!: CreateOmsReturnLineDto[];
}

export class RejectOmsReturnDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApproveOmsReturnDto {
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;
}

export class UpdateOmsReturnPlanDto {
  @IsOptional()
  @IsIn(['admin', 'workers'])
  executionMode?: 'admin' | 'workers';

  @IsOptional()
  @IsObject()
  executionPlan?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
