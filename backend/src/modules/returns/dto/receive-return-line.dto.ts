import { ReturnItemCondition } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class ReceiveReturnLineDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  /** Optional physical condition noted at receipt; disposition is set at inspection. */
  @IsOptional()
  @IsEnum(ReturnItemCondition)
  condition?: ReturnItemCondition;
}
