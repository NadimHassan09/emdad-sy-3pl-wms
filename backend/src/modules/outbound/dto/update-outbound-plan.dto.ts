import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { ShippingConfigDto } from '../../shipping/dto/shipping-config.dto';

export class UpdateOutboundPlanDto extends ShippingConfigDto {
  @IsOptional()
  @IsIn(['admin', 'workers'])
  executionMode?: 'admin' | 'workers';

  @IsOptional()
  @IsObject()
  executionPlan?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  requiredShipDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsBoolean()
  requiresPacking?: boolean;
}
