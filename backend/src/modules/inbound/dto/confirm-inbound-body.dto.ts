import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class ConfirmInboundBodyDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  /** Map inbound_order_line.id → staging location UUID */
  @IsOptional()
  @IsObject()
  stagingByLineId?: Record<string, string>;
}
