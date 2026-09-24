import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ShippingMethod } from '@prisma/client';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { UpdateShippingDetailsDto } from './update-shipping-details.dto';

export class BulkOutboundIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUuidLoose({ each: true })
  ids!: string[];
}

/** Explicit execution configuration reviewed by the admin in the Bulk Execution Plan modal. */
export class BulkProcessOutboundItemDto {
  @IsUuidLoose()
  outboundOrderId!: string;

  @IsIn(['admin', 'workers'])
  executionMode!: 'admin' | 'workers';

  @IsBoolean()
  requiresPacking!: boolean;

  @IsString()
  @MaxLength(64)
  warehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  packingLocationId?: string;

  @IsString()
  @MaxLength(64)
  dispatchDockId!: string;
}

export class BulkProcessOutboundDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkProcessOutboundItemDto)
  items!: BulkProcessOutboundItemDto[];
}

/** Per-order shipping details (addresses stay per-order; never shared blindly). */
export class BulkShippingDetailsItemDto extends UpdateShippingDetailsDto {
  @IsUuidLoose()
  outboundOrderId!: string;

  // Required here (optional in the single-order DTO); both decorators apply.
  @IsEnum(ShippingMethod)
  declare shippingMethod: ShippingMethod;
}

export class BulkShippingDetailsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkShippingDetailsItemDto)
  items!: BulkShippingDetailsItemDto[];
}
