import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { AuditLogPaginationDto } from './audit-log-pagination.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListAuditLogsQueryDto extends AuditLogPaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  actor_id?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  actor_email?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actor_role?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  company_id?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  resource_type?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  resource_id?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  action?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'date_from must be YYYY-MM-DD' })
  date_from?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'date_to must be YYYY-MM-DD' })
  date_to?: string;

  /** Matches action, actor email/name, resource id/type (case-insensitive substring). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['created_at', 'action', 'actor_email', 'actor_role', 'resource_type'])
  sort_by?: 'created_at' | 'action' | 'actor_email' | 'actor_role' | 'resource_type';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';

  /** Keyset cursor (`ISO8601|uuid`) for stable paging on large tables. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cursor?: string;
}
