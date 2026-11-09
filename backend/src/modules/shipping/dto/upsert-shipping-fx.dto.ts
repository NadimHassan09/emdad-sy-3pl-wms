import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertShippingFxDto {
  @IsIn(['manual', 'automatic'])
  mode!: 'manual' | 'automatic';

  /** Built-in market feed, or an admin-supplied HTTPS JSON API. */
  @IsOptional()
  @IsIn(['builtin', 'custom'])
  autoSourceKind?: 'builtin' | 'custom';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  manualRate?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2000)
  customUrl?: string;

  /** Dot path into the JSON body (e.g. usd.syp). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customJsonPath?: string;

  @IsOptional()
  @IsIn(['old_syp', 'new_syp'])
  customRateUnit?: 'old_syp' | 'new_syp';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customAuthHeaderName?: string;

  /** Omit to keep the previously stored secret; send empty string to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customAuthHeaderValue?: string;

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
