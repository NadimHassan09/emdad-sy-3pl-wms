import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdjustCarrierCostDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Carrier cost must be a non-negative number.' })
  carrierCostUsd!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
