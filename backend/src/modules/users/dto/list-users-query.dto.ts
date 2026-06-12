import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const ROLES = Object.values(UserRole) as UserRole[];

export class ListUsersQueryDto extends PaginationDto {
  /** `all` (default) | `system` (no company) | `client` (has company) */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsIn(['all', 'system', 'client'])
  kind?: 'all' | 'system' | 'client';

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  /** Narrow client users to one company (tenant-scoped). */
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;
}
