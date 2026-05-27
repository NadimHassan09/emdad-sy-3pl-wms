import { IsOptional, IsUUID } from 'class-validator';

export class ConsistencyQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
