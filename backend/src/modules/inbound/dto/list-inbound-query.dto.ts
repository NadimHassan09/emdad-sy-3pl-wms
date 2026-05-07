import { InboundOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const ORDER_STATUSES = Object.values(InboundOrderStatus);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListInboundQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  /** Substring against order_number; if the value matches a UUID, also matches `id`. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderSearch?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: InboundOrderStatus;
}
