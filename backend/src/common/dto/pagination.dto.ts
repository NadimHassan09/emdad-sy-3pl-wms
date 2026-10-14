import { IsInt, Max, Min } from 'class-validator';

import { PaginationLimit, PaginationOffset } from '../transformers/query-transform';

/**
 * Robust against empty query strings (`limit=`), arrays, or missing keys.
 */
export class PaginationDto {
  @PaginationLimit(50, 1000)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 50;

  @PaginationOffset(0)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
