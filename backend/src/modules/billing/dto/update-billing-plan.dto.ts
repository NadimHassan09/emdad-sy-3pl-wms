import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export type BillingPlanApplyMode = 'immediate' | 'next_cycle';

export class UpdateBillingPlanDto {
  /**
   * immediate — refresh the live cycle rate snapshot and recalculate the draft invoice.
   * next_cycle — update the plan only; active cycle keeps its existing snapshot (default).
   */
  @IsOptional()
  @IsIn(['immediate', 'next_cycle'])
  applyMode?: BillingPlanApplyMode;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  cycleLengthDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedSubscriptionFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  inboundOrderFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outboundOrderFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outboundBaseFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  outboundIncludedItems?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outboundAdditionalItemFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packagingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qualityCheckFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  excessVolumeFeePerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  excessWeightFeePerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservedVolume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservedWeight?: number;
}
