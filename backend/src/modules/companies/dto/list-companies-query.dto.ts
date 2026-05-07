import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';

export class ListCompaniesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** When true, returns companies in any status (for admin / clients UI). Default lists active only. */
  @EmptyToUndefined()
  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeAll?: boolean;
}
