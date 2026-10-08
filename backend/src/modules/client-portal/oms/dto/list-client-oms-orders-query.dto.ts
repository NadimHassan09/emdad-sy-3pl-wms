import { OmsOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../../common/transformers/query-transform';
import { OMS_OPERATIONAL_STAGE_VALUES } from '../../../oms/oms-operational-stage';

const ORDER_STATUSES = Object.values(OmsOrderStatus);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOTAL_OPS = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;

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

  /** Recipient name filter. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer?: string;

  /** Recipient phone filter. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  carrier?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  startOrderNo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  endOrderNo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(TOTAL_OPS)
  totalOp?: (typeof TOTAL_OPS)[number];

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'totalValue must be a non-negative number',
  })
  @MaxLength(20)
  totalValue?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(OMS_OPERATIONAL_STAGE_VALUES)
  operationalStage?: (typeof OMS_OPERATIONAL_STAGE_VALUES)[number];
}
