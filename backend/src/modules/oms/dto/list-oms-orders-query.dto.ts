import { OmsOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const ORDER_STATUSES = Object.values(OmsOrderStatus);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOTAL_OPS = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;

export class ListOmsOrdersQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /** Quick/general search across order #, customer, phone, references. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderSearch?: string;

  /** Dedicated order identifier / reference filter (advanced). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderId?: string;

  /** Dedicated customer (recipient) name filter (advanced). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer?: string;

  /** Dedicated recipient phone filter (advanced). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Dedicated city filter (advanced). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  /**
   * Numeric total operator used with `totalValue`.
   * Compared against stored `subtotal` (order total maintained on write).
   */
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

  /** When "linked" or "unlinked", filter by warehouse link state. */
  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['linked', 'unlinked'])
  linkStatus?: 'linked' | 'unlinked';
}
