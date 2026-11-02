import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AdjustShippingFeeDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Shipping fee must be a non-negative number.' })
  shippingFee!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustShippingFeeBulkItemDto {
  @IsUuidLoose()
  id!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Shipping fee must be a non-negative number.' })
  shippingFee!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustShippingFeeBulkDto {
  /** Mode 1: Array of order IDs to apply the same shipping fee to */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUuidLoose({ each: true })
  ids?: string[];

  /** Mode 1: Common shipping fee for all orders */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Shipping fee must be a non-negative number.' })
  shippingFee?: number;

  /** Common reason for Mode 1 or fallback for Mode 2 */
  @IsOptional()
  @IsString()
  reason?: string;

  /** Mode 2: Array of individual order fee adjustments */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AdjustShippingFeeBulkItemDto)
  items?: AdjustShippingFeeBulkItemDto[];
}
