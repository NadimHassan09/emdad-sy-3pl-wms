import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

/** Placeholder until the user sets a real reason in the draft UI (approve is blocked while this value). */
export const ADJUSTMENT_REASON_PENDING = '(pending)';

function hasNonEmptyReasonString(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  // non-strings: run @IsString so bad payloads still get a clear error
  return true;
}

export class CreateAdjustmentDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  warehouseId!: string;

  /**
   * Omit or blank — server applies a placeholder until the user saves a real reason in the UI.
   * Note: @IsOptional() does not skip `""`; @ValidateIf skips string validators unless there is real text.
   */
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const t = String(value).trim();
    return t === '' ? undefined : t;
  })
  @ValidateIf((_, v) => hasNonEmptyReasonString(v))
  @IsString()
  @Length(1, 500)
  reason?: string;
}
