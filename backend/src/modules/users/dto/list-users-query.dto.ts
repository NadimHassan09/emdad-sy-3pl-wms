import { IsIn, IsOptional, IsString } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';

export class ListUsersQueryDto {
  /** `all` (default) | `system` (no company) | `client` (has company) */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsIn(['all', 'system', 'client'])
  kind?: 'all' | 'system' | 'client';
}
