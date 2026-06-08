import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBillingPlanDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

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
