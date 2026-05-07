import { IsBoolean, IsOptional } from 'class-validator';

import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ListLocationsQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
