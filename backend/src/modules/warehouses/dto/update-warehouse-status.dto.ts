import { WarehouseStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateWarehouseStatusDto {
  @IsEnum(WarehouseStatus)
  status!: WarehouseStatus;
}
