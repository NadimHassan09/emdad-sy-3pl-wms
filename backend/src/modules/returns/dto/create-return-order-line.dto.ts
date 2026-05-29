import { ReturnItemCondition, ReturnItemDisposition } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateReturnOrderLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  expectedQuantity!: number;

  @IsOptional()
  @IsUuidLoose()
  outboundOrderLineId?: string;

  @IsOptional()
  @IsUuidLoose()
  packageId?: string;

  @IsOptional()
  @IsUuidLoose()
  lotId?: string;

  @IsOptional()
  @IsEnum(ReturnItemCondition)
  condition?: ReturnItemCondition;

  @IsOptional()
  @IsEnum(ReturnItemDisposition)
  disposition?: ReturnItemDisposition;
}
