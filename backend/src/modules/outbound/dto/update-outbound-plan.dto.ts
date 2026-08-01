import { IsBoolean, IsDateString, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateOutboundPlanDto {
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
