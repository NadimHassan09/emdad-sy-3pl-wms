import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';

/**
 * Admin list filters for lead submissions: free-text search (name/phone/email),
 * activity-type filter, created-date range, and sort direction.
 */
export class ListLeadFormsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  activityType?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';
}
