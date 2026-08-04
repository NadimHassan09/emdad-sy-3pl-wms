import { OutboundOrderStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../../common/transformers/query-transform';

/** Client-facing outbound status filter buckets. */
export const CLIENT_OUTBOUND_STATUS_FILTERS = [
  'pending_approval',
  'in_progress',
  'shipped',
  'cancelled',
] as const;

export type ClientOutboundStatusFilter = (typeof CLIENT_OUTBOUND_STATUS_FILTERS)[number];

export const CLIENT_OUTBOUND_IN_PROGRESS_STATUSES: OutboundOrderStatus[] = [
  OutboundOrderStatus.draft,
  OutboundOrderStatus.pending_stock,
  OutboundOrderStatus.confirmed,
  OutboundOrderStatus.allocated,
  OutboundOrderStatus.picking,
  OutboundOrderStatus.packing,
  OutboundOrderStatus.ready_to_ship,
  OutboundOrderStatus.out_for_delivery,
  OutboundOrderStatus.returned,
];

export class ClientListOutboundQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderSearch?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn([...CLIENT_OUTBOUND_STATUS_FILTERS])
  status?: ClientOutboundStatusFilter;
}
