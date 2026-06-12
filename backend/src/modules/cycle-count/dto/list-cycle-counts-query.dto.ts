import { CycleCountStatus } from '@prisma/client';
import { IsIn, IsOptional, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const STATUSES = Object.values(CycleCountStatus) as CycleCountStatus[];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListCycleCountsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(STATUSES)
  status?: CycleCountStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  assignedWorkerId?: string;

  /** When yes/true/1, restricts to pending_review (discrepancy sessions). */
  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['true', 'false', '1', '0', 'yes'])
  discrepancyOnly?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;
}

export function parseDiscrepancyOnly(raw: string | undefined): boolean {
  return raw === 'true' || raw === '1' || raw === 'yes';
}
