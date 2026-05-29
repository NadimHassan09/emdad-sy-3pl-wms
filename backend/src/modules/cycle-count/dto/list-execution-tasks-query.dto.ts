import { IsOptional } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ListExecutionTasksQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;
}
