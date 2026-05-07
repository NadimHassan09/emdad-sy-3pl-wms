import { AdjustmentStatus } from '@prisma/client';
import { IsIn, IsOptional, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const STATUSES = Object.values(AdjustmentStatus) as AdjustmentStatus[];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListAdjustmentsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(STATUSES)
  status?: AdjustmentStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  adjustmentId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  productId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  lotId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;
}
