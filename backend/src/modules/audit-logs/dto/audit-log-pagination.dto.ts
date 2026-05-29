import { IsInt, Max, Min } from 'class-validator';

import { PaginationLimit, PaginationOffset } from '../../../common/transformers/query-transform';

/** Stricter pagination defaults for audit log reads (operational traceability, not bulk export). */
export class AuditLogPaginationDto {
  @PaginationLimit(50, 100)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @PaginationOffset(0)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset: number = 0;
}
