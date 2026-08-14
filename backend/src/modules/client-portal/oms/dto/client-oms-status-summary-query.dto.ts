import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { EmptyToUndefined } from '../../../../common/transformers/query-transform';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filters for OMS order status aggregation (no pagination). */
export class ClientOmsStatusSummaryQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;
}
