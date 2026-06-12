import { IsIn, IsOptional, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListProductHistoryQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  warehouseId!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  productId?: string;

  /** When yes/true/1, only rows with nextDueAt in the past. */
  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['true', 'false', '1', '0', 'yes'])
  overdueOnly?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'lastCountedFrom must be YYYY-MM-DD' })
  lastCountedFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'lastCountedTo must be YYYY-MM-DD' })
  lastCountedTo?: string;
}

export function parseOverdueOnly(raw: string | undefined): boolean {
  return raw === 'true' || raw === '1' || raw === 'yes';
}
