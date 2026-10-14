import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertShippingFxDto {
  @IsIn(['manual', 'automatic'])
  mode!: 'manual' | 'automatic';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  manualRate?: number;
}
