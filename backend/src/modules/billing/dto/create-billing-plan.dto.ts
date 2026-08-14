import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateBillingPlanDto {
  @IsUuidLoose()
  companyId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsInt()
  @Min(1)
  cycleLengthDays!: number;

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

  /** Optional ISO start for the first billing cycle (defaults to now). */
  @IsOptional()
  @IsDateString()
  cycleStartsAt?: string;
}
