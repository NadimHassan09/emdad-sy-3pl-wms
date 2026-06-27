import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { CompanyStatus } from '@prisma/client';

import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';

export class ListCompaniesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by a specific lifecycle status (e.g. active, suspended, archived). */
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  /** When true, returns companies in any status (for admin / clients UI). Default lists active only. */
  @EmptyToUndefined()
  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeAll?: boolean;
}
