import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class RunReportQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  status?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  sku?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class AggregateReportQueryDto extends RunReportQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  declare groupBy?: string;
}

export class ExportReportQueryDto extends RunReportQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['csv', 'xls'])
  format: 'csv' | 'xls' = 'csv';
}

