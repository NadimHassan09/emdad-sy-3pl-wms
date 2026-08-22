import { InboundOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../../common/transformers/query-transform';

/** Client-facing inbound status filter buckets. */
export const CLIENT_INBOUND_STATUS_FILTERS = [
  'pending_approval',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type ClientInboundStatusFilter = (typeof CLIENT_INBOUND_STATUS_FILTERS)[number];

export const CLIENT_INBOUND_IN_PROGRESS_STATUSES: InboundOrderStatus[] = [
  InboundOrderStatus.draft,
  InboundOrderStatus.confirmed,
  InboundOrderStatus.in_progress,
  InboundOrderStatus.partially_received,
];

export class ClientListInboundQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderSearch?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn([...CLIENT_INBOUND_STATUS_FILTERS])
  status?: ClientInboundStatusFilter;
}
