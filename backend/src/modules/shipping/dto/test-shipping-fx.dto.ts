import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Optional body for POST /shipping/fx/test-source — test custom fields before saving. */
export class TestShippingFxDto {
  @IsOptional()
  @IsIn(['builtin', 'custom'])
  autoSourceKind?: 'builtin' | 'custom';

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2000)
  customUrl?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customAuthHeaderValue?: string;
}
