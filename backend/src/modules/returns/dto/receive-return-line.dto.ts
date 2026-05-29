import { ReturnItemCondition, ReturnItemDisposition } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class ReceiveReturnLineDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsEnum(ReturnItemCondition)
  condition?: ReturnItemCondition;

  @IsOptional()
  @IsEnum(ReturnItemDisposition)
  disposition?: ReturnItemDisposition;
}
