import { IsOptional, IsString, MaxLength } from 'class-validator';

import { EmptyToUndefined } from '../../../../common/transformers/query-transform';
import { ClientListInboundQueryDto } from '../../inbound/dto/client-list-inbound-query.dto';
import { ListClientOmsOrdersQueryDto } from '../../oms/dto/list-client-oms-orders-query.dto';
import { ClientListOutboundQueryDto } from '../../outbound/dto/client-list-outbound-query.dto';

/**
 * List query DTOs + Single-mode lookup keys (`externalOrderId`, `orderNumber`).
 * Global ValidationPipe uses forbidNonWhitelisted, so these must be declared.
 */

export class ExternalListOmsOrdersQueryDto extends ListClientOmsOrdersQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalOrderId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;
}

export class ExternalListInboundOrdersQueryDto extends ClientListInboundQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalOrderId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;
}

export class ExternalListOutboundOrdersQueryDto extends ClientListOutboundQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalOrderId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;
}
