import { IsBoolean, IsOptional } from 'class-validator';

import { QueryBoolOptional } from '../../../common/transformers/query-transform';

export class ListWarehousesQueryDto {
  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
