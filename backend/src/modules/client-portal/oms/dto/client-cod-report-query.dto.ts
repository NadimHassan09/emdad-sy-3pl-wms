import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../../common/transformers/query-transform';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Client-facing COD status filters (legacy labels kept for portal UI). */
export const CLIENT_COD_STATUS_FILTERS = [
  'pending',
  'collected',
  'remitted',
  'settled',
  'available',
  'paid_out',
] as const;

export class ClientCodReportQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsIn([...CLIENT_COD_STATUS_FILTERS])
  codStatus?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;
}
