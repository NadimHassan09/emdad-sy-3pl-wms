import { OmsOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../../common/transformers/query-transform';

const ORDER_STATUSES = Object.values(OmsOrderStatus);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListClientOmsOrdersQueryDto extends PaginationDto {
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
  status?: OmsOrderStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;
}
