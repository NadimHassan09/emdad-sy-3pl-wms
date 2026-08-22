import { IsOptional, IsUUID, Matches } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filters for admin OMS Order summary status aggregation. */
export class OmsDashboardOrderSummaryQueryDto {
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
  @IsUUID()
  companyId?: string;
}
