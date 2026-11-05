import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertShippingFxDto {
  @IsIn(['manual', 'automatic'])
  mode!: 'manual' | 'automatic';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  manualRate?: number;

  /** How often the automatic source is asked again (1 hour to 7 days). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  refreshHours?: number;

  /** An automatic rate older than this is refused for conversion (1 hour to 30 days). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  staleHours?: number;

  /** Smallest move, in percent, that replaces the active automatic rate. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  minChangePercent?: number;
}
