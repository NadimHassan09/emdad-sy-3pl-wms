import { IsOptional, IsUUID } from 'class-validator';

export class ConfirmOutboundBodyDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
