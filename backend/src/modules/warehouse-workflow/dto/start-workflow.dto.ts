import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class StartWorkflowBodyDto {
  @IsUUID()
  warehouseId!: string;

  /** Inbound only: map `inbound_order_line_id` → `staging_location_id`. */
  @IsOptional()
  @IsObject()
  stagingByLineId?: Record<string, string>;
}
