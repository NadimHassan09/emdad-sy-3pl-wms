import { IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ListProductHistoryQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  warehouseId!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  productId?: string;
}
