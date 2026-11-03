import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

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
  @MaxLength(500, { message: 'Notes must be at most 500 characters.' })
  notes?: string;
}
