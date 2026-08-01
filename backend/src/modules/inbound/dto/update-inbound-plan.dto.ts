import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class UpdateInboundPlanDto {
  @IsOptional()
  @IsIn(['admin', 'workers'])
  executionMode?: 'admin' | 'workers';

  @IsOptional()
  @IsObject()
  executionPlan?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expectedArrivalDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
